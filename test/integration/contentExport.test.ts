import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { download, uploadFile, waitForProgress, zipNames, zipRead } from './content.helper';
import { createTokenPersona } from './lti-advantage.helper';
import { createUserWithToken, deleteUser } from './own-users.helper';
import type { OwnUser } from './own-users.helper';

/**
 * Resource: contentExport. Exports are background jobs: every test starts one
 * through the node, follows it with the node's Progress > Get and then opens
 * the exported archive to see what is really in it.
 */
describe('contentExport', () => {
	let courseId = '';
	let groupId = '';
	let owner: OwnUser | undefined;
	let removePersona: (() => Promise<void>) | undefined;
	const persona = 'exportOwner';
	const ids: Record<string, string> = {};
	const exportIds: string[] = [];

	/** Run an export through the node to the end and return it with its archive. */
	async function exportAndDownload(
		params: Json,
		runAs?: string,
	): Promise<{ created: Json; finished: Json; zip: Buffer; names: string[] }> {
		const [created] = await runOk({ resource: 'contentExport', operation: 'create', persona: runAs, params });
		expect(created.progress_url, 'an export reports where to follow its progress').toBeTypeOf('string');
		await waitForProgress(created.progress_url, { persona: runAs });
		const [finished] = await runOk({
			resource: 'contentExport',
			operation: 'get',
			persona: runAs,
			params: { ...params, additionalFields: undefined, exportType: undefined, contentExportId: String(created.id) },
		});
		expect(finished).toMatchObject({ id: created.id, workflow_state: 'exported' });
		const zip = await download((finished.attachment as Json).url, runAs === persona ? owner?.token : undefined);
		return { created, finished, zip, names: zipNames(zip) };
	}

	beforeAll(async () => {
		const course = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique('Export battery course') },
			offer: true,
		});
		courseId = String(course.id);
		const api = `/api/v1/courses/${courseId}`;

		for (const key of ['alpha', 'beta']) {
			const page = await canvas().post<Json>(`${api}/pages`, {
				wiki_page: { title: `Export page ${key}`, body: `<p>Body of page ${key} – Ünïcødé 页</p>`, published: true },
			});
			ids[`page_${key}`] = String(page.page_id);
			const assignment = await canvas().post<Json>(`${api}/assignments`, {
				assignment: { name: `Export assignment ${key}`, points_possible: 10, submission_types: ['online_text_entry'] },
			});
			ids[`assignment_${key}`] = String(assignment.id);
			const quiz = await canvas().post<Json>(`${api}/quizzes`, {
				quiz: { title: `Export quiz ${key}`, quiz_type: 'practice_quiz', published: true },
			});
			ids[`quiz_${key}`] = String(quiz.id);
			const topic = await canvas().post<Json>(`${api}/discussion_topics`, {
				title: `Export discussion ${key}`,
				message: `<p>Discuss ${key}</p>`,
			});
			ids[`discussion_${key}`] = String(topic.id);
			const announcement = await canvas().post<Json>(`${api}/discussion_topics`, {
				title: `Export announcement ${key}`,
				message: `<p>Announce ${key}</p>`,
				is_announcement: true,
			});
			ids[`announcement_${key}`] = String(announcement.id);
			const event = await canvas().post<Json>('/api/v1/calendar_events', {
				calendar_event: {
					context_code: `course_${courseId}`,
					title: `Export event ${key}`,
					start_at: '2030-05-01T10:00:00Z',
					end_at: '2030-05-01T11:00:00Z',
				},
			});
			ids[`event_${key}`] = String(event.id);
			const folder = await canvas().post<Json>(`${api}/folders`, { name: `folder-${key}`, parent_folder_path: '/' });
			ids[`folder_${key}`] = String(folder.id);
			const file = await uploadFile(`${api}/files`, `file-${key}.txt`, `content of ${key}`, {
				folderPath: `/folder-${key}`,
			});
			ids[`file_${key}`] = String(file.id);
			const module = await canvas().post<Json>(`${api}/modules`, { module: { name: `Export module ${key}` } });
			ids[`module_${key}`] = String(module.id);
			const item = await canvas().post<Json>(`${api}/modules/${String(module.id)}/items`, {
				module_item: { type: 'SubHeader', title: `Export header ${key}` },
			});
			ids[`item_${key}`] = String(item.id);
			const rubric = await canvas().post<Json>(`${api}/rubrics`, {
				rubric: {
					title: `Export rubric ${key}`,
					criteria: { 0: { description: 'Quality', points: 5, ratings: { 0: { description: 'Good', points: 5 }, 1: { description: 'Bad', points: 0 } } } },
				},
				rubric_association: { association_id: courseId, association_type: 'Course', purpose: 'bookmark' },
			});
			ids[`rubric_${key}`] = String((rubric.rubric as Json).id);
		}

		const category = await canvas().post<Json>(`${api}/group_categories`, { name: unique('Export groups') });
		const group = await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, {
			name: unique('Export group'),
		});
		groupId = String(group.id);
		await uploadFile(`/api/v1/groups/${groupId}/files`, 'group-notes.txt', 'notes of the group');

		owner = await createUserWithToken('Export owner');
		removePersona = await createTokenPersona(persona, owner.token as string);
		await uploadFile('/api/v1/users/self/files', 'my-own-file.txt', 'a personal file', { token: owner.token });
	});

	afterAll(async () => {
		await removePersona?.();
		if (courseId) await canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`);
		await deleteUser(owner);
	});

	it('create (course, Common Cartridge): exports the whole course; the archive holds its content', async () => {
		const { created, finished, zip, names } = await exportAndDownload({
			contextType: 'course',
			courseId,
			exportType: 'common_cartridge',
			additionalFields: { skip_notifications: true },
		});
		exportIds.push(String(created.id));
		expect(created).toMatchObject({ export_type: 'common_cartridge', course_id: Number(courseId), user_id: Number(fx('adminUserId')) });
		expect((finished.attachment as Json).filename ?? (finished.attachment as Json).display_name).toMatch(/\.imscc$/);

		expect(names).toContain('imsmanifest.xml');
		expect(names).toEqual(expect.arrayContaining(['wiki_content/export-page-alpha.html', 'wiki_content/export-page-beta.html']));
		expect(names).toEqual(expect.arrayContaining(['web_resources/folder-alpha/file-alpha.txt', 'web_resources/folder-beta/file-beta.txt']));
		expect(zipRead(zip, 'wiki_content/export-page-alpha.html')).toContain('Body of page alpha – Ünïcødé 页');
		const everything = names.filter((n) => /\.(xml|html|qti)$/.test(n)).map((n) => zipRead(zip, n)).join('\n');
		for (const kind of ['page', 'assignment', 'quiz', 'discussion', 'announcement', 'event', 'module', 'rubric']) {
			for (const key of ['alpha', 'beta']) {
				expect(everything, `${kind} ${key}`).toMatch(new RegExp(`Export ${kind} ${key}`, 'i'));
			}
		}
	});

	it('create (course, Common Cartridge): every Select field limits the export to the chosen objects', async () => {
		const { created, zip, names } = await exportAndDownload({
			contextType: 'course',
			courseId,
			exportType: 'common_cartridge',
			additionalFields: {
				select_pages: ids.page_alpha,
				select_assignments: ` ${ids.assignment_alpha} `,
				select_quizzes: ids.quiz_alpha,
				select_discussion_topics: ids.discussion_alpha,
				select_announcements: ids.announcement_alpha,
				select_calendar_events: ids.event_alpha,
				select_files: ids.file_alpha,
				select_attachments: ids.file_alpha,
				select_folders: ids.folder_alpha,
				select_modules: ids.module_alpha,
				select_module_items: ids.item_alpha,
				select_rubrics: ids.rubric_alpha,
				skip_notifications: true,
			},
		});
		exportIds.push(String(created.id));

		const everything = names.join('\n') + '\n' + names.filter((n) => /\.(xml|html|qti)$/.test(n)).map((n) => zipRead(zip, n)).join('\n');
		for (const kind of ['page', 'assignment', 'quiz', 'discussion', 'announcement', 'event', 'module', 'rubric']) {
			expect(everything, `selected ${kind}`).toMatch(new RegExp(`Export ${kind} alpha`, 'i'));
			expect(everything, `unselected ${kind}`).not.toMatch(new RegExp(`Export ${kind} beta`, 'i'));
		}
		expect(names).toContain('wiki_content/export-page-alpha.html');
		expect(names).not.toContain('wiki_content/export-page-beta.html');
		expect(names).toContain('web_resources/folder-alpha/file-alpha.txt');
		expect(names.join('\n')).not.toContain('file-beta.txt');
	});

	it('create (course, QTI): exports quizzes, all of them or the selected ones', async () => {
		const all = await exportAndDownload({ contextType: 'course', courseId, exportType: 'qti' });
		exportIds.push(String(all.created.id));
		expect(all.created).toMatchObject({ export_type: 'qti' });
		const allText = zipRead(all.zip, 'imsmanifest.xml') + all.names.join('\n');
		expect(all.names.filter((n) => n.endsWith('assessment_meta.xml'))).toHaveLength(2);
		expect(allText).not.toContain('wiki_content');

		const selected = await exportAndDownload({
			contextType: 'course',
			courseId,
			exportType: 'qti',
			additionalFields: { select_quizzes: ids.quiz_beta },
		});
		exportIds.push(String(selected.created.id));
		const metas = selected.names.filter((n) => n.endsWith('assessment_meta.xml'));
		expect(metas).toHaveLength(1);
		expect(zipRead(selected.zip, metas[0])).toContain('Export quiz beta');
	});

	it('create (course, ZIP): exports files, all of them, selected files or selected folders', async () => {
		const all = await exportAndDownload({ contextType: 'course', courseId, exportType: 'zip' });
		exportIds.push(String(all.created.id));
		expect(all.created).toMatchObject({ export_type: 'zip' });
		expect(all.names.filter((n) => n.endsWith('.txt')).sort()).toEqual(['folder-alpha/file-alpha.txt', 'folder-beta/file-beta.txt']);
		expect(zipRead(all.zip, 'folder-alpha/file-alpha.txt')).toBe('content of alpha');

		const oneFile = await exportAndDownload({
			contextType: 'course',
			courseId,
			exportType: 'zip',
			additionalFields: { select_files: ids.file_beta },
		});
		exportIds.push(String(oneFile.created.id));
		expect(oneFile.names.filter((n) => n.endsWith('.txt'))).toEqual(['file-beta.txt']);

		const oneFolder = await exportAndDownload({
			contextType: 'course',
			courseId,
			exportType: 'zip',
			// IDs as an array from an expression.
			additionalFields: { select_folders: `={{ [${ids.folder_alpha}] }}` },
		});
		exportIds.push(String(oneFolder.created.id));
		expect(oneFolder.names.filter((n) => n.endsWith('.txt'))).toEqual(['folder-alpha/file-alpha.txt']);
	});

	it('create (group): zips the files of a group', async () => {
		const { created, zip, names } = await exportAndDownload({ contextType: 'group', groupId, exportType: 'zip' });
		expect(created).toMatchObject({ export_type: 'zip' });
		// Files uploaded without a folder live in the group's "unfiled" folder.
		expect(names).toContain('unfiled/group-notes.txt');
		expect(zipRead(zip, 'unfiled/group-notes.txt')).toBe('notes of the group');

		const listed = await runOk({ resource: 'contentExport', operation: 'getAll', params: { contextType: 'group', groupId } });
		expect(listed.map((e) => e.id)).toEqual([created.id]);
	});

	it('create (user): a user zips their own files; nobody else can open the export', async () => {
		const { created, zip, names } = await exportAndDownload({ contextType: 'user', userId: 'self', exportType: 'zip' }, persona);
		expect(created).toMatchObject({ export_type: 'zip', user_id: Number(owner!.id) });
		expect(names).toContain('unfiled/my-own-file.txt');
		expect(zipRead(zip, 'unfiled/my-own-file.txt')).toBe('a personal file');

		// By numeric user ID (arriving as a number from an expression) instead of "self".
		const [byId] = await runOk({
			resource: 'contentExport',
			operation: 'get',
			persona,
			items: [{ user: Number(owner!.id), export: created.id }],
			params: { contextType: 'user', userId: '={{ $json.user }}', contentExportId: '={{ $json.export }}' },
		});
		expect(byId).toMatchObject({ id: created.id, workflow_state: 'exported' });
		const listed = await runOk({
			resource: 'contentExport',
			operation: 'getAll',
			persona,
			params: { contextType: 'user', userId: owner!.id },
		});
		expect(listed.map((e) => e.id)).toEqual([created.id]);

		// Even an account admin may not open a user's personal export.
		const asAdmin = await runNode({
			resource: 'contentExport',
			operation: 'get',
			params: {
				contextType: 'user',
				userId: owner!.id,
				contentExportId: String(created.id),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(asAdmin.success).toEqual([]);
		expect(asAdmin.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'get' });
		const adminList = await runOk({
			resource: 'contentExport',
			operation: 'getAll',
			params: { contextType: 'user', userId: owner!.id },
		});
		expect(adminList.map((e) => e.id)).toEqual(
			(await canvas().getAll<Json>(`/api/v1/users/${owner!.id}/content_exports`)).map((e) => e.id),
		);
	});

	it('getAll: lists the exports of the course, newest first, and pages through them', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/content_exports`);
		expect(expected.map((e) => String(e.id))).toEqual([...exportIds].reverse());
		expect(expected.length).toBeGreaterThanOrEqual(7);

		const all = await runOk({ resource: 'contentExport', operation: 'getAll', params: { contextType: 'course', courseId } });
		expect(all.map((e) => e.id)).toEqual(expected.map((e) => e.id));
		expect(all.every((e) => e.workflow_state === 'exported')).toBe(true);

		const twoPages = await runOk({
			resource: 'contentExport',
			operation: 'getAll',
			params: { contextType: 'course', courseId, pagination: { perPage: 2, maxPages: 2 } },
		});
		expect(twoPages.map((e) => e.id)).toEqual(expected.slice(0, 4).map((e) => e.id));

		const everything = await runOk({
			resource: 'contentExport',
			operation: 'getAll',
			params: { contextType: 'course', courseId: `${courseId}`, pagination: { returnAll: true, perPage: 3 } },
		});
		expect(everything.map((e) => e.id)).toEqual(expected.map((e) => e.id));

		const none = await runOk({
			resource: 'contentExport',
			operation: 'getAll',
			params: { contextType: 'course', courseId: fx('emptyCourseId') },
		});
		expect(none).toEqual([]);
	});

	it('getContentList: what a course contains, by type', async () => {
		const expected = await canvas().get<Json[]>(`/api/v1/courses/${courseId}/content_list`);
		const types = await runOk({ resource: 'contentExport', operation: 'getContentList', params: { courseId } });
		expect(types).toEqual(expected);
		const byType = Object.fromEntries(types.map((t) => [String(t.type), t]));
		expect(byType.wiki_pages).toMatchObject({ count: 2, property: 'select[all_wiki_pages]' });
		expect(byType.assignments).toMatchObject({ count: 2 });
		expect(byType.quizzes).toMatchObject({ count: 2 });
		expect(byType.context_modules).toMatchObject({ count: 2 });

		const pages = await runOk({
			resource: 'contentExport',
			operation: 'getContentList',
			params: { courseId, options: { type: 'wiki_pages' } },
		});
		expect(pages.map((p) => p.title).sort()).toEqual(['Export page alpha', 'Export page beta']);
		// The numeric part of each "id" is what the Select fields of Create take.
		expect(pages.map((p) => p.id).sort()).toEqual([`wiki_page_${ids.page_alpha}`, `wiki_page_${ids.page_beta}`].sort());

		const files = await runOk({
			resource: 'contentExport',
			operation: 'getContentList',
			params: { courseId, options: { type: 'attachments' } },
		});
		expect(JSON.stringify(files)).toContain('file-alpha.txt');
	});

	it('errors: students may not export a cartridge; unknown exports and courses are 404', async () => {
		const forbidden = await runNode({
			resource: 'contentExport',
			operation: 'create',
			persona: 'student',
			params: {
				contextType: 'course',
				courseId: fx('courseId'),
				exportType: 'common_cartridge',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'contentExport', operation: 'create' });
		expect([401, 403]).toContain(forbidden.error[0].errorCode);

		const missing = await runNode({
			resource: 'contentExport',
			operation: 'get',
			items: [{ id: exportIds[0] }, { id: '99999999' }],
			params: {
				contextType: 'course',
				courseId,
				contentExportId: '={{ $json.id }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(missing.success.map((e) => String(e.id))).toEqual([exportIds[0]]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'get' });

		const noCourse = await runNode({
			resource: 'contentExport',
			operation: 'create',
			params: {
				contextType: 'course',
				courseId: '99999999',
				exportType: 'zip',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(noCourse.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const listForbidden = await runNode({
			resource: 'contentExport',
			operation: 'getContentList',
			persona: 'student',
			params: { courseId: fx('courseId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(listForbidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'getContentList' });
	});
});
