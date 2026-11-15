import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { sandboxSubAccount } from './support/commsSandbox';
import {
	canvas as canvasInChain,
	convertToCsvFile,
	convertToTextFile,
	csvField,
	csvRecords,
	extractFromCsv,
	parseCsv,
	runChain,
} from './support/fileNodes';
import { createSandboxCourse, deleteSandboxCourse, waitForProgress } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: groupCategory, the CSV operations Export and Import. A course of this
 * file's own with twelve students (four of them in a second section as well), the
 * teacher persona as its teacher, and group categories the tests create in it.
 */
describe('groupCategory: export and import (CSV)', () => {
	let course: SandboxCourse;
	let courseId = '';
	let students: Json[] = [];
	let categoryId = '';
	let sisCategoryId = '';
	const groupIds: Record<string, string> = {};
	const eh = { errorHandling: { onError: 'continueWithError' } };

	const HEADER = ['name', 'canvas_user_id', 'user_id', 'login_id', 'sections', 'group_name', 'canvas_group_id', 'group_id'];

	const groupsOf = (id: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/group_categories/${id}/groups`);
	const membersOf = async (groupId: string | number): Promise<number[]> =>
		(await canvas().getAll<Json>(`/api/v1/groups/${groupId}/users`)).map((u) => Number(u.id)).sort((a, b) => a - b);
	/** group name -> sorted member IDs, for every group of the category. */
	const membership = async (id: string): Promise<Record<string, number[]>> => {
		const out: Record<string, number[]> = {};
		for (const group of await groupsOf(id)) out[String(group.name)] = await membersOf(String(group.id));
		return out;
	};
	const exportDirectly = async (id: string): Promise<string> =>
		String((await canvas().request('GET', `/api/v1/group_categories/${id}/export`)).data);
	const newCategory = async (name: string, extra: Json = {}): Promise<string> =>
		String((await canvas().post<Json>(`/api/v1/courses/${courseId}/group_categories`, { name: unique(name), ...extra })).id);
	const finished = async (progress: Json): Promise<Json> => {
		expect(progress).toMatchObject({ tag: 'course_group_import', context_type: 'GroupCategory' });
		return waitForProgress(String(progress.id), 300_000);
	};
	const student = (index: number): number => Number(students[index].id);

	beforeAll(async () => {
		course = await createSandboxCourse('group-csv', {
			students: 12,
			personas: ['teacher'],
			accountId: await sandboxSubAccount(),
		});
		courseId = course.id;
		const sectionB = await canvas().post<Json>(`/api/v1/courses/${courseId}/sections`, { course_section: { name: 'Section "B", evening' } });
		for (const userId of course.studentIds.slice(0, 4)) {
			await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
				enrollment: { user_id: userId, type: 'StudentEnrollment', enrollment_state: 'active', course_section_id: sectionB.id, notify: false },
			});
		}
		// Canvas lists the students by sortable name; keep them in the order of their IDs here.
		students = (await canvas().getAll<Json>(`/api/v1/courses/${courseId}/users?enrollment_type[]=student`)).sort(
			(a, b) => Number(a.id) - Number(b.id),
		);
		expect(students).toHaveLength(12);

		sisCategoryId = unique('GC-CSV').replace(/\s/g, '-');
		categoryId = await newCategory('Lab teams', { sis_group_category_id: sisCategoryId });
		for (const [key, name, sis] of [
			['alpha', 'Team α', unique('GRP-A').replace(/\s/g, '-')],
			['b', 'Team "B", second', ''],
			['empty', 'Empty team', ''],
		]) {
			const group = await canvas().post<Json>(`/api/v1/group_categories/${categoryId}/groups`, { name, ...(sis ? { sis_group_id: sis } : {}) });
			groupIds[key] = String(group.id);
		}
		await canvas().put(`/api/v1/groups/${groupIds.alpha}`, { members: [0, 1, 2, 3, 4].map(student) });
		await canvas().put(`/api/v1/groups/${groupIds.b}`, { members: [5, 6, 7, 8].map(student) });
	}, 900_000);

	afterAll(async () => {
		await deleteSandboxCourse(course);
	}, 300_000);

	// ---------------------------------------------------------------- export

	it('export: one item with the CSV text Canvas produces, every student of the course in it', async () => {
		const expected = await exportDirectly(categoryId);
		const items = await runOk({ resource: 'groupCategory', operation: 'export', params: { groupCategoryId: categoryId } });
		expect(items).toHaveLength(1);
		expect(items[0]).toEqual({ value: expected });

		const [header, ...rows] = parseCsv(String(items[0].value));
		expect(header).toEqual(HEADER);
		expect(rows).toHaveLength(12);
		const records = csvRecords(String(items[0].value));
		// Sorted by sortable name, which is quoted because of its comma.
		expect(records.map((r) => r.name)).toEqual([...records.map((r) => r.name)].sort((a, b) => a.localeCompare(b)));
		expect(records.every((r) => /^\d+, Grading Sandbox Student$/.test(r.name))).toBe(true);

		const alphaGroup = await canvas().get<Json>(`/api/v1/groups/${groupIds.alpha}`);
		const byUser = new Map(records.map((r) => [Number(r.canvas_user_id), r]));
		for (const index of [0, 1, 2, 3, 4]) {
			expect(byUser.get(student(index))).toMatchObject({
				group_name: 'Team α',
				canvas_group_id: groupIds.alpha,
				group_id: alphaGroup.sis_group_id,
				user_id: students[index].sis_user_id,
				login_id: students[index].login_id,
			});
		}
		for (const index of [5, 6, 7, 8]) {
			expect(byUser.get(student(index))).toMatchObject({ group_name: 'Team "B", second', canvas_group_id: groupIds.b, group_id: '' });
		}
		// Students who are in no group of the category are listed without one.
		for (const index of [9, 10, 11]) {
			expect(byUser.get(student(index))).toMatchObject({ group_name: '', canvas_group_id: '', group_id: '' });
		}
		// A student in two sections has both of them in one cell (in no particular order).
		for (const userId of course.studentIds.slice(0, 4)) {
			expect(byUser.get(userId)?.sections).toContain('Section "B", evening');
			expect(byUser.get(userId)?.sections).toContain(' and ');
		}
		for (const userId of course.studentIds.slice(4)) {
			expect(byUser.get(userId)?.sections).not.toContain('Section "B"');
			expect(byUser.get(userId)?.sections).not.toBe('');
		}
	});

	it('export: by SIS ID, as the teacher, and for several input items', async () => {
		const expected = await exportDirectly(categoryId);
		const [bySis] = await runOk({
			resource: 'groupCategory',
			operation: 'export',
			persona: 'teacher',
			params: { groupCategoryId: `sis_group_category_id:${sisCategoryId}` },
		});
		expect(bySis.value).toBe(expected);

		// Nobody is in a group of this category: Canvas leaves the group ID columns out altogether.
		const unused = await newCategory('Nobody assigned', { create_group_count: 2, self_signup: 'enabled' });
		const result = await runNode({
			resource: 'groupCategory',
			operation: 'export',
			items: [{ id: Number(categoryId) }, { id: 99999999 }, { id: Number(unused) }],
			params: { groupCategoryId: '={{ $json.id }}', ...eh },
		});
		expect(result.success).toHaveLength(2);
		expect(result.rawSuccess.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(result.success[0].value).toBe(expected);
		const [header, ...rows] = parseCsv(String(result.success[1].value));
		expect(header).toEqual(['name', 'canvas_user_id', 'user_id', 'login_id', 'sections', 'group_name']);
		expect(rows).toHaveLength(12);
		expect(rows.every((row) => row[5] === '')).toBe(true);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'groupCategory',
			operation: 'export',
			originalItem: { id: 99999999 },
		});
	});

	it('export + n8n file nodes: Convert to File and Extract From File turn the text into one item per student', async () => {
		const chain = await runChain([
			canvasInChain({ resource: 'groupCategory', operation: 'export', params: { groupCategoryId: categoryId } }),
			convertToTextFile('value', 'lab-teams.csv'),
			extractFromCsv(),
		]);
		expect(chain.failure).toBeUndefined();
		const rows = chain.output('From CSV File');
		expect(rows).toHaveLength(12);
		expect(Object.keys(rows[0])).toEqual(HEADER);
		expect(rows.filter((row) => row.group_name === 'Team α').map((row) => Number(row.canvas_user_id)).sort((a, b) => a - b)).toEqual(
			[0, 1, 2, 3, 4].map(student),
		);
	});

	it('export [needs shared change]: the CSV is also attached as a binary file, ready for Extract From File', async () => {
		const chain = await runChain([
			canvasInChain({ resource: 'groupCategory', operation: 'export', params: { groupCategoryId: categoryId } }),
			extractFromCsv('data'),
		]);
		const [exported] = chain.raw('Canvas');
		// The text stays where it is today ...
		expect(exported.json.value).toBe(await exportDirectly(categoryId));
		// ... and the file comes with it.
		expect(exported.binary?.data).toMatchObject({ mimeType: 'text/csv', fileExtension: 'csv' });
		expect(String((exported.binary?.data as Json).fileName)).toMatch(/\.csv$/);
		expect(chain.failure).toBeUndefined();
		expect(chain.output('From CSV File')).toHaveLength(12);
	});

	// ---------------------------------------------------------------- import

	it('import (text): creates the groups that are named, puts students into them and moves the others', async () => {
		const target = await newCategory('Imported from text');
		const existing = await canvas().post<Json>(`/api/v1/group_categories/${target}/groups`, { name: 'Already there' });
		const withSisId = await canvas().post<Json>(`/api/v1/group_categories/${target}/groups`, {
			name: 'Known by SIS ID',
			sis_group_id: unique('GRP-SIS').replace(/\s/g, '-'),
		});
		await canvas().put(`/api/v1/groups/${String(existing.id)}`, { members: [0, 1].map(student) });

		// Every way to name a student (Canvas ID, SIS ID, login) and a group (name, Canvas ID, SIS ID).
		const fileContent = [
			'canvas_user_id,user_id,login_id,group_name,canvas_group_id,group_id',
			`${student(0)},,,${csvField('Équipe "Zoë", 東京 🧪')},,`,
			`,${String(students[2].sis_user_id)},,${csvField('Équipe "Zoë", 東京 🧪')},,`,
			`,,${String(students[3].login_id)},,${String(existing.id)},`,
			`${student(4)},,,,,${String(withSisId.sis_group_id)}`,
			`${student(5)},,,Second new team,,`,
		].join('\n');
		const [progress] = await runOk({
			resource: 'groupCategory',
			operation: 'import',
			persona: 'teacher',
			params: { groupCategoryId: target, fileSource: 'text', fileContent },
		});
		expect(progress).toMatchObject({ context_id: Number(target), workflow_state: 'queued' });
		expect(String(progress.url)).toContain(`/api/v1/progress/${String(progress.id)}`);

		const done = await finished(progress);
		expect(done.workflow_state).toBe('completed');
		expect(JSON.parse(String(done.message))).toEqual({ type: 'import_groups', groups: 4, users: 5, error: null });
		expect(await membership(target)).toEqual({
			// Student 0 was moved out, student 3 came in, student 1 stayed.
			'Already there': [student(1), student(3)].sort((a, b) => a - b),
			'Known by SIS ID': [student(4)],
			'Équipe "Zoë", 東京 🧪': [student(0), student(2)].sort((a, b) => a - b),
			'Second new team': [student(5)],
		});
	});

	it('import (binary file): a CSV file made by Convert to File, taken from the binary field that is named', async () => {
		const target = await newCategory('Imported from a file');
		const rows = [
			{ canvas_user_id: student(6), group_name: 'File team "one", north' },
			{ canvas_user_id: student(7), group_name: 'File team "one", north' },
			{ canvas_user_id: student(8), group_name: 'File team 二' },
		];
		const chain = await runChain(
			[
				convertToCsvFile('teams.csv', 'groupFile'),
				canvasInChain({
					resource: 'groupCategory',
					operation: 'import',
					params: { groupCategoryId: target, fileSource: 'binaryData', binaryPropertyName: 'groupFile' },
				}),
			],
			rows,
		);
		expect(chain.failure).toBeUndefined();
		const [progress] = chain.output('Canvas');
		expect((await finished(progress)).workflow_state).toBe('completed');
		expect(await membership(target)).toEqual({
			'File team "one", north': [student(6), student(7)].sort((a, b) => a - b),
			'File team 二': [student(8)],
		});

		// Round trip: what Export returns is what Import accepts. Everyone changes sides.
		const exported = csvRecords(await exportDirectly(target)).filter((row) => row.group_name !== '');
		expect(exported).toHaveLength(3);
		const swapped = exported.map((row) => ({
			...row,
			group_name: row.group_name === 'File team 二' ? 'File team "one", north' : 'File team 二',
			canvas_group_id: '',
		}));
		const second = await runChain(
			[
				convertToCsvFile('teams-swapped.csv'),
				canvasInChain({ resource: 'groupCategory', operation: 'import', params: { groupCategoryId: target } }),
			],
			swapped,
		);
		expect(second.failure).toBeUndefined();
		expect((await finished(second.output('Canvas')[0])).workflow_state).toBe('completed');
		expect(await membership(target)).toEqual({
			'File team "one", north': [student(8)],
			'File team 二': [student(6), student(7)].sort((a, b) => a - b),
		});
	});

	it('import: rows Canvas cannot use are skipped without an error; a file it cannot read fails the job, not the request', async () => {
		const target = await newCategory('Imported with problems');
		const fileContent = [
			// A byte order mark and Windows line ends, as Excel writes them.
			'﻿canvas_user_id,group_name',
			`${student(9)},First row wins`,
			// The same student again: only the first row counts.
			`${student(9)},Second row loses`,
			// Not a student of the course, an unknown user, a row without a group.
			`${String((await canvas().get<Json>('/api/v1/users/self')).id)},First row wins`,
			'99999999,First row wins',
			`${student(10)},`,
		].join('\r\n');
		const [progress] = await runOk({
			resource: 'groupCategory',
			operation: 'import',
			items: [{ csv: fileContent }],
			params: { groupCategoryId: Number(target), fileSource: 'text', fileContent: '={{ $json.csv }}' },
		});
		const done = await finished(progress);
		expect(done.workflow_state).toBe('completed');
		expect(JSON.parse(String(done.message))).toMatchObject({ users: 1, error: null });
		expect(await membership(target)).toEqual({ 'First row wins': [student(9)], 'Second row loses': [] });

		// Semicolons instead of commas: Canvas finds no column it knows, imports nothing and still reports success.
		const [semicolons] = await runOk({
			resource: 'groupCategory',
			operation: 'import',
			params: { groupCategoryId: target, fileSource: 'text', fileContent: `canvas_user_id;group_name\n${student(11)};Semicolon team` },
		});
		const nothing = await finished(semicolons);
		expect(nothing.workflow_state).toBe('completed');
		expect(JSON.parse(String(nothing.message))).toEqual({ type: 'import_groups', groups: 0, users: 0, error: null });
		expect(Object.keys(await membership(target)).sort()).toEqual(['First row wins', 'Second row loses']);

		// Broken CSV is accepted by the request; the background job fails.
		const [broken] = await runOk({
			resource: 'groupCategory',
			operation: 'import',
			params: { groupCategoryId: target, fileSource: 'text', fileContent: `canvas_user_id,group_name\n${student(11)},"never closed` },
		});
		expect((await finished(broken)).workflow_state).toBe('failed');
		expect(Object.keys(await membership(target)).sort()).toEqual(['First row wins', 'Second row loses']);
	});

	// ---------------------------------------------------------------- errors

	it('errors: no file, missing rights, unknown category', async () => {
		const target = await newCategory('Not imported into');

		const empty = await runNode({
			resource: 'groupCategory',
			operation: 'import',
			params: { groupCategoryId: target, fileSource: 'text', fileContent: ' \n', ...eh },
		});
		expect(empty.success).toEqual([]);
		expect(empty.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', operation: 'import' });
		expect(String(empty.error[0].errorMessage)).toContain('File Content is empty');

		// The default file source is a binary field, and the input item has none.
		const noFile = await runNode({
			resource: 'groupCategory',
			operation: 'import',
			params: { groupCategoryId: target, ...eh },
		});
		expect(noFile.success).toEqual([]);
		expect(noFile.error).toHaveLength(1);
		expect(String(noFile.error[0].errorMessage)).toMatch(/binary/i);

		// The student persona has nothing to do with this course.
		for (const operation of ['export', 'import']) {
			const forbidden = await runNode({
				resource: 'groupCategory',
				operation,
				persona: 'student',
				params: { groupCategoryId: target, fileSource: 'text', fileContent: `canvas_user_id,group_name\n${student(0)},Not allowed`, ...eh },
			});
			expect(forbidden.success, operation).toEqual([]);
			expect([401, 403], operation).toContain(forbidden.error[0].errorCode);
			expect(forbidden.error[0], operation).toMatchObject({ resource: 'groupCategory', operation });
		}
		expect(await groupsOf(target)).toEqual([]);

		const missing = await runNode({
			resource: 'groupCategory',
			operation: 'import',
			params: { groupCategoryId: '99999999', fileSource: 'text', fileContent: 'canvas_user_id,group_name\n1,x', ...eh },
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', endpoint: '/api/v1/group_categories/99999999/import' });
	});
});
