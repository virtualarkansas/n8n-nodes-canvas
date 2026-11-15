import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { sandboxSubAccount } from './support/commsSandbox';
import {
	canvas as canvasInChain,
	convertToCsvFile,
	convertToTextFile,
	csvRecords,
	extractFromCsv,
	parseCsv,
	runChain,
	SKIP_SHORT_ROWS,
} from './support/fileNodes';
import {
	createSandboxAccount,
	createSandboxCourse,
	deleteSandboxAccount,
	deleteSandboxCourse,
	waitForProgress,
} from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Differentiation tags (non-collaborative groups and their tag sets):
 *   groupCategory: bulkManageDifferentiationTags, importDifferentiationTags, exportDifferentiationTags
 *   group:         getUserDifferentiationTags
 *
 * Canvas only imports and exports tags where the account allows differentiation tags.
 * That setting cannot be changed through the REST API, so it is switched on (with a
 * Rails one-liner) for a sub-account that belongs to this file alone. A second course
 * in an account without the setting shows what Canvas answers there.
 */
describe('differentiation tags', () => {
	let accountId = '';
	let course: SandboxCourse;
	let courseId = '';
	let plainCourse: SandboxCourse;
	let students: number[] = [];
	let tagSetId = '';
	const tagIds: Record<string, number> = {};
	const eh = { errorHandling: { onError: 'continueWithError' } };

	const tagSets = (id = courseId): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/courses/${id}/group_categories?collaboration_state=non_collaborative`);
	const tagsOf = (setId: string | number): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/group_categories/${setId}/groups`);
	const allTags = (): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/courses/${courseId}/groups?collaboration_state=non_collaborative`);
	const taggedWith = async (tagId: string | number): Promise<number[]> =>
		(await canvas().getAll<Json>(`/api/v1/groups/${tagId}/users`)).map((u) => Number(u.id)).sort((a, b) => a - b);
	const exportDirectly = async (): Promise<string> =>
		String((await canvas().request('GET', `/api/v1/courses/${courseId}/group_categories/export_tags`)).data);
	const sorted = (ids: number[]): number[] => [...ids].sort((a, b) => a - b);
	const bulk = (params: Json, extra: Json = {}): Promise<Json[]> =>
		runOk({ resource: 'groupCategory', operation: 'bulkManageDifferentiationTags', params: { courseId, ...params }, ...extra });

	beforeAll(async () => {
		accountId = await createSandboxAccount('differentiation tags');
		execFileSync(
			'docker',
			[
				'exec',
				'canvas-web',
				'bundle',
				'exec',
				'rails',
				'runner',
				`a = Account.find(${Number(accountId)}); a.settings[:allow_assign_to_differentiation_tags] = { value: true }; a.save!`,
			],
			{ encoding: 'utf8' },
		);
		course = await createSandboxCourse('diff-tags', { students: 8, personas: ['teacher'], accountId });
		courseId = course.id;
		// In the order of the pool: students[0] is BATTERY-GRD-STU-001, and so on.
		students = course.studentIds;
		plainCourse = await createSandboxCourse('diff-tags-off', { students: 2, accountId: await sandboxSubAccount() });
	}, 900_000);

	afterAll(async () => {
		await deleteSandboxCourse(course);
		await deleteSandboxCourse(plainCourse);
		await deleteSandboxAccount(accountId);
	}, 300_000);

	// ---------------------------------------------------------------- bulk manage

	it('bulkManageDifferentiationTags: a new tag set with its tags in one request', async () => {
		const setName = unique('Reading level "A&B" ünï 読解');
		const [result] = await bulk({
			tagSetName: setName,
			tagsToCreate: { tags: [{ name: 'Above "grade" level' }, { name: 'On level' }, { name: 'Needs support — 支援' }, { name: '  ' }] },
		});
		// Canvas wraps every tag in { group: ... }.
		const created = (result.created as Json[]).map((entry) => entry.group as Json);
		expect(created.map((tag) => tag.name)).toEqual(['Above "grade" level', 'On level', 'Needs support — 支援']);
		expect(created.every((tag) => tag.non_collaborative === true && tag.context_id === Number(courseId))).toBe(true);
		expect(result.updated).toEqual([]);
		expect(result.deleted).toEqual([]);
		expect(result.group_category).toMatchObject({ name: setName, non_collaborative: true, context_id: Number(courseId) });
		tagSetId = String((result.group_category as Json).id);
		for (const tag of created) tagIds[String(tag.name)] = Number(tag.id);

		// Listed among the tag sets (the API does not say "non_collaborative" on a category) ...
		expect((await tagSets()).find((set) => String(set.id) === tagSetId)).toMatchObject({ name: setName, context_type: 'Course' });
		expect((await tagsOf(tagSetId)).map((tag) => tag.name).sort()).toEqual(['Above "grade" level', 'Needs support — 支援', 'On level'].sort());
		// ... and not among the ordinary group categories of the course.
		expect(await canvas().getAll<Json>(`/api/v1/courses/${courseId}/group_categories`)).toEqual([]);
	});

	it('bulkManageDifferentiationTags: rename the set, rename, delete and add tags of an existing set, as the teacher', async () => {
		const renamedSet = unique('Reading level (renamed)');
		const [result] = await bulk(
			{
				groupCategoryId: ` ${tagSetId} `,
				tagSetName: renamedSet,
				tagsToCreate: { tags: [{ name: 'Enrichment' }] },
				tagsToRename: { tags: [{ id: tagIds['On level'], name: 'At level' }, { id: '', name: 'ignored: no ID' }] },
				tagIdsToDelete: ` ${tagIds['Needs support — 支援']} ,`,
			},
			{ persona: 'teacher' },
		);
		expect((result.created as Json[]).map((entry) => (entry.group as Json).name)).toEqual(['Enrichment']);
		expect((result.updated as Json[]).map((entry) => (entry.group as Json).id)).toEqual([tagIds['On level']]);
		expect((result.deleted as Json[]).map((entry) => (entry.group as Json).id)).toEqual([tagIds['Needs support — 支援']]);
		expect(result.group_category).toMatchObject({ id: Number(tagSetId), name: renamedSet });

		expect((await tagSets()).find((set) => String(set.id) === tagSetId)?.name).toBe(renamedSet);
		const tags = await tagsOf(tagSetId);
		expect(tags.map((tag) => tag.name).sort()).toEqual(['Above "grade" level', 'At level', 'Enrichment']);
		expect(tags.find((tag) => tag.name === 'At level')?.id).toBe(tagIds['On level']);
		tagIds.Enrichment = Number(tags.find((tag) => tag.name === 'Enrichment')?.id);

		// Only the name of the set, numbers from an expression.
		const [onlyDelete] = await bulk(
			{ groupCategoryId: '={{ $json.set }}', tagIdsToDelete: '={{ $json.remove }}' },
			{ items: [{ set: Number(tagSetId), remove: [tagIds.Enrichment] }] },
		);
		expect((onlyDelete.deleted as Json[]).map((entry) => (entry.group as Json).id)).toEqual([tagIds.Enrichment]);
		expect((await tagsOf(tagSetId)).map((tag) => tag.name).sort()).toEqual(['Above "grade" level', 'At level']);
	});

	it('bulkManageDifferentiationTags: Canvas applies everything or nothing', async () => {
		const before = (await tagsOf(tagSetId)).map((tag) => tag.id).sort();
		// The tag to rename does not exist: the new tag of the same request must not appear either.
		const result = await runNode({
			resource: 'groupCategory',
			operation: 'bulkManageDifferentiationTags',
			params: {
				courseId,
				groupCategoryId: tagSetId,
				tagsToCreate: { tags: [{ name: 'Must not be created' }] },
				tagsToRename: { tags: [{ id: '99999999', name: 'No such tag' }] },
				...eh,
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'groupCategory', operation: 'bulkManageDifferentiationTags' });
		expect((await tagsOf(tagSetId)).map((tag) => tag.id).sort()).toEqual(before);
	});

	it('bulkManageDifferentiationTags: what the node and Canvas refuse', async () => {
		const run = (params: Json, persona = 'admin'): ReturnType<typeof runNode> =>
			runNode({ resource: 'groupCategory', operation: 'bulkManageDifferentiationTags', persona, params: { courseId, ...params, ...eh } });

		const noSet = await run({ tagsToCreate: { tags: [{ name: 'Orphan' }] } });
		expect(noSet.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(noSet.error[0].errorMessage)).toContain('Tag Set ID');

		const nothingToDo = await run({ groupCategoryId: tagSetId, tagSetName: 'Only a name' });
		expect(nothingToDo.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(nothingToDo.error[0].errorMessage)).toContain('at least one tag');

		// An ordinary group category is not a tag set.
		const ordinary = await canvas().post<Json>(`/api/v1/courses/${courseId}/group_categories`, { name: unique('Ordinary groups') });
		const notATagSet = await run({ groupCategoryId: String(ordinary.id), tagsToCreate: { tags: [{ name: 'Wrong place' }] } });
		expect(notATagSet.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(notATagSet.error[0].errorMessage)).toContain('Differentiation Tags');
		expect(await tagsOf(String(ordinary.id))).toEqual([]);
		await canvas().delete(`/api/v1/group_categories/${String(ordinary.id)}`);

		// A tag set of this course, addressed through another course.
		const otherCourse = await run({ courseId: plainCourse.id, groupCategoryId: tagSetId, tagsToCreate: { tags: [{ name: 'Wrong course' }] } });
		expect(otherCourse.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(otherCourse.error[0].errorMessage)).toContain('not part of the course');

		// At most 50 changes per request.
		const tooMany = await run({
			tagSetName: unique('Too many'),
			tagsToCreate: { tags: Array.from({ length: 51 }, (_, i) => ({ name: `Tag ${i + 1}` })) },
		});
		expect(tooMany.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(tooMany.error[0].errorMessage)).toMatch(/maximum of \d+ operations/);

		// The student persona is not even in the course.
		const student = await run({ tagSetName: unique('Not allowed'), tagsToCreate: { tags: [{ name: 'Nope' }] } }, 'student');
		expect(student.success).toEqual([]);
		expect([401, 403]).toContain(student.error[0].errorCode);

		expect((await tagSets()).map((set) => String(set.id))).toEqual([tagSetId]);
	});

	// ---------------------------------------------------------------- import / user tags / export

	it('importDifferentiationTags (text): creates tags and tag sets and tags the students', async () => {
		const fileContent = [
			'canvas_user_id,user_id,login_id,tag_name,canvas_tag_id,tag_set_name,canvas_tag_set_id',
			// An existing tag by its ID, by name within the existing set, and brand-new tags in a brand-new set.
			`${students[0]},,,,${tagIds['Above "grade" level']},,`,
			`,BATTERY-GRD-STU-002,,At level,,,${tagSetId}`,
			`,,grd.sandbox.student.003@example.edu,"Extra time, 150 %",,Accommodations,`,
			`${students[3]},,,"Extra time, 150 %",,Accommodations,`,
			`${students[4]},,,Quiet room 静,,Accommodations,`,
			// Not a student of the course: skipped.
			'99999999,,,Quiet room 静,,Accommodations,',
		].join('\n');
		const [progress] = await runOk({
			resource: 'groupCategory',
			operation: 'importDifferentiationTags',
			persona: 'teacher',
			params: { courseId, fileSource: 'text', fileContent },
		});
		expect(progress).toMatchObject({ tag: 'course_group_import', context_type: 'Course', context_id: Number(courseId) });
		const done = await waitForProgress(String(progress.id), 300_000);
		expect(done.workflow_state).toBe('completed');
		expect(JSON.parse(String(done.message))).toMatchObject({ users: 5, error: null });

		const sets = await tagSets();
		const accommodations = sets.find((set) => set.name === 'Accommodations') as Json;
		expect(accommodations).toMatchObject({ name: 'Accommodations', course_id: Number(courseId) });
		expect(sets).toHaveLength(2);
		const tags = await allTags();
		for (const tag of tags) tagIds[String(tag.name)] = Number(tag.id);
		expect(tags.map((tag) => tag.name).sort()).toEqual(['Above "grade" level', 'At level', 'Extra time, 150 %', 'Quiet room 静'].sort());
		expect(tags.filter((tag) => tag.group_category_id === accommodations.id).map((tag) => tag.name).sort()).toEqual(['Extra time, 150 %', 'Quiet room 静']);

		expect(await taggedWith(tagIds['Above "grade" level'])).toEqual([students[0]]);
		expect(await taggedWith(tagIds['At level'])).toEqual([students[1]]);
		expect(await taggedWith(tagIds['Extra time, 150 %'])).toEqual(sorted([students[2], students[3]]));
		expect(await taggedWith(tagIds['Quiet room 静'])).toEqual([students[4]]);
	});

	it('importDifferentiationTags (binary file): one import handles each student once', async () => {
		// Student 0 appears twice. Canvas takes the first row of a student and ignores the rest,
		// so a second tag for the same student needs a second import.
		const rows = [
			{ canvas_user_id: students[0], tag_name: 'Quiet room 静', tag_set_name: 'Accommodations' },
			{ canvas_user_id: students[0], tag_name: 'Extra time, 150 %', tag_set_name: 'Accommodations' },
			{ canvas_user_id: students[5], tag_name: 'Extra time, 150 %', tag_set_name: 'Accommodations' },
		];
		const chain = await runChain(
			[
				convertToCsvFile('tags.csv', 'tagFile'),
				canvasInChain({
					resource: 'groupCategory',
					operation: 'importDifferentiationTags',
					params: { courseId, fileSource: 'binaryData', binaryPropertyName: 'tagFile' },
				}),
			],
			rows,
		);
		expect(chain.failure).toBeUndefined();
		const done = await waitForProgress(String(chain.output('Canvas')[0].id), 300_000);
		expect(done.workflow_state).toBe('completed');
		expect(JSON.parse(String(done.message))).toMatchObject({ users: 2, error: null });

		expect(await taggedWith(tagIds['Quiet room 静'])).toEqual(sorted([students[0], students[4]]));
		expect(await taggedWith(tagIds['Extra time, 150 %'])).toEqual(sorted([students[2], students[3], students[5]]));
		// A tag of another set is not touched by the import.
		expect(await taggedWith(tagIds['Above "grade" level'])).toEqual([students[0]]);
	});

	it('getUserDifferentiationTags: the tag IDs of several users in one request', async () => {
		const [tags] = await runOk({
			resource: 'group',
			operation: 'getUserDifferentiationTags',
			persona: 'teacher',
			params: { courseId, userIds: ` ${students[0]}, ${students[2]} ,${students[7]},99999999,` },
		});
		const actual = await canvas().get<Json>(
			`/api/v1/courses/${courseId}/bulk_user_tags?user_ids[]=${students[0]}&user_ids[]=${students[2]}&user_ids[]=${students[7]}&user_ids[]=99999999`,
		);
		expect(Object.keys(tags).sort()).toEqual([students[0], students[2], students[7], 99999999].map(String).sort());
		for (const key of Object.keys(actual)) expect([...(tags[key] as number[])].sort(), key).toEqual([...(actual[key] as number[])].sort());
		expect([...(tags[String(students[0])] as number[])].sort()).toEqual([tagIds['Above "grade" level'], tagIds['Quiet room 静']].sort());
		expect(tags[String(students[2])]).toEqual([tagIds['Extra time, 150 %']]);
		// No tags, and not even in the course: empty lists, no error.
		expect(tags[String(students[7])]).toEqual([]);
		expect(tags['99999999']).toEqual([]);

		// One request per input item; IDs as numbers and as a list from an expression.
		const perItem = await runNode({
			resource: 'group',
			operation: 'getUserDifferentiationTags',
			items: [{ users: [students[1]] }, { users: students[4] }],
			params: { courseId: Number(courseId), userIds: '={{ $json.users }}' },
		});
		expect(perItem.success).toEqual([
			{ [String(students[1])]: [tagIds['At level']] },
			{ [String(students[4])]: [tagIds['Quiet room 静']] },
		]);
		expect(perItem.rawSuccess.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
	});

	it('getUserDifferentiationTags: no user IDs, and users who may not see tags', async () => {
		const empty = await runNode({
			resource: 'group',
			operation: 'getUserDifferentiationTags',
			params: { courseId, userIds: ' , ', ...eh },
		});
		expect(empty.success).toEqual([]);
		expect(empty.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', resource: 'group', operation: 'getUserDifferentiationTags' });
		expect(String(empty.error[0].errorMessage)).toContain('at least one user ID');

		const forbidden = await runNode({
			resource: 'group',
			operation: 'getUserDifferentiationTags',
			persona: 'student',
			params: { courseId, userIds: String(students[0]), ...eh },
		});
		expect(forbidden.success).toEqual([]);
		expect([401, 403]).toContain(forbidden.error[0].errorCode);

		const noCourse = await runNode({
			resource: 'group',
			operation: 'getUserDifferentiationTags',
			params: { courseId: '99999999', userIds: String(students[0]), ...eh },
		});
		expect(noCourse.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('exportDifferentiationTags: one item with the CSV text, one row per student and tag', async () => {
		const expected = await exportDirectly();
		const items = await runOk({ resource: 'groupCategory', operation: 'exportDifferentiationTags', persona: 'teacher', params: { courseId } });
		expect(items).toEqual([{ value: expected }]);

		const [header, ...rows] = parseCsv(String(items[0].value));
		expect(header).toEqual([
			'name',
			'canvas_user_id',
			'user_id',
			'login_id',
			'tag_name',
			'canvas_tag_id',
			'tag_id',
			'tag_set_name',
			'canvas_tag_set_id',
			'tag_set_id',
		]);
		const records = csvRecords(String(items[0].value));
		// Eight students; student 0 has two tags and therefore two rows.
		expect(rows).toHaveLength(9);
		const of = (userId: number): Array<Record<string, string>> => records.filter((r) => Number(r.canvas_user_id) === userId);
		expect(of(students[0]).map((r) => r.tag_name).sort()).toEqual(['Above "grade" level', 'Quiet room 静']);
		expect(of(students[2])).toHaveLength(1);
		expect(of(students[2])[0]).toMatchObject({
			tag_name: 'Extra time, 150 %',
			canvas_tag_id: String(tagIds['Extra time, 150 %']),
			tag_set_name: 'Accommodations',
			user_id: 'BATTERY-GRD-STU-003',
			login_id: 'grd.sandbox.student.003@example.edu',
		});
		// Students without a tag are listed with their name only.
		expect(of(students[7])).toHaveLength(1);
		expect(of(students[7])[0].tag_name).toBe('');

		// Canvas writes short rows for students without a tag (four columns under a header of ten),
		// which strict CSV readers refuse. n8n's Extract From File reads the file once it is told
		// to skip such rows; what is left are the tagged students.
		const strict = await runChain([
			canvasInChain({ resource: 'groupCategory', operation: 'exportDifferentiationTags', params: { courseId } }),
			convertToTextFile('value', 'tags.csv'),
			extractFromCsv(),
		]);
		expect(strict.failure).toContain('Invalid Record Length');
		const tolerant = await runChain([
			canvasInChain({ resource: 'groupCategory', operation: 'exportDifferentiationTags', params: { courseId } }),
			convertToTextFile('value', 'tags.csv'),
			extractFromCsv('data', SKIP_SHORT_ROWS),
		]);
		expect(tolerant.failure).toBeUndefined();
		const tagged = tolerant.output('From CSV File');
		expect(tagged).toHaveLength(7);
		expect(tagged.every((row) => row.tag_name !== '')).toBe(true);
	});

	it('exportDifferentiationTags [needs shared change]: the CSV is also attached as a binary file', async () => {
		const chain = await runChain([
			canvasInChain({ resource: 'groupCategory', operation: 'exportDifferentiationTags', params: { courseId } }),
			extractFromCsv('data', SKIP_SHORT_ROWS),
		]);
		const [exported] = chain.raw('Canvas');
		expect(exported.json.value).toBe(await exportDirectly());
		expect(exported.binary?.data).toMatchObject({ mimeType: 'text/csv', fileExtension: 'csv' });
		expect(chain.failure).toBeUndefined();
		expect(chain.output('From CSV File')).toHaveLength(7);
	});

	it('import and export need the account to allow differentiation tags; Canvas says "unauthorized" otherwise', async () => {
		for (const operation of ['importDifferentiationTags', 'exportDifferentiationTags']) {
			const refused = await runNode({
				resource: 'groupCategory',
				operation,
				params: {
					courseId: plainCourse.id,
					fileSource: 'text',
					fileContent: `canvas_user_id,tag_name\n${plainCourse.studentIds[0]},Not here`,
					...eh,
				},
			});
			expect(refused.success, operation).toEqual([]);
			expect(refused.error[0], operation).toMatchObject({ errorCode: 401, errorType: 'UNAUTHORIZED', resource: 'groupCategory', operation });
		}
		expect(await tagSets(plainCourse.id)).toEqual([]);

		// With the setting on, a user without rights in the course is still refused.
		for (const operation of ['importDifferentiationTags', 'exportDifferentiationTags']) {
			const forbidden = await runNode({
				resource: 'groupCategory',
				operation,
				persona: 'student',
				params: { courseId, fileSource: 'text', fileContent: `canvas_user_id,tag_name\n${students[6]},Not allowed`, ...eh },
			});
			expect(forbidden.success, operation).toEqual([]);
			expect([401, 403], operation).toContain(forbidden.error[0].errorCode);
		}
		expect(await taggedWith(tagIds['Above "grade" level'])).toEqual([students[0]]);

		const empty = await runNode({
			resource: 'groupCategory',
			operation: 'importDifferentiationTags',
			params: { courseId, fileSource: 'text', fileContent: '  ', ...eh },
		});
		expect(empty.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(empty.error[0].errorMessage)).toContain('File Content is empty');
	});
});
