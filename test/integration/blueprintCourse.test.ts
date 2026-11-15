import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, hasFixture, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { eventually, uploadFile } from './content.helper';

/**
 * Resource: blueprintCourse. The file builds its own blueprint course with
 * three courses to associate in a sub-account of its own, pushes two syncs
 * through the node and checks what arrives in the associated courses. The
 * seeded blueprint is only read.
 *
 * (Classic quizzes can be locked but do not travel with a sync here: copying
 * them needs Canvas' external QTI migration tool, which the local Canvas does
 * not have.)
 */
describe('blueprintCourse', () => {
	let accountId = '';
	let blueprintId = '';
	let templateId = '';
	let children: string[] = [];
	let outsiderId = '';
	const content: Record<string, string> = {};
	let firstMigrationId = '';
	let secondMigrationId = '';
	let blueprintName = '';

	const blueprint = (): string => `/api/v1/courses/${blueprintId}`;
	const template = (): string => `${blueprint()}/blueprint_templates/default`;
	const associated = async (): Promise<number[]> =>
		(await canvas().getAll<Json>(`${template()}/associated_courses`)).map((c) => c.id as number);

	/** Start a sync through the node and follow it through the node until Canvas has finished it. */
	async function sync(additionalFields: Json): Promise<Json> {
		const [started] = await runOk({
			resource: 'blueprintCourse',
			operation: 'beginMigration',
			params: { courseId: blueprintId, additionalFields },
		});
		expect(started).toMatchObject({ template_id: Number(templateId), user_id: Number(fx('adminUserId')) });
		expect(['queued', 'exporting', 'imports_queued', 'completed']).toContain(started.workflow_state);
		let latest = started;
		for (let attempt = 0; attempt < 90 && latest.workflow_state !== 'completed'; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			[latest] = await runOk({
				resource: 'blueprintCourse',
				operation: 'getMigration',
				params: { courseId: blueprintId, migrationId: String(started.id) },
			});
			expect(['queued', 'exporting', 'imports_queued', 'completed']).toContain(latest.workflow_state);
		}
		expect(latest.workflow_state).toBe('completed');
		return latest;
	}

	beforeAll(async () => {
		const account = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/sub_accounts`, {
			account: { name: unique('Blueprint battery account') },
		});
		accountId = String(account.id);
		blueprintName = unique('Battery blueprint');
		const course = await canvas().post<Json>(`/api/v1/accounts/${accountId}/courses`, {
			course: { name: blueprintName, license: 'cc_by_sa', hide_final_grades: true },
			offer: true,
		});
		blueprintId = String(course.id);
		await canvas().put(blueprint(), {
			course: { blueprint: true, blueprint_restrictions: { content: true, points: true } },
		});
		children = [];
		for (const label of ['one', 'two', 'three']) {
			const child = await canvas().post<Json>(`/api/v1/accounts/${accountId}/courses`, {
				course: { name: unique(`Battery associated course ${label}`) },
			});
			children.push(String(child.id));
		}
		const outsider = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique('Battery course outside the blueprint account') },
		});
		outsiderId = String(outsider.id);

		const lockedPage = await canvas().post<Json>(`${blueprint()}/pages`, {
			wiki_page: { title: 'Locked page', body: '<p>Locked page, version 1</p>', published: true },
		});
		content.lockedPage = String(lockedPage.page_id);
		const freePage = await canvas().post<Json>(`${blueprint()}/pages`, {
			wiki_page: { title: 'Free page', body: '<p>Free page, version 1</p>', published: true },
		});
		content.freePage = String(freePage.page_id);
		content.freePageUrl = String(freePage.url);
		const assignment = await canvas().post<Json>(`${blueprint()}/assignments`, {
			assignment: { name: 'Blueprint assignment', points_possible: 10, due_at: '2031-01-15T12:00:00Z', published: true },
		});
		content.assignment = String(assignment.id);
		const quiz = await canvas().post<Json>(`${blueprint()}/quizzes`, {
			quiz: { title: 'Blueprint quiz', quiz_type: 'practice_quiz', published: true },
		});
		content.quiz = String(quiz.id);
		const topic = await canvas().post<Json>(`${blueprint()}/discussion_topics`, {
			title: 'Blueprint discussion',
			message: '<p>Discuss</p>',
			published: true,
		});
		content.discussion = String(topic.id);
		const file = await uploadFile(`${blueprint()}/files`, 'blueprint-file.txt', 'blueprint file');
		content.file = String(file.id);
	});

	afterAll(async () => {
		for (const id of [...children, blueprintId, outsiderId]) {
			if (id) await canvas().request('DELETE', `/api/v1/courses/${id}?event=delete`);
		}
		if (accountId) {
			await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/sub_accounts/${accountId}`);
		}
	});

	it('getTemplate: by "default" and by template ID; a course that is no blueprint has none', async () => {
		const [byDefault] = await runOk({
			resource: 'blueprintCourse',
			operation: 'getTemplate',
			params: { courseId: blueprintId },
		});
		expect(byDefault).toMatchObject({ course_id: Number(blueprintId), associated_course_count: 0 });
		templateId = String(byDefault.id);
		expect(byDefault).toEqual(await canvas().get<Json>(template()));

		const [byId] = await runOk({
			resource: 'blueprintCourse',
			operation: 'getTemplate',
			items: [{ course: Number(blueprintId), template: Number(templateId) }],
			params: { courseId: '={{ $json.course }}', templateId: '={{ $json.template }}' },
		});
		expect(byId).toEqual(byDefault);

		const notABlueprint = await runNode({
			resource: 'blueprintCourse',
			operation: 'getTemplate',
			params: { courseId: children[0], errorHandling: { onError: 'continueWithError' } },
		});
		expect(notABlueprint.success).toEqual([]);
		expect(notABlueprint.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'blueprintCourse',
			operation: 'getTemplate',
		});
	});

	it('beginMigration: refused while no course is associated', async () => {
		const result = await runNode({
			resource: 'blueprintCourse',
			operation: 'beginMigration',
			params: { courseId: blueprintId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'beginMigration' });
		expect(String(result.error[0].errorMessage)).toContain('No associated courses to migrate to');
	});

	it('updateAssociations: adds and removes courses, in one call too', async () => {
		const [added] = await runOk({
			resource: 'blueprintCourse',
			operation: 'updateAssociations',
			params: { courseId: blueprintId, courseIdsToAdd: ` ${children[0]} , ${children[1]} ` },
		});
		expect(added).toEqual({ success: true });
		expect(await associated()).toEqual([children[0], children[1]].map(Number));

		// Add the third and remove the first; IDs arrive as numbers / arrays from expressions.
		await runOk({
			resource: 'blueprintCourse',
			operation: 'updateAssociations',
			items: [{ add: [Number(children[2])], remove: Number(children[0]) }],
			params: {
				courseId: blueprintId,
				templateId,
				courseIdsToAdd: '={{ $json.add }}',
				courseIdsToRemove: '={{ $json.remove }}',
			},
		});
		expect(await associated()).toEqual([children[1], children[2]].map(Number));

		// Adding a course that is already associated changes nothing.
		await runOk({
			resource: 'blueprintCourse',
			operation: 'updateAssociations',
			params: { courseId: blueprintId, courseIdsToAdd: children[1] },
		});
		expect(await associated()).toEqual([children[1], children[2]].map(Number));
		expect((await canvas().get<Json>(template())).associated_course_count).toBe(2);
	});

	it('updateAssociations: Canvas explains why a course cannot be associated', async () => {
		const outside = await runNode({
			resource: 'blueprintCourse',
			operation: 'updateAssociations',
			params: { courseId: blueprintId, courseIdsToAdd: outsiderId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(outside.success).toEqual([]);
		expect(outside.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'updateAssociations' });
		expect(String(outside.error[0].errorMessage)).toContain(`invalid courses to add (${outsiderId})`);

		const both = await runNode({
			resource: 'blueprintCourse',
			operation: 'updateAssociations',
			params: {
				courseId: blueprintId,
				courseIdsToAdd: children[0],
				courseIdsToRemove: children[0],
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(String(both.error[0].errorMessage)).toContain('cannot add and remove a course at the same time');
		expect(await associated()).toEqual([children[1], children[2]].map(Number));
	});

	it('getAssociatedCourses: lists the associated courses and pages through them', async () => {
		const expected = await canvas().getAll<Json>(`${template()}/associated_courses`);
		const courses = await runOk({
			resource: 'blueprintCourse',
			operation: 'getAssociatedCourses',
			params: { courseId: blueprintId },
		});
		expect(courses).toEqual(expected);
		expect(courses.map((c) => c.id)).toEqual([children[1], children[2]].map(Number));

		const onePage = await runOk({
			resource: 'blueprintCourse',
			operation: 'getAssociatedCourses',
			params: { courseId: blueprintId, pagination: { perPage: 1, maxPages: 1 } },
		});
		expect(onePage.map((c) => c.id)).toEqual([Number(children[1])]);

		if (hasFixture('blueprintCourseId')) {
			const seeded = await canvas().getAll<Json>(
				`/api/v1/courses/${fx('blueprintCourseId')}/blueprint_templates/default/associated_courses`,
			);
			const viaNode = await runOk({
				resource: 'blueprintCourse',
				operation: 'getAssociatedCourses',
				params: { courseId: fx('blueprintCourseId'), pagination: { perPage: 2, maxPages: 0 } },
			});
			expect(viaNode.map((c) => c.id)).toEqual(seeded.map((c) => c.id));
		}
	});

	it('setRestrictions: locks objects with the course defaults or with custom restrictions, and unlocks them', async () => {
		// Custom restrictions for the assignment.
		const [custom] = await runOk({
			resource: 'blueprintCourse',
			operation: 'setRestrictions',
			params: {
				courseId: blueprintId,
				contentType: 'assignment',
				contentId: content.assignment,
				restricted: true,
				restrictions: { content: false, points: true, due_dates: true, availability_dates: true, settings: false, state: false },
			},
		});
		expect(custom).toEqual({ success: true });
		// The course defaults (content + points) for the others.
		for (const [contentType, contentId] of [
			['wiki_page', content.lockedPage],
			['quiz', content.quiz],
			['discussion_topic', content.discussion],
			['attachment', content.file],
		]) {
			const [locked] = await runOk({
				resource: 'blueprintCourse',
				operation: 'setRestrictions',
				params: { courseId: blueprintId, contentType, contentId, restricted: true },
			});
			expect(locked).toEqual({ success: true });
		}

		const assignments = await canvas().getAll<Json>(`${blueprint()}/assignments`);
		expect(assignments.find((a) => String(a.id) === content.assignment)).toMatchObject({
			is_master_course_master_content: true,
			restricted_by_master_course: true,
			master_course_restrictions: { content: false, points: true, due_dates: true, availability_dates: true },
		});
		const pages = await canvas().getAll<Json>(`${blueprint()}/pages`);
		expect(pages.find((p) => String(p.page_id) === content.lockedPage)).toMatchObject({
			restricted_by_master_course: true,
			master_course_restrictions: { content: true, points: true },
		});
		expect(pages.find((p) => String(p.page_id) === content.freePage)).toMatchObject({ restricted_by_master_course: false });
		// (Canvas caches the quiz list per page size; a new page size per read gets fresh data.)
		let pageSize = 90;
		const lockedOf = async (path: string, id: string): Promise<unknown> =>
			(await canvas().get<Json[]>(`${blueprint()}/${path}?per_page=${pageSize--}`)).find((o) => String(o.id) === id)
				?.restricted_by_master_course;
		expect(await lockedOf('quizzes', content.quiz)).toBe(true);
		expect(await lockedOf('discussion_topics', content.discussion)).toBe(true);
		expect(await lockedOf('files', content.file)).toBe(true);

		// Unlock the quiz again ("Restricted" switched off arrives as a boolean false).
		const [unlocked] = await runOk({
			resource: 'blueprintCourse',
			operation: 'setRestrictions',
			params: { courseId: blueprintId, contentType: 'quiz', contentId: content.quiz, restricted: false },
		});
		expect(unlocked).toEqual({ success: true });
		expect(await lockedOf('quizzes', content.quiz)).toBe(false);

		const missing = await runNode({
			resource: 'blueprintCourse',
			operation: 'setRestrictions',
			params: {
				courseId: blueprintId,
				contentType: 'assignment',
				contentId: '99999999',
				restricted: true,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'setRestrictions' });
		expect(String(missing.error[0].errorMessage)).toContain('Could not find content: assignment 99999999');
	});

	it('getUnsyncedChanges: before the first sync everything is pending', async () => {
		const expected = await canvas().get<Json[]>(`${template()}/unsynced_changes`);
		const changes = await runOk({
			resource: 'blueprintCourse',
			operation: 'getUnsyncedChanges',
			params: { courseId: blueprintId },
		});
		expect(changes).toEqual(expected);
		// Canvas reports the pending first sync as one change record for the whole course.
		expect(changes).toEqual([{ asset_name: blueprintName, change_type: 'initial_sync' }]);
	});

	it('beginMigration: the first sync fills the associated courses (every option set)', async () => {
		const migration = await sync({
			comment: 'First sync by the battery – "quoted" & <b>tags</b> 🚀',
			send_notification: true,
			copy_settings: true,
			publish_after_initial_sync: true,
			send_item_notifications: true,
		});
		firstMigrationId = String(migration.id);
		expect(migration).toMatchObject({
			comment: 'First sync by the battery – "quoted" & <b>tags</b> 🚀',
			workflow_state: 'completed',
		});
		expect(migration.imports_completed_at).toBeTypeOf('string');

		for (const child of [children[1], children[2]]) {
			const api = `/api/v1/courses/${child}`;
			const pages = await eventually(async () => {
				const list = await canvas().getAll<Json>(`${api}/pages`);
				return list.length >= 2 ? list : undefined;
			}, `pages in course ${child}`);
			expect(pages.map((p) => p.title).sort()).toEqual(['Free page', 'Locked page']);
			expect(pages.find((p) => p.title === 'Locked page')).toMatchObject({
				is_master_course_child_content: true,
				restricted_by_master_course: true,
			});
			const assignments = await canvas().getAll<Json>(`${api}/assignments`);
			expect(assignments.find((a) => a.name === 'Blueprint assignment')).toMatchObject({
				points_possible: 10,
				due_at: '2031-01-15T12:00:00Z',
				restricted_by_master_course: true,
				master_course_restrictions: { content: false, points: true, due_dates: true, availability_dates: true },
			});
			const topics = await canvas().getAll<Json>(`${api}/discussion_topics`);
			expect(topics.map((t) => t.title)).toEqual(['Blueprint discussion']);
			expect(topics[0]).toMatchObject({ is_master_course_child_content: true, restricted_by_master_course: true });
			expect((await canvas().getAll<Json>(`${api}/files`)).map((f) => f.display_name)).toEqual(['blueprint-file.txt']);
			// "Copy Settings" brought the course settings along, "Publish After Initial Sync" published the course.
			const course = await canvas().get<Json>(api);
			expect(course).toMatchObject({ workflow_state: 'available', license: 'cc_by_sa', hide_final_grades: true });
		}
		// The course that was removed from the blueprint before the sync got nothing.
		expect(await canvas().getAll<Json>(`/api/v1/courses/${children[0]}/pages`)).toEqual([]);
		expect(await canvas().get<Json>(template())).toMatchObject({ associated_course_count: 2 });
		// Nothing is left to sync (Canvas keeps reporting the folder the file was uploaded into).
		const unsynced = await canvas().get<Json[]>(`${template()}/unsynced_changes`);
		expect(unsynced.filter((c) => c.asset_type !== 'folder')).toEqual([]);
	});

	it('beginMigration: a second sync pushes changes, but keeps local edits of unlocked content', async () => {
		// Course "two" edits its copy of the unlocked page; then the blueprint changes both pages.
		await canvas().put(`/api/v1/courses/${children[1]}/pages/${content.freePageUrl}`, {
			wiki_page: { body: '<p>Free page, edited in the associated course</p>' },
		});
		await canvas().put(`${blueprint()}/pages/${content.freePageUrl}`, {
			wiki_page: { body: '<p>Free page, version 2</p>' },
		});
		await canvas().put(`${blueprint()}/pages/locked-page`, { wiki_page: { body: '<p>Locked page, version 2</p>' } });
		// A changed course setting, which this sync is told not to copy.
		await canvas().put(blueprint(), { course: { license: 'public_domain' } });

		const pending = await runOk({
			resource: 'blueprintCourse',
			operation: 'getUnsyncedChanges',
			params: { courseId: blueprintId },
		});
		expect(pending).toEqual(await canvas().get<Json[]>(`${template()}/unsynced_changes`));
		const pendingPages = Object.fromEntries(
			pending.filter((c) => c.asset_type === 'wiki_page').map((c) => [String(c.asset_name), c]),
		);
		expect(Object.keys(pendingPages).sort()).toEqual(['Free page', 'Locked page']);
		expect(pendingPages['Locked page']).toMatchObject({ change_type: 'updated', locked: true });
		expect(pendingPages['Free page']).toMatchObject({ change_type: 'updated', locked: false });

		// The options switched off explicitly this time.
		const migration = await sync({ comment: 'Second sync', send_notification: false, copy_settings: false });
		secondMigrationId = String(migration.id);

		const body = async (course: string, url: string): Promise<string> =>
			String((await canvas().get<Json>(`/api/v1/courses/${course}/pages/${url}`)).body);
		await eventually(
			async () => (await body(children[2], content.freePageUrl)).includes('version 2'),
			'the second sync to reach course three',
		);
		expect(await body(children[2], 'locked-page')).toContain('Locked page, version 2');
		expect(await body(children[1], 'locked-page')).toContain('Locked page, version 2');
		// The locally edited, unlocked page is an exception: it keeps its own content.
		expect(await body(children[1], content.freePageUrl)).toContain('edited in the associated course');
		// "Copy Settings" was off: the associated courses keep the license of the first sync.
		expect((await canvas().get<Json>(`/api/v1/courses/${children[2]}`)).license).toBe('cc_by_sa');
	});

	it('getAllMigrations, getMigration, getMigrationDetails: the sync history of the blueprint', async () => {
		const expected = await canvas().getAll<Json>(`${template()}/migrations`);
		const migrations = await runOk({
			resource: 'blueprintCourse',
			operation: 'getAllMigrations',
			params: { courseId: blueprintId },
		});
		expect(migrations.map((m) => String(m.id))).toEqual([secondMigrationId, firstMigrationId]);
		expect(migrations).toEqual(expected);
		expect(migrations.map((m) => m.comment)).toEqual(['Second sync', 'First sync by the battery – "quoted" & <b>tags</b> 🚀']);

		const newest = await runOk({
			resource: 'blueprintCourse',
			operation: 'getAllMigrations',
			params: { courseId: blueprintId, templateId, pagination: { perPage: 1, maxPages: 1 } },
		});
		expect(newest.map((m) => String(m.id))).toEqual([secondMigrationId]);

		const result = await runNode({
			resource: 'blueprintCourse',
			operation: 'getMigration',
			items: [{ id: Number(firstMigrationId) }, { id: '99999999' }],
			params: { courseId: blueprintId, migrationId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toHaveLength(1);
		expect(result.success[0]).toMatchObject({ id: Number(firstMigrationId), workflow_state: 'completed', template_id: Number(templateId) });
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getMigration' });

		// The first sync copied everything, so it has no list of individual changes.
		const firstDetails = await runOk({
			resource: 'blueprintCourse',
			operation: 'getMigrationDetails',
			params: { courseId: blueprintId, migrationId: firstMigrationId },
		});
		expect(firstDetails).toEqual([]);

		const expectedDetails = await canvas().getAll<Json>(`${template()}/migrations/${secondMigrationId}/details`);
		const details = await runOk({
			resource: 'blueprintCourse',
			operation: 'getMigrationDetails',
			params: { courseId: blueprintId, migrationId: secondMigrationId },
		});
		expect(details).toEqual(expectedDetails);
		const byName = Object.fromEntries(details.map((d) => [String(d.asset_name), d]));
		expect(byName['Locked page']).toMatchObject({ asset_type: 'wiki_page', change_type: 'updated', locked: true, exceptions: [] });
		// Course "two" kept its own version of the unlocked page.
		expect(byName['Free page']).toMatchObject({ change_type: 'updated', locked: false });
		expect(byName['Free page'].exceptions).toEqual([
			expect.objectContaining({ course_id: Number(children[1]), conflicting_changes: ['content'] }),
		]);
	});

	it('getSubscriptions, getAllImports, showImport, getImportDetails: the same history seen from an associated course', async () => {
		const child = children[1];
		const [subscription] = await runOk({
			resource: 'blueprintCourse',
			operation: 'getSubscriptions',
			params: { courseId: child },
		});
		expect(subscription).toMatchObject({
			template_id: Number(templateId),
			blueprint_course: { id: Number(blueprintId) },
		});
		const subscriptionId = String(subscription.id);

		const expectedImports = await canvas().getAll<Json>(`/api/v1/courses/${child}/blueprint_subscriptions/default/migrations`);
		const imports = await runOk({
			resource: 'blueprintCourse',
			operation: 'getAllImports',
			params: { courseId: child },
		});
		expect(imports).toEqual(expectedImports);
		expect(imports.map((i) => i.comment)).toEqual(['Second sync', 'First sync by the battery – "quoted" & <b>tags</b> 🚀']);
		expect(imports.every((i) => i.subscription_id === Number(subscriptionId) && i.workflow_state === 'completed')).toBe(true);

		const bySubscription = await runOk({
			resource: 'blueprintCourse',
			operation: 'getAllImports',
			params: { courseId: child, subscriptionId, pagination: { perPage: 1, maxPages: 1 } },
		});
		expect(bySubscription.map((i) => i.id)).toEqual([imports[0].id]);

		const [shown] = await runOk({
			resource: 'blueprintCourse',
			operation: 'showImport',
			params: { courseId: child, subscriptionId, migrationId: String(imports[0].id) },
		});
		expect(shown).toEqual(imports[0]);

		const expectedDetails = await canvas().getAll<Json>(
			`/api/v1/courses/${child}/blueprint_subscriptions/default/migrations/${String(imports[0].id)}/details`,
		);
		const details = await runOk({
			resource: 'blueprintCourse',
			operation: 'getImportDetails',
			params: { courseId: child, migrationId: String(imports[0].id) },
		});
		expect(details).toEqual(expectedDetails);
		const byName = Object.fromEntries(details.map((d) => [String(d.asset_name), d]));
		expect(byName['Locked page']).toMatchObject({ change_type: 'updated', locked: true, exceptions: [] });
		expect(byName['Free page'].exceptions).toEqual([expect.objectContaining({ conflicting_changes: ['content'] })]);

		// A course without a blueprint has no subscriptions; the blueprint's own migration ID is not an import ID.
		expect(
			await runOk({ resource: 'blueprintCourse', operation: 'getSubscriptions', params: { courseId: children[0] } }),
		).toEqual([]);
		const wrongId = await runNode({
			resource: 'blueprintCourse',
			operation: 'showImport',
			params: { courseId: child, migrationId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(wrongId.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'showImport' });
	});

	it('errors: teachers of an associated course and students have no access to the blueprint', async () => {
		for (const operation of ['getTemplate', 'getAllMigrations', 'getUnsyncedChanges', 'beginMigration']) {
			const result = await runNode({
				resource: 'blueprintCourse',
				operation,
				persona: 'student',
				params: { courseId: blueprintId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error[0], operation).toMatchObject({ errorType: 'FORBIDDEN', operation });
			expect([401, 403]).toContain(result.error[0].errorCode);
		}
	});

	it('updateAssociations: removing the courses ends their subscriptions', async () => {
		await runOk({
			resource: 'blueprintCourse',
			operation: 'updateAssociations',
			params: { courseId: blueprintId, courseIdsToRemove: `${children[1]},${children[2]}` },
		});
		expect(await associated()).toEqual([]);
		expect(await canvas().get<Json[]>(`/api/v1/courses/${children[1]}/blueprint_subscriptions`)).toEqual([]);
		// The content that was synced stays in the course.
		expect((await canvas().getAll<Json>(`/api/v1/courses/${children[1]}/pages`)).length).toBe(2);
	});
});
