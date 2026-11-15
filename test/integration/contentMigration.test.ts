import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { eventually, makeZip, postToUploadSlot, uploadFile, waitForProgress } from './content.helper';
import { createTokenPersona } from './lti-advantage.helper';
import { asUser, createUserWithToken, deleteUser } from './own-users.helper';
import type { OwnUser } from './own-users.helper';

/**
 * Resource: contentMigration. Migrations are background jobs: the tests start
 * them through the node, follow them with the node's Progress > Get and then
 * look into the destination to see what really arrived.
 *
 * (Classic quizzes are left out: copying them needs Canvas' external QTI
 * migration tool, which the local Canvas does not have.)
 */
describe('contentMigration', () => {
	let sourceId = '';
	let accountId = '';
	let groupId = '';
	let owner: OwnUser | undefined;
	let removePersona: (() => Promise<void>) | undefined;
	const persona = 'migrationOwner';
	const source: Record<string, string> = {};
	const courses: string[] = [];
	let fullCopyCourseId = '';
	let fullCopyMigrationId = '';
	let exportId = '';

	const newCourse = async (label: string): Promise<string> => {
		const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique(`Migration battery ${label}`) },
		});
		courses.push(String(course.id));
		return String(course.id);
	};
	const titles = async (courseId: string, path: string, field = 'title'): Promise<string[]> =>
		(await canvas().getAll<Json>(`/api/v1/courses/${courseId}/${path}`)).map((o) => String(o[field])).sort();
	/** The settings Canvas stored for a migration (visible to site admins). */
	const storedSettings = async (context: string, migrationId: unknown): Promise<Json> =>
		((await canvas().get<Json>(`${context}/content_migrations/${String(migrationId)}`)).audit_info as Json)
			.migration_settings as Json;

	/** The selective-import property of the entry with this title (read from Canvas directly). */
	const selectableProperty = async (contextPath: string, migrationId: string, type: string, title: string): Promise<string> => {
		const list = await canvas().get<Json[]>(`${contextPath}/content_migrations/${migrationId}/selective_data?type=${type}`);
		const flat = list.flatMap((entry) => [entry, ...((entry.sub_items as Json[] | undefined) ?? [])]);
		const found = flat.find((entry) => entry.title === title);
		if (!found) throw new Error(`nothing selectable named ${title}: ${JSON.stringify(list).slice(0, 300)}`);
		return String(found.property);
	};
	/** Start a migration through the node and follow it to the end through the node. */
	async function migrate(params: Json, runAs?: string, items?: Json[]): Promise<Json> {
		const [created] = await runOk({ resource: 'contentMigration', operation: 'create', persona: runAs, items, params });
		expect(created.progress_url, 'a migration reports where to follow its progress').toBeTypeOf('string');
		await waitForProgress(created.progress_url, { persona: runAs });
		return created;
	}

	beforeAll(async () => {
		const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique('Migration battery source'), license: 'cc_by', syllabus_body: '<p>Source syllabus</p>' },
			offer: true,
		});
		sourceId = String(course.id);
		courses.push(sourceId);
		const api = `/api/v1/courses/${sourceId}`;
		for (const key of ['alpha', 'beta']) {
			const page = await canvas().post<Json>(`${api}/pages`, {
				wiki_page: { title: `Copy page ${key}`, body: `<p>Page ${key} – Ünïcødé 页 "quoted" &amp; more</p>`, published: true },
			});
			source[`page_${key}`] = String(page.page_id);
			source[`page_${key}_url`] = String(page.url);
		}
		const group = await canvas().post<Json>(`${api}/assignment_groups`, { name: 'Source group' });
		// 2030-03-04 is a Monday.
		const alpha = await canvas().post<Json>(`${api}/assignments`, {
			assignment: { name: 'Copy assignment alpha', points_possible: 10, due_at: '2030-03-04T18:00:00Z', assignment_group_id: group.id, published: true },
		});
		source.assignment_alpha = String(alpha.id);
		const beta = await canvas().post<Json>(`${api}/assignments`, {
			assignment: { name: 'Copy assignment beta', points_possible: 20, due_at: '2030-04-10T18:00:00Z', published: true },
		});
		source.assignment_beta = String(beta.id);
		const topic = await canvas().post<Json>(`${api}/discussion_topics`, { title: 'Copy discussion', message: '<p>Talk</p>', published: true });
		source.discussion = String(topic.id);
		const module = await canvas().post<Json>(`${api}/modules`, { module: { name: 'Copy module' } });
		source.module = String(module.id);
		await canvas().post(`${api}/modules/${String(module.id)}/items`, {
			module_item: { type: 'Page', page_url: source.page_alpha_url },
		});
		await canvas().post(`${api}/folders`, { name: 'handouts', parent_folder_path: '/' });
		const file = await uploadFile(`${api}/files`, 'copy-file.txt', 'file to copy', { folderPath: '/handouts' });
		source.file = String(file.id);

		// A finished export of the source, to import by its ID.
		const contentExport = await canvas().post<Json>(`${api}/content_exports`, {
			export_type: 'common_cartridge',
			skip_notifications: true,
		});
		exportId = String(contentExport.id);
		await eventually(
			async () => (await canvas().get<Json>(`${api}/content_exports/${exportId}`)).workflow_state === 'exported',
			'the export of the source course',
			120_000,
		);

		const account = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/sub_accounts`, {
			account: { name: unique('Migration battery account') },
		});
		accountId = String(account.id);
		const category = await canvas().post<Json>(`${api}/group_categories`, { name: unique('Migration groups') });
		groupId = String(
			(await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, { name: unique('Migration group') })).id,
		);
		owner = await createUserWithToken('Migration owner');
		removePersona = await createTokenPersona(persona, owner.token as string);
	});

	afterAll(async () => {
		await removePersona?.();
		for (const id of courses) {
			await canvas().request('DELETE', `/api/v1/courses/${id}?event=delete`);
		}
		if (accountId) await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/sub_accounts/${accountId}`);
		await deleteUser(owner);
	});

	it('listMigrators: what each context accepts', async () => {
		const types = async (params: Json): Promise<string[]> =>
			(await runOk({ resource: 'contentMigration', operation: 'listMigrators', params })).map((m) => String(m.type)).sort();

		const inCourse = await runOk({
			resource: 'contentMigration',
			operation: 'listMigrators',
			params: { contextType: 'course', courseId: sourceId },
		});
		expect(inCourse).toEqual(await canvas().get<Json[]>(`/api/v1/courses/${sourceId}/content_migrations/migrators`));
		expect(inCourse.map((m) => m.type)).toEqual(
			expect.arrayContaining(['course_copy_importer', 'canvas_cartridge_importer', 'common_cartridge_importer', 'zip_file_importer', 'qti_converter']),
		);
		expect(inCourse.find((m) => m.type === 'course_copy_importer')).toMatchObject({
			requires_file_upload: false,
			required_settings: ['source_course_id'],
		});

		const inAccount = await types({ contextType: 'account', accountId });
		expect(inAccount).toContain('qti_converter');
		expect(inAccount).not.toContain('course_copy_importer');
		expect(await types({ contextType: 'group', groupId })).toEqual(['zip_file_importer']);
		expect(await types({ contextType: 'user', userId: 'self' })).toEqual(['zip_file_importer']);
	});

	it('create (course copy): copies everything and shifts the dates, with a weekday substitution', async () => {
		fullCopyCourseId = await newCourse('full copy');
		const migration = await migrate({
			contextType: 'course',
			courseId: fullCopyCourseId,
			migrationType: 'course_copy_importer',
			sourceCourseId: sourceId,
			additionalFields: {
				date_shift_options_shift_dates: true,
				date_shift_options_old_start_date: '2030-03-01',
				date_shift_options_old_end_date: '2030-06-01',
				date_shift_options_new_start_date: '2031-03-01',
				date_shift_options_new_end_date: '2031-06-01',
				// Monday (1) becomes Wednesday (3).
				date_shift_options_day_substitutions: '{"1": 3}',
			},
		});
		fullCopyMigrationId = String(migration.id);
		expect(migration).toMatchObject({
			migration_type: 'course_copy_importer',
			settings: { source_course_id: Number(sourceId) },
		});

		const [finished] = await runOk({
			resource: 'contentMigration',
			operation: 'get',
			params: { contextType: 'course', courseId: fullCopyCourseId, contentMigrationId: fullCopyMigrationId },
		});
		expect(finished).toMatchObject({ id: migration.id, workflow_state: 'completed', migration_issues_count: 0 });

		expect(await titles(fullCopyCourseId, 'pages')).toEqual(['Copy page alpha', 'Copy page beta']);
		expect(await titles(fullCopyCourseId, 'discussion_topics')).toEqual(['Copy discussion']);
		expect(await titles(fullCopyCourseId, 'modules', 'name')).toEqual(['Copy module']);
		expect(await titles(fullCopyCourseId, 'files', 'display_name')).toEqual(['copy-file.txt']);
		const page = await canvas().get<Json>(`/api/v1/courses/${fullCopyCourseId}/pages/${source.page_alpha_url}`);
		expect(String(page.body)).toContain('Page alpha – Ünïcødé 页 "quoted" &amp; more');
		const assignments = await canvas().getAll<Json>(`/api/v1/courses/${fullCopyCourseId}/assignments`);
		expect(assignments.map((a) => a.name).sort()).toEqual(['Copy assignment alpha', 'Copy assignment beta']);
		// Monday 2030-03-04 moved a year ahead and onto a Wednesday.
		const alphaDue = new Date(String(assignments.find((a) => a.name === 'Copy assignment alpha')?.due_at));
		expect(alphaDue.getUTCFullYear()).toBe(2031);
		expect(alphaDue.getUTCDay()).toBe(3);
		const betaDue = new Date(String(assignments.find((a) => a.name === 'Copy assignment beta')?.due_at));
		expect(betaDue.getUTCFullYear()).toBe(2031);
		// The course settings came along.
		expect(await canvas().get<Json>(`/api/v1/courses/${fullCopyCourseId}?include[]=syllabus_body`)).toMatchObject({
			license: 'cc_by',
			syllabus_body: expect.stringContaining('Source syllabus'),
		});
	});

	it('getAssetIdMapping: which ID each copied object has in the destination', async () => {
		const [mapping] = await runOk({
			resource: 'contentMigration',
			operation: 'getAssetIdMapping',
			params: { courseId: fullCopyCourseId, contentMigrationId: fullCopyMigrationId },
		});
		expect(Object.keys(mapping)).toEqual(expect.arrayContaining(['assignments', 'pages', 'discussion_topics', 'modules', 'files']));
		const copied = await canvas().getAll<Json>(`/api/v1/courses/${fullCopyCourseId}/assignments`);
		// (Canvas lists every object by its ID and once more by its migration identifier.)
		expect(Object.keys(mapping.assignments as Json)).toEqual(
			expect.arrayContaining([source.assignment_alpha, source.assignment_beta]),
		);
		expect(String((mapping.assignments as Json)[source.assignment_alpha])).toBe(
			String(copied.find((a) => a.name === 'Copy assignment alpha')?.id),
		);
		const copiedFiles = await canvas().getAll<Json>(`/api/v1/courses/${fullCopyCourseId}/files`);
		expect(String((mapping.files as Json)[source.file])).toBe(String(copiedFiles[0].id));
	});

	it('create (course copy): "Select" copies only the chosen objects', async () => {
		const destination = await newCourse('selected copy');
		await migrate({
			contextType: 'course',
			courseId: destination,
			migrationType: 'course_copy_importer',
			// The source course ID arrives as a number from an expression.
			sourceCourseId: '={{ $json.source }}',
			additionalFields: {
				select: JSON.stringify({ pages: [Number(source.page_alpha)], assignments: [source.assignment_beta] }),
			},
		}, undefined, [{ source: Number(sourceId) }]);
		expect(await titles(destination, 'pages')).toEqual(['Copy page alpha']);
		expect(await titles(destination, 'assignments', 'name')).toEqual(['Copy assignment beta']);
		expect(await titles(destination, 'discussion_topics')).toEqual([]);
		expect(await titles(destination, 'files', 'display_name')).toEqual([]);
	});

	it('create (course copy): module insertion, assignment group, removed dates and importer skips', async () => {
		const destination = await newCourse('settings copy');
		const api = `/api/v1/courses/${destination}`;
		const module = await canvas().post<Json>(`${api}/modules`, { module: { name: 'Imported things' } });
		await canvas().post(`${api}/modules/${String(module.id)}/items`, {
			module_item: { type: 'SubHeader', title: 'Already here' },
		});
		const group = await canvas().post<Json>(`${api}/assignment_groups`, { name: 'Imported assignments' });

		const migration = await migrate({
			contextType: 'course',
			courseId: destination,
			migrationType: 'course_copy_importer',
			sourceCourseId: sourceId,
			additionalFields: {
				// One page that is in no module of the source, and both assignments.
				select: JSON.stringify({
					pages: [source.page_beta],
					assignments: [source.assignment_alpha, source.assignment_beta],
				}),
				insert_into_module_id: String(module.id),
				insert_into_module_type: 'page',
				insert_into_module_position: 1,
				move_to_assignment_group_id: String(group.id),
				date_shift_options_remove_dates: true,
				importer_skips: ['all_course_settings', 'visibility_settings'],
				overwrite_quizzes: true,
				question_bank_name: 'Battery bank "quoted" & more',
				question_bank_id: '424242',
				import_blueprint_settings: true,
			},
		});

		const items = await canvas().getAll<Json>(`${api}/modules/${String(module.id)}/items`);
		// Only the page was inserted (not the assignments), in front of what was there.
		expect(items.map((i) => `${String(i.type)}:${String(i.title)}`)).toEqual([
			'Page:Copy page beta',
			'SubHeader:Already here',
		]);
		const assignments = await canvas().getAll<Json>(`${api}/assignments`);
		expect(assignments).toHaveLength(2);
		expect(assignments.every((a) => a.assignment_group_id === group.id && a.due_at === null)).toBe(true);
		// "All Course Settings" was skipped: the license of the source did not come along.
		expect((await canvas().get<Json>(api)).license).not.toBe('cc_by');

		// The settings without a visible effect here (they concern quiz imports) reached Canvas too.
		expect(await storedSettings(api, migration.id)).toMatchObject({
			overwrite_quizzes: true,
			question_bank_name: 'Battery bank "quoted" & more',
			question_bank_id: '424242',
			import_blueprint_settings: true,
			importer_skips: ['all_course_settings', 'visibility_settings'],
			insert_into_module_type: 'page',
		});
	});

	it('selective import: wait for the selection, list the content, import a part of it with Update', async () => {
		const destination = await newCourse('selective copy');
		const context = { contextType: 'course', courseId: destination };
		const [created] = await runOk({
			resource: 'contentMigration',
			operation: 'create',
			params: {
				...context,
				migrationType: 'course_copy_importer',
				sourceCourseId: sourceId,
				additionalFields: { selective_import: true },
			},
		});
		const contentMigrationId = String(created.id);
		expect(created.workflow_state).toBe('waiting_for_select');
		expect(await titles(destination, 'pages')).toEqual([]);

		const sections = await runOk({
			resource: 'contentMigration',
			operation: 'getSelectiveData',
			params: { ...context, contentMigrationId },
		});
		expect(sections).toEqual(
			await canvas().get<Json[]>(`/api/v1/courses/${destination}/content_migrations/${contentMigrationId}/selective_data`),
		);
		const byType = Object.fromEntries(sections.map((s) => [String(s.type), s]));
		expect(byType.wiki_pages).toMatchObject({ property: 'copy[all_wiki_pages]', count: 2 });
		expect(byType.assignments).toMatchObject({ property: 'copy[all_assignments]', count: 2 });
		expect(byType.discussion_topics).toMatchObject({ property: 'copy[all_discussion_topics]', count: 1 });

		const pages = await runOk({
			resource: 'contentMigration',
			operation: 'getSelectiveData',
			params: { ...context, contentMigrationId, options: { type: 'wiki_pages' } },
		});
		expect(pages.map((p) => p.title).sort()).toEqual(['Copy page alpha', 'Copy page beta']);
		const beta = pages.find((p) => p.title === 'Copy page beta') as Json;
		expect(String(beta.property)).toMatch(/^copy\[wiki_pages\]\[.+\]$/);

		const [updated] = await runOk({
			resource: 'contentMigration',
			operation: 'update',
			// The properties exactly as Get Selective Data reports them, as an array from an expression.
			items: [{ properties: [beta.property, 'copy[all_discussion_topics]'] }],
			params: { ...context, contentMigrationId, copyProperties: '={{ $json.properties }}' },
		});
		expect(updated.id).toBe(created.id);
		await waitForProgress(updated.progress_url);

		expect(await titles(destination, 'pages')).toEqual(['Copy page beta']);
		expect(await titles(destination, 'discussion_topics')).toEqual(['Copy discussion']);
		expect(await titles(destination, 'assignments', 'name')).toEqual([]);
		const [finished] = await runOk({
			resource: 'contentMigration',
			operation: 'get',
			params: { ...context, contentMigrationId },
		});
		expect(finished.workflow_state).toBe('completed');
	});

	it('update: malformed copy properties never reach Canvas', async () => {
		const result = await runNode({
			resource: 'contentMigration',
			operation: 'update',
			params: {
				contextType: 'course',
				courseId: fullCopyCourseId,
				contentMigrationId: fullCopyMigrationId,
				copyProperties: 'copy[wiki_pages][unbalanced',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(String(result.error[0].errorMessage)).toMatch(/is not a copy property/);
	});

	it('create (Canvas cartridge): imports a finished content export by its ID', async () => {
		const destination = await newCourse('cartridge import');
		const migration = await migrate({
			contextType: 'course',
			courseId: destination,
			migrationType: 'canvas_cartridge_importer',
			additionalFields: { content_export_id: exportId },
		});
		expect(migration).toMatchObject({ migration_type: 'canvas_cartridge_importer' });
		expect(await titles(destination, 'pages')).toEqual(['Copy page alpha', 'Copy page beta']);
		expect(await titles(destination, 'assignments', 'name')).toEqual(['Copy assignment alpha', 'Copy assignment beta']);
		expect(await titles(destination, 'files', 'display_name')).toEqual(['copy-file.txt']);
	});

	it('create (ZIP file): announces an upload, and unzips the file into a folder once it has arrived', async () => {
		const destination = await newCourse('zip import');
		const api = `/api/v1/courses/${destination}`;
		const folder = await canvas().post<Json>(`${api}/folders`, { name: 'unzipped', parent_folder_path: '/' });
		const zip = makeZip({ 'notes/first.txt': 'first file', 'second – ünï.txt': 'second file' });

		const [created] = await runOk({
			resource: 'contentMigration',
			operation: 'create',
			params: {
				contextType: 'course',
				courseId: destination,
				migrationType: 'zip_file_importer',
				additionalFields: {
					folder_id: String(folder.id),
					pre_attachment_name: 'battery.zip',
					pre_attachment_size: zip.byteLength,
				},
			},
		});
		expect(created).toMatchObject({ workflow_state: 'pre_processing', migration_type: 'zip_file_importer' });
		const slot = created.pre_attachment as Json;
		expect(slot.upload_url).toBeTypeOf('string');
		expect(slot.upload_params).toBeTypeOf('object');

		// What an HTTP Request node would do next: post the file to the upload URL.
		await postToUploadSlot(slot, 'battery.zip', zip, 'application/zip');
		const started = await eventually(async () => {
			const migration = await canvas().get<Json>(`${api}/content_migrations/${String(created.id)}`);
			return migration.progress_url && migration.workflow_state !== 'pre_processing' ? migration : undefined;
		}, 'the migration to start after the upload');
		await waitForProgress(started.progress_url);

		const files = await canvas().getAll<Json>(`${api}/files`);
		expect(files.map((f) => f.display_name).sort()).toEqual(['first.txt', 'second – ünï.txt']);
		const folders = await canvas().getAll<Json>(`${api}/folders`);
		expect(folders.map((f) => f.full_name)).toEqual(expect.arrayContaining(['course files/unzipped', 'course files/unzipped/notes']));
	});

	it('create (group and user): ZIP imports into a group\'s and a user\'s files', async () => {
		const zip = makeZip({ 'shared.txt': 'for the group' });
		const groupFolder = await canvas().post<Json>(`/api/v1/groups/${groupId}/folders`, { name: 'imported', parent_folder_path: '/' });
		const [inGroup] = await runOk({
			resource: 'contentMigration',
			operation: 'create',
			params: {
				contextType: 'group',
				groupId,
				migrationType: 'zip_file_importer',
				additionalFields: { folder_id: String(groupFolder.id), pre_attachment_name: 'group.zip', pre_attachment_size: zip.byteLength },
			},
		});
		await postToUploadSlot(inGroup.pre_attachment as Json, 'group.zip', zip, 'application/zip');
		const groupMigration = await eventually(async () => {
			const [migration] = await runOk({
				resource: 'contentMigration',
				operation: 'get',
				params: { contextType: 'group', groupId, contentMigrationId: String(inGroup.id) },
			});
			return migration.workflow_state === 'completed' ? migration : undefined;
		}, 'the group import');
		expect(groupMigration).toMatchObject({ id: inGroup.id, migration_type: 'zip_file_importer' });
		expect((await canvas().getAll<Json>(`/api/v1/groups/${groupId}/files`)).map((f) => f.display_name)).toEqual(['shared.txt']);
		const groupList = await runOk({
			resource: 'contentMigration',
			operation: 'getAll',
			params: { contextType: 'group', groupId },
		});
		expect(groupList.map((m) => m.id)).toEqual([inGroup.id]);

		// A user imports into their own files.
		const userFolder = await asUser<Json>(owner as OwnUser, 'POST', '/api/v1/users/self/folders', {
			name: 'imported',
			parent_folder_path: '/',
		});
		const userZip = makeZip({ 'mine.txt': 'for me' });
		const [inUser] = await runOk({
			resource: 'contentMigration',
			operation: 'create',
			persona,
			params: {
				contextType: 'user',
				userId: 'self',
				migrationType: 'zip_file_importer',
				additionalFields: { folder_id: String(userFolder.id), pre_attachment_name: 'mine.zip', pre_attachment_size: userZip.byteLength },
			},
		});
		await postToUploadSlot(inUser.pre_attachment as Json, 'mine.zip', userZip, 'application/zip', (method, url) =>
			asUser<Json>(owner as OwnUser, method, url),
		);
		await eventually(async () => {
			const [migration] = await runOk({
				resource: 'contentMigration',
				operation: 'get',
				persona,
				params: { contextType: 'user', userId: owner!.id, contentMigrationId: String(inUser.id) },
			});
			return migration.workflow_state === 'completed';
		}, 'the user import');
		const userFiles = await asUser<Json[]>(owner as OwnUser, 'GET', `/api/v1/folders/${String(userFolder.id)}/files`);
		expect(userFiles.map((f) => f.display_name)).toEqual(['mine.txt']);
		const userList = await runOk({
			resource: 'contentMigration',
			operation: 'getAll',
			persona,
			params: { contextType: 'user', userId: 'self' },
		});
		expect(userList.map((m) => m.id)).toEqual([inUser.id]);
	});

	it('create (account): a cartridge import into an account, by file URL; the failed download shows up as an issue', async () => {
		const context = { contextType: 'account', accountId };
		const [created] = await runOk({
			resource: 'contentMigration',
			operation: 'create',
			params: {
				...context,
				migrationType: 'common_cartridge_importer',
				additionalFields: { file_url: 'https://files.battery.invalid/course.imscc' },
			},
		});
		const contentMigrationId = String(created.id);
		expect(created).toMatchObject({ migration_type: 'common_cartridge_importer' });
		expect(await storedSettings(`/api/v1/accounts/${accountId}`, created.id)).toMatchObject({
			file_url: 'https://files.battery.invalid/course.imscc',
		});

		// Canvas cannot download from that URL: the job fails ...
		const progress = await waitForProgress(created.progress_url, { allowFailure: true });
		expect(progress.workflow_state).toBe('failed');
		const [failed] = await runOk({ resource: 'contentMigration', operation: 'get', params: { ...context, contentMigrationId } });
		expect(failed.workflow_state).toBe('failed');
		expect(failed.migration_issues_count).toBeGreaterThan(0);

		// ... and says why in its issues.
		const expectedIssues = await canvas().getAll<Json>(
			`/api/v1/accounts/${accountId}/content_migrations/${contentMigrationId}/migration_issues`,
		);
		const issues = await runOk({ resource: 'contentMigration', operation: 'getIssues', params: { ...context, contentMigrationId } });
		expect(issues.map((i) => i.id)).toEqual(expectedIssues.map((i) => i.id));
		expect(issues[0]).toMatchObject({ workflow_state: 'active' });
		expect(['warning', 'error']).toContain(issues[0].issue_type);
		expect(String(issues[0].description).length).toBeGreaterThan(0);

		const [resolved] = await runOk({
			resource: 'contentMigration',
			operation: 'updateIssue',
			params: { ...context, contentMigrationId, issueId: String(issues[0].id), issueState: 'resolved' },
		});
		expect(resolved).toMatchObject({ id: issues[0].id, workflow_state: 'resolved' });
		const issuePath = `/api/v1/accounts/${accountId}/content_migrations/${contentMigrationId}/migration_issues/${String(issues[0].id)}`;
		expect((await canvas().get<Json>(issuePath)).workflow_state).toBe('resolved');
		await runOk({
			resource: 'contentMigration',
			operation: 'updateIssue',
			params: { ...context, contentMigrationId, issueId: String(issues[0].id), issueState: 'active' },
		});
		expect((await canvas().get<Json>(issuePath)).workflow_state).toBe('active');

		const list = await runOk({ resource: 'contentMigration', operation: 'getAll', params: context });
		expect(list.map((m) => m.id)).toEqual([created.id]);
	});

	it('getIssue, getIssues, updateIssue: the issues of a migration, in every context', async () => {
		// One import per context that fails (Canvas cannot download from that URL) and therefore has an issue.
		const failingImport = async (
			contextPath: string,
			body: Json,
			request: (method: string, path: string, body?: unknown) => Promise<Json> = (method, path, payload) =>
				method === 'POST' ? canvas().post<Json>(path, payload) : canvas().get<Json>(path),
		): Promise<{ migrationId: string; issue: Json }> => {
			const migration = await request('POST', `${contextPath}/content_migrations`, body);
			const path = `${contextPath}/content_migrations/${String(migration.id)}`;
			const issues = await eventually(async () => {
				const state = await request('GET', path);
				if (state.workflow_state !== 'failed') return undefined;
				const list = (await request('GET', `${path}/migration_issues`)) as unknown as Json[];
				return list.length > 0 ? list : undefined;
			}, `the failed import into ${contextPath}`, 120_000);
			return { migrationId: String(migration.id), issue: issues[0] };
		};
		const cartridge = { migration_type: 'common_cartridge_importer', settings: { file_url: 'https://files.battery.invalid/issue.imscc' } };
		const zipInto = (folderId: unknown): Json => ({
			migration_type: 'zip_file_importer',
			settings: { file_url: 'https://files.battery.invalid/issue.zip', folder_id: String(folderId) },
		});
		// A course and a group of their own: other tests count the migrations of the shared ones.
		const issueCourse = await newCourse('issues');
		const category = await canvas().post<Json>(`/api/v1/courses/${issueCourse}/group_categories`, { name: unique('Issue groups') });
		const issueGroup = String(
			(await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, { name: unique('Issue group') })).id,
		);
		const groupFolder = await canvas().get<Json>(`/api/v1/groups/${issueGroup}/folders/root`);
		const userFolder = await asUser<Json>(owner as OwnUser, 'GET', '/api/v1/users/self/folders/root');

		const inCourse = await failingImport(`/api/v1/courses/${issueCourse}`, cartridge);
		const inAccount = await failingImport(`/api/v1/accounts/${accountId}`, cartridge);
		const inGroup = await failingImport(`/api/v1/groups/${issueGroup}`, zipInto(groupFolder.id));
		const inUser = await failingImport(`/api/v1/users/${owner!.id}`, zipInto(userFolder.id), (method, path, body) =>
			asUser<Json>(owner as OwnUser, method, path, body),
		);

		const cases: Array<[Json, { migrationId: string; issue: Json }, string | undefined]> = [
			[{ contextType: 'course', courseId: issueCourse }, inCourse, undefined],
			[{ contextType: 'account', accountId }, inAccount, undefined],
			[{ contextType: 'group', groupId: issueGroup }, inGroup, undefined],
			[{ contextType: 'user', userId: 'self' }, inUser, persona],
		];
		for (const [context, { migrationId, issue }, runAs] of cases) {
			const [fetched] = await runOk({
				resource: 'contentMigration',
				operation: 'getIssue',
				persona: runAs,
				items: [{ migration: Number(migrationId), issue: issue.id }],
				params: { ...context, contentMigrationId: '={{ $json.migration }}', issueId: '={{ $json.issue }}' },
			});
			// (The administrator also gets Canvas' internal error report with the issue; the owner of a user import does not.)
			expect(fetched, String(context.contextType)).toMatchObject({
				id: issue.id,
				workflow_state: 'active',
				issue_type: issue.issue_type,
				description: issue.description,
				content_migration_url: issue.content_migration_url,
			});
			expect(String(fetched.description).length).toBeGreaterThan(0);
			expect(String(fetched.content_migration_url)).toContain(`/content_migrations/${migrationId}`);
		}

		// getIssues and updateIssue in the course, group and user context (the account ran above).
		const contextPaths: Record<string, string> = {
			course: `/api/v1/courses/${issueCourse}`,
			group: `/api/v1/groups/${issueGroup}`,
			user: `/api/v1/users/${owner!.id}`,
		};
		for (const [context, { migrationId, issue }, runAs] of cases) {
			const kind = String(context.contextType);
			if (kind === 'account') continue;
			const read = (path: string): Promise<Json> =>
				kind === 'user' ? asUser<Json>(owner as OwnUser, 'GET', path) : canvas().get<Json>(path);
			const issuesPath = `${contextPaths[kind]}/content_migrations/${migrationId}/migration_issues`;
			const listed = await runOk({
				resource: 'contentMigration',
				operation: 'getIssues',
				persona: runAs,
				params: { ...context, contentMigrationId: migrationId, pagination: { returnAll: true } },
			});
			expect(listed.map((i) => i.id), kind).toEqual(((await read(issuesPath)) as unknown as Json[]).map((i) => i.id));
			expect(listed.map((i) => i.id)).toContain(issue.id);

			for (const state of ['resolved', 'active']) {
				const [updated] = await runOk({
					resource: 'contentMigration',
					operation: 'updateIssue',
					persona: runAs,
					params: { ...context, contentMigrationId: migrationId, issueId: String(issue.id), issueState: state },
				});
				expect(updated, kind).toMatchObject({ id: issue.id, workflow_state: state });
				expect((await read(`${issuesPath}/${String(issue.id)}`)).workflow_state, `${kind}: ${state}`).toBe(state);
			}
		}

		const run = (params: Json, runAs?: string): ReturnType<typeof runNode> =>
			runNode({
				resource: 'contentMigration',
				operation: 'getIssue',
				persona: runAs,
				params: { ...params, errorHandling: { onError: 'continueWithError' } },
			});

		// The user context by the ID of the user: for that user only, not even for an administrator.
		const ofUser = { contextType: 'user', userId: owner!.id, contentMigrationId: inUser.migrationId, issueId: String(inUser.issue.id) };
		const byUserId = await run(ofUser, persona);
		expect(byUserId.error).toEqual([]);
		expect(byUserId.success[0].id).toBe(inUser.issue.id);
		const asAdmin = await run(ofUser);
		expect(asAdmin.success).toEqual([]);
		expect(asAdmin.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'contentMigration', operation: 'getIssue' });

		// An issue is only found under its own migration; unknown issues are not found; students have no access.
		const course = { contextType: 'course', courseId: issueCourse, contentMigrationId: inCourse.migrationId };
		const mixed = await runNode({
			resource: 'contentMigration',
			operation: 'getIssue',
			items: [{ issue: 999999999 }, { issue: inCourse.issue.id }, { issue: inAccount.issue.id }],
			params: { ...course, issueId: '={{ $json.issue }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(mixed.rawSuccess.map((item) => item.pairedItem)).toEqual([{ item: 1 }]);
		expect(mixed.error).toHaveLength(2);
		for (const error of mixed.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'contentMigration', operation: 'getIssue' });
		}
		const asStudent = await run({ ...course, issueId: String(inCourse.issue.id) }, 'student');
		expect(asStudent.success).toEqual([]);
		expect([401, 403, 404]).toContain(asStudent.error[0].errorCode);
	});

	it('update (course): a selective copy, with date shifting and placement chosen together with the selection', async () => {
		const destination = await newCourse('selective update settings');
		const api = `/api/v1/courses/${destination}`;
		const module = await canvas().post<Json>(`${api}/modules`, { module: { name: 'Placed here' } });
		await canvas().post(`${api}/modules/${String(module.id)}/items`, { module_item: { type: 'SubHeader', title: 'First' } });
		const group = await canvas().post<Json>(`${api}/assignment_groups`, { name: 'Moved here' });
		const created = await canvas().post<Json>(`${api}/content_migrations`, {
			migration_type: 'course_copy_importer',
			settings: { source_course_id: sourceId },
			selective_import: true,
		});
		const migrationId = String(created.id);
		const context = { contextType: 'course', courseId: destination, contentMigrationId: migrationId };
		await eventually(
			async () => (await canvas().get<Json>(`${api}/content_migrations/${migrationId}`)).workflow_state === 'waiting_for_select',
			'the selection',
		);
		const alpha = await selectableProperty(api, migrationId, 'assignments', 'Copy assignment alpha');

		const [updated] = await runOk({
			resource: 'contentMigration',
			operation: 'update',
			params: {
				...context,
				copyProperties: `${alpha}, copy[all_wiki_pages]`,
				updateFields: {
					date_shift_options_shift_dates: true,
					date_shift_options_old_start_date: '2030-03-01',
					date_shift_options_old_end_date: '2030-06-01',
					date_shift_options_new_start_date: '2032-03-01',
					date_shift_options_new_end_date: '2032-06-01',
					// Monday (1) becomes Friday (5).
					date_shift_options_day_substitutions: '{"1": 5}',
					insert_into_module_id: String(module.id),
					insert_into_module_type: 'assignment',
					insert_into_module_position: 2,
					move_to_assignment_group_id: String(group.id),
					importer_skips: 'all_course_settings',
					overwrite_quizzes: true,
					question_bank_name: 'Updated bank',
					question_bank_id: '515151',
					import_blueprint_settings: true,
				},
			},
		});
		expect(updated.id).toBe(created.id);
		await waitForProgress(updated.progress_url);

		const assignments = await canvas().getAll<Json>(`${api}/assignments`);
		expect(assignments.map((a) => a.name)).toEqual(['Copy assignment alpha']);
		const due = new Date(String(assignments[0].due_at));
		expect(due.getUTCFullYear()).toBe(2032);
		expect(due.getUTCDay()).toBe(5);
		expect(assignments[0].assignment_group_id).toBe(group.id);
		expect(await titles(destination, 'pages')).toEqual(['Copy page alpha', 'Copy page beta']);
		// Only the assignment goes into the module, at position 2.
		const items = await canvas().getAll<Json>(`${api}/modules/${String(module.id)}/items`);
		expect(items.map((i) => `${String(i.type)}:${String(i.title)}`)).toEqual(['SubHeader:First', 'Assignment:Copy assignment alpha']);
		expect((await canvas().get<Json>(api)).license).not.toBe('cc_by');
		expect(await storedSettings(api, created.id)).toMatchObject({
			date_shift_options: {
				shift_dates: true,
				old_start_date: '2030-03-01',
				new_start_date: '2032-03-01',
				old_end_date: '2030-06-01',
				new_end_date: '2032-06-01',
				day_substitutions: { '1': 5 },
			},
			overwrite_quizzes: true,
			question_bank_name: 'Updated bank',
			question_bank_id: '515151',
			import_blueprint_settings: true,
			importer_skips: ['all_course_settings'],
		});
	});

	it('update, getSelectiveData (account): a cartridge from a content export, selected after conversion', async () => {
		const api = `/api/v1/accounts/${accountId}`;
		// A migration whose file never arrived ...
		const created = await canvas().post<Json>(`${api}/content_migrations`, {
			migration_type: 'canvas_cartridge_importer',
			pre_attachment: { name: 'never.imscc', size: 1000 },
		});
		const migrationId = String(created.id);
		const context = { contextType: 'account', accountId, contentMigrationId: migrationId };
		// ... gets the export to import instead, and waits for a selection.
		const [updated] = await runOk({
			resource: 'contentMigration',
			operation: 'update',
			params: { ...context, updateFields: { content_export_id: exportId, selective_import: true } },
		});
		expect(updated.id).toBe(created.id);
		await eventually(
			async () => (await canvas().get<Json>(`${api}/content_migrations/${migrationId}`)).workflow_state === 'waiting_for_select',
			'the conversion of the export',
			150_000,
		);
		expect(await storedSettings(api, created.id)).toMatchObject({ import_immediately: false });

		const sections = await runOk({ resource: 'contentMigration', operation: 'getSelectiveData', params: context });
		expect(sections).toEqual(await canvas().get<Json[]>(`${api}/content_migrations/${migrationId}/selective_data`));
		expect(sections.map((section) => section.type)).toContain('wiki_pages');
		const pages = await runOk({
			resource: 'contentMigration',
			operation: 'getSelectiveData',
			params: { ...context, options: { type: 'wiki_pages' } },
		});
		expect(pages.map((page) => page.title).sort()).toEqual(['Copy page alpha', 'Copy page beta']);

		const [selected] = await runOk({
			resource: 'contentMigration',
			operation: 'update',
			params: { ...context, copyProperties: 'copy[all_wiki_pages]', updateFields: { date_shift_options_remove_dates: true } },
		});
		expect(selected.id).toBe(created.id);
		expect(await storedSettings(api, created.id)).toMatchObject({
			date_shift_options: { remove_dates: true },
			migration_ids_to_import: { copy: { all_wiki_pages: '1' } },
		});
		await waitForProgress(selected.progress_url, { allowFailure: true });
	});

	it('update (group and user): a ZIP import whose upload never arrived gets a new upload and folder', async () => {
		const zip = makeZip({ 'retried.txt': 'second attempt' });
		// A group of its own: the error test counts the migrations of the shared one.
		const category = await canvas().post<Json>(`/api/v1/courses/${sourceId}/group_categories`, { name: unique('Retry groups') });
		const retryGroup = String(
			(await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, { name: unique('Retry group') })).id,
		);
		const groupApi = `/api/v1/groups/${retryGroup}`;
		const first = await canvas().post<Json>(`${groupApi}/folders`, { name: unique('first try'), parent_folder_path: '/' });
		const second = await canvas().post<Json>(`${groupApi}/folders`, { name: unique('second try'), parent_folder_path: '/' });
		const stalled = await canvas().post<Json>(`${groupApi}/content_migrations`, {
			migration_type: 'zip_file_importer',
			settings: { folder_id: String(first.id) },
			pre_attachment: { name: 'lost.zip', size: 10 },
		});
		const [retried] = await runOk({
			resource: 'contentMigration',
			operation: 'update',
			params: {
				contextType: 'group',
				groupId: retryGroup,
				contentMigrationId: String(stalled.id),
				updateFields: { folder_id: String(second.id), pre_attachment_name: 'retry.zip', pre_attachment_size: zip.byteLength },
			},
		});
		expect(retried).toMatchObject({ id: stalled.id, pre_attachment: { upload_url: expect.any(String) } });
		expect(await storedSettings(groupApi, stalled.id)).toMatchObject({ folder_id: String(second.id) });
		await postToUploadSlot(retried.pre_attachment as Json, 'retry.zip', zip, 'application/zip');
		await eventually(
			async () => (await canvas().get<Json>(`${groupApi}/content_migrations/${String(stalled.id)}`)).workflow_state === 'completed',
			'the group import',
		);
		expect((await canvas().getAll<Json>(`/api/v1/folders/${String(second.id)}/files`)).map((f) => f.display_name)).toEqual(['retried.txt']);
		expect(await canvas().getAll<Json>(`/api/v1/folders/${String(first.id)}/files`)).toEqual([]);

		// The same for a user, as that user.
		const userFolder = await asUser<Json>(owner as OwnUser, 'POST', '/api/v1/users/self/folders', { name: unique('retry'), parent_folder_path: '/' });
		const userStalled = await asUser<Json>(owner as OwnUser, 'POST', '/api/v1/users/self/content_migrations', {
			migration_type: 'zip_file_importer',
			settings: { folder_id: String(userFolder.id) },
			pre_attachment: { name: 'lost.zip', size: 10 },
		});
		const [userRetried] = await runOk({
			resource: 'contentMigration',
			operation: 'update',
			persona,
			params: {
				contextType: 'user',
				userId: 'self',
				contentMigrationId: String(userStalled.id),
				updateFields: { pre_attachment_name: 'retry.zip', pre_attachment_size: zip.byteLength },
			},
		});
		expect(userRetried).toMatchObject({ id: userStalled.id, pre_attachment: { upload_url: expect.any(String) } });
		await postToUploadSlot(userRetried.pre_attachment as Json, 'retry.zip', zip, 'application/zip', (method, url) =>
			asUser<Json>(owner as OwnUser, method, url),
		);
		await eventually(
			async () =>
				(await asUser<Json>(owner as OwnUser, 'GET', `/api/v1/users/self/content_migrations/${String(userStalled.id)}`))
					.workflow_state === 'completed',
			'the user import',
		);
		const files = await asUser<Json[]>(owner as OwnUser, 'GET', `/api/v1/folders/${String(userFolder.id)}/files`);
		expect(files.map((f) => f.display_name)).toEqual(['retried.txt']);

		// Groups and users only have ZIP imports, which have nothing to select (Canvas fails with
		// "course hasn't been converted"): Get Selective Data does not offer these contexts.
		for (const context of [
			{ contextType: 'group', groupId: retryGroup },
			{ contextType: 'user', userId: 'self' },
		]) {
			const refused = await runNode({
				resource: 'contentMigration',
				operation: 'getSelectiveData',
				params: { ...context, contentMigrationId: String(stalled.id), errorHandling: { onError: 'continueWithError' } },
			});
			expect(refused.error[0], context.contextType).toMatchObject({ errorType: 'INVALID_PARAMETERS' });
			expect(String(refused.error[0].errorMessage)).toContain('only for course and account migrations');
		}
		const direct = await canvas().request('GET', `${groupApi}/content_migrations/${String(stalled.id)}/selective_data`);
		expect(direct.status, 'Canvas cannot list the content of a ZIP import').toBe(500);
	});

	it('getAll: the migrations of a course, newest first, with paging; getIssues of a clean migration is empty', async () => {
		// A few more migrations into the full copy course (selective, so nothing is imported).
		for (let i = 0; i < 4; i++) {
			await canvas().post(`/api/v1/courses/${fullCopyCourseId}/content_migrations`, {
				migration_type: 'course_copy_importer',
				settings: { source_course_id: sourceId },
				selective_import: true,
			});
		}
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${fullCopyCourseId}/content_migrations`);
		expect(expected).toHaveLength(5);
		const context = { contextType: 'course', courseId: fullCopyCourseId };

		const all = await runOk({ resource: 'contentMigration', operation: 'getAll', params: context });
		expect(all.map((m) => m.id)).toEqual(expected.map((m) => m.id));
		expect(all.map((m) => m.workflow_state)).toEqual([...Array(4).fill('waiting_for_select'), 'completed']);

		const twoPages = await runOk({
			resource: 'contentMigration',
			operation: 'getAll',
			params: { ...context, pagination: { perPage: 2, maxPages: 2 } },
		});
		expect(twoPages.map((m) => m.id)).toEqual(expected.slice(0, 4).map((m) => m.id));
		const everything = await runOk({
			resource: 'contentMigration',
			operation: 'getAll',
			params: { ...context, pagination: { returnAll: true, perPage: 2 } },
		});
		expect(everything.map((m) => m.id)).toEqual(expected.map((m) => m.id));

		const issues = await runOk({
			resource: 'contentMigration',
			operation: 'getIssues',
			params: { ...context, contentMigrationId: fullCopyMigrationId },
		});
		expect(issues).toEqual([]);
		expect(
			await runOk({ resource: 'contentMigration', operation: 'getAll', params: { contextType: 'course', courseId: fx('emptyCourseId') } }),
		).toEqual([]);
	});

	it('errors: Canvas\' reasons for refusing a migration arrive on the Error output', async () => {
		const cases: Array<[string, Json, Json, RegExp?]> = [
			[
				'a migration type the context does not support',
				{ contextType: 'group', groupId, migrationType: 'course_copy_importer', sourceCourseId: sourceId },
				{ errorCode: 400, errorType: 'VALIDATION_ERROR' },
			],
			[
				'a file migration without a file',
				{ contextType: 'course', courseId: fullCopyCourseId, migrationType: 'common_cartridge_importer' },
				{ errorCode: 400, errorType: 'VALIDATION_ERROR' },
			],
			[
				'a source course that does not exist',
				{ contextType: 'course', courseId: fullCopyCourseId, migrationType: 'course_copy_importer', sourceCourseId: '99999999' },
				{ errorCode: 404, errorType: 'NOT_FOUND' },
			],
		];
		for (const [label, params, expected] of cases) {
			const result = await runNode({
				resource: 'contentMigration',
				operation: 'create',
				params: { ...params, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, label).toEqual([]);
			expect(result.error[0], label).toMatchObject({ ...expected, resource: 'contentMigration', operation: 'create' });
		}
		expect(await canvas().getAll<Json>(`/api/v1/groups/${groupId}/content_migrations`)).toHaveLength(1);

		const asStudent = await runNode({
			resource: 'contentMigration',
			operation: 'create',
			persona: 'student',
			params: {
				contextType: 'course',
				courseId: fx('courseId'),
				migrationType: 'course_copy_importer',
				sourceCourseId: fx('courseId2'),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asStudent.success).toEqual([]);
		expect(asStudent.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(asStudent.error[0].errorCode);

		const incomplete = await runNode({
			resource: 'contentMigration',
			operation: 'getAssetIdMapping',
			items: [{ id: fullCopyMigrationId }, { id: '99999999' }],
			params: { courseId: fullCopyCourseId, contentMigrationId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(incomplete.success).toHaveLength(1);
		expect(incomplete.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getAssetIdMapping' });
	});
});
