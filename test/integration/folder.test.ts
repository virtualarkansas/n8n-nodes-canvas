import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { BULK, ensureFilesBattery, uploadDirect } from './contentBattery';
import type { FilesBattery } from './contentBattery';

/**
 * Resource: folder. Runs in the files battery course ("bulk-folders" holds
 * more than 100 folders, "bulk-files" more than 100 files). Everything the
 * tests create lives in one work folder that is deleted at the end.
 */
describe('folder', () => {
	let battery: FilesBattery;
	let courseId = '';
	let workFolderId = '';
	let folderId = '';
	const workFolderName = unique('folders').replace(/\s/g, '-');
	const strays: string[] = [];

	const folderFromCanvas = (id: unknown): Promise<Json> => canvas().get<Json>(`/api/v1/folders/${String(id)}`);
	const subFolders = (id: unknown): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/folders/${String(id)}/folders`);
	const ids = (list: Json[]): unknown[] => list.map((f) => f.id);

	beforeAll(async () => {
		battery = await ensureFilesBattery();
		courseId = battery.courseId;
		workFolderId = String((await canvas().post<Json>(`/api/v1/folders/${battery.rootFolderId}/folders`, { name: workFolderName })).id);
	}, 1_200_000);

	afterAll(async () => {
		if (workFolderId) await canvas().request('DELETE', `/api/v1/folders/${workFolderId}?force=true`);
		for (const id of strays) await canvas().request('DELETE', `/api/v1/folders/${id}?force=true`);
	});

	it('create: every optional field reaches Canvas', async () => {
		const name = 'Ordner ünï 文件夹 "quoted" & more';
		const [folder] = await runOk({
			resource: 'folder',
			operation: 'create',
			params: {
				contextType: 'course',
				courseId,
				name,
				additionalFields: {
					hidden: true,
					lock_at: '2032-03-01T12:00:00Z',
					locked: false,
					parent_folder_id: workFolderId,
					position: 3,
					unlock_at: '2032-01-15T12:00:00Z',
				},
			},
		});
		folderId = String(folder.id);
		expect(await folderFromCanvas(folderId)).toMatchObject({
			name,
			full_name: `course files/${workFolderName}/${name}`,
			parent_folder_id: Number(workFolderId),
			context_type: 'Course',
			context_id: Number(courseId),
			hidden: true,
			locked: false,
			lock_at: '2032-03-01T12:00:00Z',
			unlock_at: '2032-01-15T12:00:00Z',
			position: 3,
		});
	});

	it('create: "parent folder path" creates the missing folders on the way', async () => {
		const [folder] = await runOk({
			resource: 'folder',
			operation: 'create',
			params: {
				contextType: 'course',
				courseId,
				name: 'leaf',
				additionalFields: { parent_folder_path: `${workFolderName}/made by path/level 2`, locked: true },
			},
		});
		expect(await folderFromCanvas(folder.id)).toMatchObject({
			full_name: `course files/${workFolderName}/made by path/level 2/leaf`,
			locked: true,
		});
	});

	it('create: without a parent Canvas files the folder under "unfiled"', async () => {
		const name = unique('no parent');
		const [folder] = await runOk({ resource: 'folder', operation: 'create', params: { contextType: 'course', courseId, name } });
		strays.push(String(folder.id));
		expect(folder).toMatchObject({ full_name: `course files/unfiled/${name}`, locked: false });
		const parent = await folderFromCanvas(folder.parent_folder_id);
		expect(parent).toMatchObject({ name: 'unfiled', parent_folder_id: Number(battery.rootFolderId) });
	});

	it('create: folder, group, user and account contexts', async () => {
		const [inFolder] = await runOk({
			resource: 'folder',
			operation: 'create',
			items: [{ parent: Number(folderId) }],
			params: { contextType: 'folder', parentFolderId: '={{ $json.parent }}', name: 'child of a folder' },
		});
		expect(inFolder.parent_folder_id).toBe(Number(folderId));

		const [inGroup] = await runOk({
			resource: 'folder',
			operation: 'create',
			params: { contextType: 'group', groupId: battery.groupId, name: unique('group folder') },
		});
		strays.push(String(inGroup.id));
		expect(inGroup).toMatchObject({ context_type: 'Group', context_id: Number(battery.groupId) });

		const [inUser] = await runOk({
			resource: 'folder',
			operation: 'create',
			persona: 'student2',
			params: { contextType: 'user', userId: 'self', name: unique('my folder') },
		});
		strays.push(String(inUser.id));
		expect(inUser).toMatchObject({ context_type: 'User', context_id: Number(fx('student2UserId')) });

		const [inAccount] = await runOk({
			resource: 'folder',
			operation: 'create',
			params: { contextType: 'account', accountId: fx('accountId'), name: unique('account folder') },
		});
		strays.push(String(inAccount.id));
		expect(inAccount).toMatchObject({ context_type: 'Account', context_id: Number(fx('accountId')) });
	});

	it('create: a name already used in the parent gets a number; several items in one run', async () => {
		const result = await runNode({
			resource: 'folder',
			operation: 'create',
			items: [{ n: 1 }, { n: 2 }, { n: 3 }],
			params: {
				contextType: 'folder',
				parentFolderId: workFolderId,
				name: 'twin',
				batchProcessing: { mode: 'individual' },
			},
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		expect(result.success.map((f) => f.name)).toEqual(['twin', 'twin 2', 'twin 3']);
	});

	it('create: Canvas refuses conflicting parents, unknown parents and students', async () => {
		const run = (params: Json, persona = 'admin'): ReturnType<typeof runNode> =>
			runNode({
				resource: 'folder',
				operation: 'create',
				persona,
				params: { name: 'refused', ...params, errorHandling: { onError: 'continueWithError' } },
			});
		const both = await run({
			contextType: 'course',
			courseId,
			additionalFields: { parent_folder_id: workFolderId, parent_folder_path: 'x/y' },
		});
		expect(both.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'folder' });

		const folderAndParent = await run({ contextType: 'folder', parentFolderId: workFolderId, additionalFields: { parent_folder_id: folderId } });
		expect(folderAndParent.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });

		const unknown = await run({ contextType: 'course', courseId, additionalFields: { parent_folder_id: '999999999' } });
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const student = await run({ contextType: 'course', courseId }, 'student');
		expect(student.success).toEqual([]);
		expect(student.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
	});

	it('get: returns the folder; a missing folder is not found', async () => {
		const [folder] = await runOk({ resource: 'folder', operation: 'get', params: { folderId } });
		expect(folder).toMatchObject({ id: Number(folderId), parent_folder_id: Number(workFolderId), folders_count: 1, files_count: 0 });

		const mixed = await runNode({
			resource: 'folder',
			operation: 'get',
			items: [{ id: Number(battery.bulkFoldersId) }, { id: 999999999 }, { id: battery.bulkFilesId }],
			params: { folderId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(mixed.success.map((f) => f.name)).toEqual(['bulk-folders', 'bulk-files']);
		expect(mixed.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(mixed.error).toHaveLength(1);
		expect(mixed.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'folder', operation: 'get' });
	});

	it('getAll: the direct sub-folders of a folder, paginated', async () => {
		const expected = await subFolders(battery.bulkFoldersId);
		expect(expected).toHaveLength(BULK);
		const params = { contextType: 'folder', parentFolderId: battery.bulkFoldersId };

		const defaults = await runOk({ resource: 'folder', operation: 'getAll', params });
		expect(ids(defaults)).toEqual(ids(expected.slice(0, 50)));

		const all = await runOk({ resource: 'folder', operation: 'getAll', params: { ...params, pagination: { returnAll: true } } });
		expect(ids(all)).toEqual(ids(expected));
		expect(new Set(ids(all)).size).toBe(BULK);

		const some = await runOk({ resource: 'folder', operation: 'getAll', params: { ...params, pagination: { perPage: 20, maxPages: 2 } } });
		expect(ids(some)).toEqual(ids(expected.slice(0, 40)));

		const empty = await runOk({ resource: 'folder', operation: 'getAll', params: { contextType: 'folder', parentFolderId: battery.bulkFilesId } });
		expect(empty).toEqual([]);
	});

	it('getAll: every folder of a course, a group and a user', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/folders`);
		expect(expected.length).toBeGreaterThan(BULK);
		const course = await runOk({
			resource: 'folder',
			operation: 'getAll',
			params: { contextType: 'course', courseId, pagination: { returnAll: true } },
		});
		expect(ids(course).sort()).toEqual(ids(expected).sort());
		expect(course.map((f) => f.full_name)).toContain(`course files/${workFolderName}/made by path/level 2/leaf`);

		const group = await runOk({
			resource: 'folder',
			operation: 'getAll',
			params: { contextType: 'group', groupId: battery.groupId, pagination: { returnAll: true } },
		});
		expect(ids(group).sort()).toEqual(ids(await canvas().getAll<Json>(`/api/v1/groups/${battery.groupId}/folders`)).sort());
		expect(group.every((f) => f.context_type === 'Group')).toBe(true);

		const own = await runOk({
			resource: 'folder',
			operation: 'getAll',
			persona: 'student2',
			params: { contextType: 'user', userId: 'self', pagination: { returnAll: true } },
		});
		expect(ids(own).sort()).toEqual(ids(await new CanvasClient('student2').getAll<Json>('/api/v1/users/self/folders')).sort());
		expect(own.every((f) => f.context_type === 'User')).toBe(true);
	});

	it('getByPath: resolves a path to the folders along it', async () => {
		const [root, bulk, leaf] = await runOk({
			resource: 'folder',
			operation: 'getByPath',
			params: { contextType: 'course', courseId, folderPath: 'bulk-folders/folder-042' },
		});
		expect(root.id).toBe(Number(battery.rootFolderId));
		expect(bulk.id).toBe(Number(battery.bulkFoldersId));
		expect(leaf).toMatchObject({ name: 'folder-042', parent_folder_id: Number(battery.bulkFoldersId) });

		// Names with spaces, non-ASCII characters, quotes and ampersands; stray slashes are tolerated.
		const awkward = await runOk({
			resource: 'folder',
			operation: 'getByPath',
			params: { contextType: 'course', courseId, folderPath: `/${workFolderName}/Ordner ünï 文件夹 "quoted" & more/` },
		});
		expect(awkward.map((f) => f.id)).toEqual([Number(battery.rootFolderId), Number(workFolderId), Number(folderId)]);

		const nested = await runOk({
			resource: 'folder',
			operation: 'getByPath',
			params: { contextType: 'course', courseId, folderPath: `${workFolderName}/made by path/level 2/leaf` },
		});
		expect(nested).toHaveLength(5);
		expect(nested[4].name).toBe('leaf');
	});

	it('getByPath: an empty path is the root folder; group and user contexts; unknown paths', async () => {
		const courseRoot = await runOk({ resource: 'folder', operation: 'getByPath', params: { contextType: 'course', courseId, folderPath: '' } });
		expect(courseRoot.map((f) => f.id)).toEqual([Number(battery.rootFolderId)]);

		const groupRoot = await runOk({
			resource: 'folder',
			operation: 'getByPath',
			params: { contextType: 'group', groupId: battery.groupId },
		});
		expect(groupRoot).toHaveLength(1);
		expect(groupRoot[0]).toMatchObject({ context_type: 'Group', parent_folder_id: null });

		const userRoot = await runOk({
			resource: 'folder',
			operation: 'getByPath',
			persona: 'student2',
			params: { contextType: 'user', userId: 'self', folderPath: '' },
		});
		expect(userRoot[0]).toMatchObject({ context_type: 'User', context_id: Number(fx('student2UserId')), parent_folder_id: null });

		const missing = await runNode({
			resource: 'folder',
			operation: 'getByPath',
			params: { contextType: 'course', courseId, folderPath: 'bulk-folders/no such folder', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getByPath' });
	});

	it('listFiles: pages through the files of a folder and honours the filters', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/folders/${battery.bulkFilesId}/files`);
		const params = { folderId: battery.bulkFilesId };
		const defaults = await runOk({ resource: 'folder', operation: 'listFiles', params });
		expect(ids(defaults)).toEqual(ids(expected.slice(0, 50)));
		const all = await runOk({ resource: 'folder', operation: 'listFiles', params: { ...params, pagination: { returnAll: true } } });
		expect(ids(all)).toEqual(ids(expected));

		const run = (options: Json): Promise<Json[]> =>
			runOk({ resource: 'folder', operation: 'listFiles', params: { ...params, options, pagination: { returnAll: true } } });
		expect(await run({ content_types: 'image/png' })).toHaveLength(35);
		expect(await run({ content_types: 'text/csv,image' })).toHaveLength(70);
		expect(await run({ exclude_content_types: 'image, text/csv' })).toHaveLength(35);
		const searched = await run({ search_term: 'bulk-09', sort: 'name', order: 'desc', include: ['usage_rights', 'user'] });
		expect(searched.map((f) => f.display_name)).toEqual(
			['bulk-099', 'bulk-098', 'bulk-097', 'bulk-096', 'bulk-095', 'bulk-094', 'bulk-093', 'bulk-092', 'bulk-091', 'bulk-090'].map(
				(base, index) => `${base}.${['png', 'csv', 'txt'][index % 3]}`,
			),
		);
		expect(searched[0].user).toMatchObject({ id: Number(fx('adminUserId')) });
		expect(searched[0]).toHaveProperty('usage_rights');
		const bySize = await run({ sort: 'size', order: 'asc' });
		const sizes = bySize.map((f) => Number(f.size));
		expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
		for (const sort of ['content_type', 'created_at', 'updated_at', 'user']) {
			expect(await run({ sort }), sort).toHaveLength(BULK);
		}
		const namesOnly = await run({ only_names: true, search_term: 'bulk-001' });
		expect(namesOnly).toHaveLength(1);
		expect(namesOnly[0]).not.toHaveProperty('size');

		expect(await runOk({ resource: 'folder', operation: 'listFiles', params: { folderId } })).toEqual([]);
	});

	it('update: every field reaches Canvas', async () => {
		const target = String((await canvas().post<Json>(`/api/v1/folders/${workFolderId}/folders`, { name: 'move target' })).id);
		const [updated] = await runOk({
			resource: 'folder',
			operation: 'update',
			params: {
				folderId,
				updateFields: {
					hidden: false,
					lock_at: '2033-03-01T12:00:00Z',
					locked: true,
					name: 'Umbenannt ünï',
					parent_folder_id: target,
					position: 7,
					unlock_at: '2033-01-15T12:00:00Z',
				},
			},
		});
		expect(updated.id).toBe(Number(folderId));
		expect(await folderFromCanvas(folderId)).toMatchObject({
			name: 'Umbenannt ünï',
			full_name: `course files/${workFolderName}/move target/Umbenannt ünï`,
			parent_folder_id: Number(target),
			locked: true,
			lock_at: '2033-03-01T12:00:00Z',
			unlock_at: '2033-01-15T12:00:00Z',
			position: 7,
		});
		// Canvas reports a folder that is not hidden as null rather than false.
		expect((await folderFromCanvas(folderId)).hidden).toBeFalsy();

		await runOk({
			resource: 'folder',
			operation: 'update',
			params: { folderId, updateFields: { hidden: true, lock_at: '', locked: false, unlock_at: '' } },
		});
		expect(await folderFromCanvas(folderId)).toMatchObject({ hidden: true, locked: false, lock_at: null, unlock_at: null });
	});

	it('copy: copies a folder with its files and sub-folders', async () => {
		await uploadDirect(canvas(), `/api/v1/folders/${folderId}/files`, 'inside.txt', Buffer.from('inside'), 'text/plain');
		const destination = String((await canvas().post<Json>(`/api/v1/folders/${workFolderId}/folders`, { name: 'copy destination' })).id);

		const [copy] = await runOk({
			resource: 'folder',
			operation: 'copy',
			params: { sourceFolderId: folderId, destinationFolderId: destination },
		});
		expect(copy.id).not.toBe(Number(folderId));
		expect(copy).toMatchObject({ name: 'Umbenannt ünï', parent_folder_id: Number(destination) });
		const copiedFiles = await canvas().getAll<Json>(`/api/v1/folders/${String(copy.id)}/files`);
		expect(copiedFiles.map((f) => f.display_name)).toEqual(['inside.txt']);
		expect((await subFolders(copy.id)).map((f) => f.name)).toEqual(['child of a folder']);
		// The original is untouched.
		expect((await folderFromCanvas(folderId)).files_count).toBe(1);

		// Into the root folder of a group.
		const groupRoot = await canvas().get<Json>(`/api/v1/groups/${battery.groupId}/folders/root`);
		const [intoGroup] = await runOk({
			resource: 'folder',
			operation: 'copy',
			items: [{ source: Number(folderId), destination: groupRoot.id }],
			params: { sourceFolderId: '={{ $json.source }}', destinationFolderId: '={{ $json.destination }}' },
		});
		strays.push(String(intoGroup.id));
		expect(intoGroup).toMatchObject({ context_type: 'Group', parent_folder_id: groupRoot.id });

		const intoItself = await runNode({
			resource: 'folder',
			operation: 'copy',
			params: { sourceFolderId: workFolderId, destinationFolderId: folderId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(intoItself.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			errorMessage: 'source folder may not contain destination folder',
		});
	});

	it('delete: a folder with content needs "force"; the root folder cannot be deleted', async () => {
		const refused = await runNode({
			resource: 'folder',
			operation: 'delete',
			params: { folderId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'delete' });
		const alsoRefused = await runNode({
			resource: 'folder',
			operation: 'delete',
			params: { folderId, options: { force: false }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(alsoRefused.error[0]).toMatchObject({ errorCode: 400 });
		expect((await canvas().request('GET', `/api/v1/folders/${folderId}`)).status).toBe(200);

		const [deleted] = await runOk({ resource: 'folder', operation: 'delete', params: { folderId, options: { force: true } } });
		expect(deleted.id).toBe(Number(folderId));
		expect((await canvas().request('GET', `/api/v1/folders/${folderId}`)).status).toBe(404);

		const root = await runNode({
			resource: 'folder',
			operation: 'delete',
			params: { folderId: battery.rootFolderId, options: { force: true }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(root.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect((await canvas().request('GET', `/api/v1/folders/${battery.rootFolderId}`)).status).toBe(200);
	});

	it('delete: empty folders in one run, with the missing one reported', async () => {
		const twins = (await subFolders(workFolderId)).filter((f) => String(f.name).startsWith('twin'));
		expect(twins).toHaveLength(3);
		const result = await runNode({
			resource: 'folder',
			operation: 'delete',
			items: [...twins.map((f) => ({ id: f.id })), { id: 999999999 }, { id: Number(folderId) }],
			params: { folderId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		// Deleting a folder that was already deleted (the last item) is not an error for Canvas.
		expect(ids(result.success)).toEqual([...ids(twins), Number(folderId)]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		expect((result.error[0].originalItem as Json).id).toBe(999999999);
		expect((await subFolders(workFolderId)).some((f) => String(f.name).startsWith('twin'))).toBe(false);
	});
});
