import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { networkInterfaces } from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { BULK, downloadFile, ensureFilesBattery, patternBuffer, runWithBinary, uploadDirect } from './contentBattery';
import type { FilesBattery } from './contentBattery';

/**
 * Resource: file, including the three-step upload (binary data and from a
 * URL). Runs in a dedicated course whose "bulk-files" folder holds more than
 * 100 files of three content types (see contentBattery.ts). Everything the
 * tests upload goes into a folder of its own that is deleted at the end.
 */
describe('file', () => {
	let battery: FilesBattery;
	let courseId = '';
	let workFolderId = '';
	let otherFolderId = '';
	const workFolderName = unique('uploads').replace(/\s/g, '-');
	/** Files outside the work folder (user and group files) to delete afterwards. */
	const strays: string[] = [];

	let server: Server;
	let serverUrl = '';
	// Content that is new on every run: Canvas stores identical content only once, and a file
	// fetched from a URL whose content it already has is then reported without a size.
	const stamp = unique('run');
	const helloText = `served by the battery ${stamp}\n`;
	const awkwardText = `awkward url ${stamp}\n`;
	const served: Record<string, { body: Buffer; type: string }> = {
		'/hello.txt': { body: Buffer.from(helloText), type: 'text/plain' },
		'/data.bin': { body: Buffer.concat([Buffer.from(stamp), patternBuffer(300_000 - Buffer.byteLength(stamp))]), type: 'application/octet-stream' },
		'/name with spaces & ünï.txt': { body: Buffer.from(awkwardText), type: 'text/plain' },
	};

	const sha = (buffer: Buffer): string => createHash('sha256').update(buffer).digest('hex');
	const fileFromCanvas = (id: unknown, query = ''): Promise<Json> => canvas().get<Json>(`/api/v1/files/${String(id)}${query}`);
	const filesIn = (folderId: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/folders/${folderId}/files`);
	const names = (list: Json[]): string[] => list.map((f) => String(f.display_name)).sort();
	const upload = (params: Json, inputs: Parameters<typeof runWithBinary>[1], persona = 'admin'): ReturnType<typeof runWithBinary> =>
		runWithBinary({ resource: 'file', operation: 'upload', persona, params }, inputs);
	const newFolder = async (name: string, parent = workFolderId): Promise<string> =>
		String((await canvas().post<Json>(`/api/v1/folders/${parent}/folders`, { name })).id);

	beforeAll(async () => {
		battery = await ensureFilesBattery();
		courseId = battery.courseId;
		// Work folders of runs that were interrupted before they could clean up.
		for (const stale of await canvas().getAll<Json>(`/api/v1/folders/${battery.rootFolderId}/folders`)) {
			if (/^uploads-/.test(String(stale.name))) await canvas().request('DELETE', `/api/v1/folders/${String(stale.id)}?force=true`);
		}
		workFolderId = String((await canvas().post<Json>(`/api/v1/folders/${battery.rootFolderId}/folders`, { name: workFolderName })).id);
		otherFolderId = await newFolder('other');

		// Canvas refuses to fetch from loopback and private addresses, so serve the test
		// files on an address of this machine that is neither.
		const blocked = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
		const address = Object.values(networkInterfaces())
			.flat()
			.find((entry) => entry && entry.family === 'IPv4' && !entry.internal && !blocked.test(entry.address))?.address;
		server = createServer((req, res) => {
			const file = served[decodeURIComponent((req.url ?? '').split('?')[0])];
			if (!file) {
				res.writeHead(404, { 'content-type': 'text/plain' });
				res.end('not here');
				return;
			}
			res.writeHead(200, { 'content-type': file.type, 'content-length': file.body.length });
			res.end(file.body);
		});
		await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
		const port = (server.address() as { port: number }).port;
		serverUrl = address ? `http://${address}:${port}` : '';
	}, 1_200_000);

	afterAll(async () => {
		server?.close();
		if (workFolderId) await canvas().request('DELETE', `/api/v1/folders/${workFolderId}?force=true`);
		for (const id of strays) await canvas().request('DELETE', `/api/v1/files/${id}`);
	});

	// ------------------------------------------------------------ upload: binary

	it('upload: binary data into a course, with name and type taken from the binary property', async () => {
		const content = Buffer.from('Hello Canvas, ünï 课程 🚀\n');
		const result = await upload({ contextType: 'course', courseId, options: { parent_folder_id: workFolderId } }, [
			{ fileName: 'hello.txt', mimeType: 'text/plain', b64: content.toString('base64') },
		]);
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		const [file] = result.success;
		expect(file).toMatchObject({ display_name: 'hello.txt', size: content.length, 'content-type': 'text/plain', folder_id: Number(workFolderId) });
		expect(await fileFromCanvas(file.id)).toMatchObject({ display_name: 'hello.txt', size: content.length, upload_status: 'success' });
		expect((await downloadFile(file)).equals(content)).toBe(true);
	});

	it('upload: without a folder the file lands in the root folder of the course', async () => {
		const name = `${unique('root').replace(/\s/g, '-')}.txt`;
		const result = await upload({ contextType: 'course', courseId }, [{ fileName: name, mimeType: 'text/plain', b64: 'cm9vdA==' }]);
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		const file = await fileFromCanvas(result.success[0].id);
		const folder = await canvas().get<Json>(`/api/v1/folders/${String(file.folder_id)}`);
		expect(folder.context_type).toBe('Course');
		expect(folder.context_id).toBe(Number(courseId));
		await canvas().delete(`/api/v1/files/${String(file.id)}`);
	});

	it('upload: every option', async () => {
		const content = Buffer.from('%PDF-1.4 not really a pdf');
		const result = await upload(
			{
				contextType: 'course',
				courseId,
				options: {
					content_type: 'application/pdf',
					name: 'Renamed ünï report.pdf',
					on_duplicate: 'rename',
					parent_folder_path: `${workFolderName}/nested ünï/deeper`,
				},
			},
			[{ fileName: 'original-name.bin', mimeType: 'application/octet-stream', b64: content.toString('base64') }],
		);
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		const file = await fileFromCanvas(result.success[0].id);
		expect(file).toMatchObject({ display_name: 'Renamed ünï report.pdf', 'content-type': 'application/pdf', size: content.length });
		const folder = await canvas().get<Json>(`/api/v1/folders/${String(file.folder_id)}`);
		expect(folder.full_name).toBe(`course files/${workFolderName}/nested ünï/deeper`);
	});

	it('upload: on duplicate, "overwrite" replaces the file and "rename" keeps both', async () => {
		const folder = await newFolder('duplicates');
		const params = (onDuplicate?: string): Json => ({
			contextType: 'folder',
			folderId: folder,
			options: onDuplicate ? { on_duplicate: onDuplicate } : {},
		});
		const send = async (text: string, onDuplicate?: string): Promise<Json> => {
			const result = await upload(params(onDuplicate), [{ fileName: 'same.txt', mimeType: 'text/plain', b64: Buffer.from(text).toString('base64') }]);
			expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
			return result.success[0];
		};

		const first = await send('version 1');
		// The Canvas default is to overwrite.
		const second = await send('version 2');
		expect(names(await filesIn(folder))).toEqual(['same.txt']);
		expect((await downloadFile(second)).toString()).toBe('version 2');
		expect((await canvas().request('GET', `/api/v1/files/${String(first.id)}`)).status).toBe(404);

		const third = await send('version 3', 'overwrite');
		expect(names(await filesIn(folder))).toEqual(['same.txt']);
		expect((await downloadFile(third)).toString()).toBe('version 3');

		const renamed = await send('version 4', 'rename');
		expect(renamed.display_name).toBe('same-1.txt');
		expect(names(await filesIn(folder))).toEqual(['same-1.txt', 'same.txt']);
		expect((await downloadFile(third)).toString()).toBe('version 3');
	});

	it('upload: folder, group and user contexts', async () => {
		const content = Buffer.from('context upload');
		const input = { fileName: `${unique('ctx').replace(/\s/g, '-')}.txt`, mimeType: 'text/plain', b64: content.toString('base64') };

		const intoFolder = await upload({ contextType: 'folder', folderId: otherFolderId }, [input]);
		expect(intoFolder.failure, JSON.stringify(intoFolder.failure)).toBeUndefined();
		expect(intoFolder.success[0].folder_id).toBe(Number(otherFolderId));

		const intoGroup = await upload({ contextType: 'group', groupId: battery.groupId }, [input]);
		expect(intoGroup.failure, JSON.stringify(intoGroup.failure)).toBeUndefined();
		strays.push(String(intoGroup.success[0].id));
		const groupFiles = await canvas().getAll<Json>(`/api/v1/groups/${battery.groupId}/files`);
		expect(groupFiles.map((f) => f.id)).toContain(intoGroup.success[0].id);

		// A student uploads to their own files; "self" is the default user.
		const intoUser = await upload({ contextType: 'user', userId: 'self' }, [input], 'student2');
		expect(intoUser.failure, JSON.stringify(intoUser.failure)).toBeUndefined();
		strays.push(String(intoUser.success[0].id));
		const userFiles = await new CanvasClient('student2').getAll<Json>('/api/v1/users/self/files');
		expect(userFiles.map((f) => f.id)).toContain(intoUser.success[0].id);
		expect((await downloadFile(intoUser.success[0])).equals(content)).toBe(true);

		// Canvas only lets users upload to their own files, even for administrators.
		const forUser = await upload(
			{ contextType: 'user', userId: fx('student2UserId'), errorHandling: { onError: 'continueWithError' } },
			[{ ...input, fileName: `admin-${input.fileName}` }],
		);
		expect(forUser.success).toEqual([]);
		expect(forUser.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'upload' });
	});

	it('upload: awkward file names survive, several items in one run', async () => {
		const folder = await newFolder('names');
		const fileNames = [
			'Prüfung – Übung №1 (final) 课程.pdf',
			'my "quoted" file.txt',
			"it's 100% #1 & more?.csv",
			'  padded  name .txt',
			'no-extension',
			'.hidden-file',
			'emoji 🎓📚.txt',
			'semi;colon, comma=equals.txt',
			`${'long-name-'.repeat(20)}end.txt`,
		];
		const result = await upload(
			{ contextType: 'folder', folderId: folder },
			fileNames.map((fileName, index) => ({ fileName, mimeType: 'text/plain', b64: Buffer.from(`content ${index}`).toString('base64') })),
		);
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		expect(result.success).toHaveLength(fileNames.length);
		expect(result.success.map((f) => f.display_name)).toEqual(fileNames);
		expect(names(await filesIn(folder))).toEqual([...fileNames].sort());
		for (const [index, file] of result.success.entries()) {
			expect((await downloadFile(file)).toString(), fileNames[index]).toBe(`content ${index}`);
		}
	});

	it('upload: a file name with a path separator keeps only the last part', async () => {
		const folder = await newFolder('slashes');
		const result = await upload({ contextType: 'folder', folderId: folder }, [
			{ fileName: 'dir/sub/with-slash.txt', mimeType: 'text/plain', b64: 'eA==' },
		]);
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		const listed = names(await filesIn(folder));
		expect(listed).toHaveLength(1);
		expect(listed[0]).toMatch(/with-slash\.txt$/);
	});

	it('upload: one byte, one megabyte and five megabyte files arrive byte for byte', async () => {
		const folder = await newFolder('sizes');
		for (const size of [1, 1_048_576 + 13, 5 * 1_048_576]) {
			const result = await upload({ contextType: 'folder', folderId: folder }, [
				{ fileName: `size-${size}.bin`, mimeType: 'application/octet-stream', size },
			]);
			expect(result.failure, `size ${size}: ${JSON.stringify(result.failure)}`).toBeUndefined();
			const [file] = result.success;
			expect(file.size, `size ${size}`).toBe(size);
			const downloaded = await downloadFile(file);
			expect(downloaded.length).toBe(size);
			expect(sha(downloaded)).toBe(sha(patternBuffer(size)));
		}
	});

	it('upload: Canvas does not accept empty files', async () => {
		const folder = await newFolder('empty');
		const result = await upload({ contextType: 'folder', folderId: folder, errorHandling: { onError: 'continueWithError' } }, [
			{ fileName: 'empty.txt', mimeType: 'text/plain', size: 0 },
		]);
		expect(result.success).toEqual([]);
		// The node says so itself instead of passing on the upload server's bare "400".
		expect(result.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', resource: 'file', operation: 'upload' });
		expect(String(result.error[0].errorMessage)).toContain('The file to upload is empty');
		// Nothing is left behind.
		expect(await filesIn(folder)).toEqual([]);
	});

	it('upload: binary without a file name or type, and a custom binary property', async () => {
		const folder = await newFolder('unnamed');
		const unnamed = await upload({ contextType: 'folder', folderId: folder }, [{ b64: Buffer.from('no name').toString('base64') }]);
		expect(unnamed.failure, JSON.stringify(unnamed.failure)).toBeUndefined();
		expect(unnamed.success[0]).toMatchObject({ display_name: 'unnamed_file', size: 7 });

		const custom = await upload({ contextType: 'folder', folderId: folder, binaryPropertyName: 'attachment' }, [
			{ property: 'attachment', fileName: 'custom-property.txt', mimeType: 'text/plain', b64: 'Y3VzdG9t' },
		]);
		expect(custom.failure, JSON.stringify(custom.failure)).toBeUndefined();
		expect(custom.success[0].display_name).toBe('custom-property.txt');
		expect((await downloadFile(custom.success[0])).toString()).toBe('custom');
	});

	it('upload: an item without binary data fails on its own, the others are uploaded', async () => {
		const folder = await newFolder('mixed');
		const result = await upload(
			{ contextType: 'folder', folderId: folder, errorHandling: { onError: 'continueWithError' } },
			[
				{ fileName: 'first.txt', mimeType: 'text/plain', b64: 'MQ==' },
				{ json: { note: 'no binary here' } },
				{ fileName: 'third.txt', mimeType: 'text/plain', b64: 'Mw==' },
			],
		);
		expect(result.success.map((f) => f.display_name)).toEqual(['first.txt', 'third.txt']);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 0, resource: 'file', operation: 'upload' });
		expect((result.error[0].originalItem as Json).note).toBe('no binary here');
		expect(names(await filesIn(folder))).toEqual(['first.txt', 'third.txt']);
	});

	it('upload: Canvas refusals are reported (unknown course, folder ID and path together, student without rights)', async () => {
		const input = [{ fileName: 'refused.txt', mimeType: 'text/plain', b64: 'eA==' }];
		const onError = { errorHandling: { onError: 'continueWithError' } };

		const unknown = await upload({ contextType: 'course', courseId: '999999999', ...onError }, input);
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'upload' });

		const both = await upload(
			{ contextType: 'course', courseId, options: { parent_folder_id: workFolderId, parent_folder_path: 'x' }, ...onError },
			input,
		);
		expect(both.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });

		const student = await upload({ contextType: 'course', courseId, ...onError }, input, 'student');
		expect(student.success).toEqual([]);
		expect(student.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(student.error[0].errorCode);
	});

	// --------------------------------------------------------------- upload: URL

	it('upload from URL: waits for Canvas to fetch the file and returns it', async () => {
		expect(serverUrl, 'this machine has no address Canvas is willing to fetch from').not.toBe('');
		const [file] = await runOk({
			resource: 'file',
			operation: 'upload',
			params: {
				contextType: 'folder',
				folderId: otherFolderId,
				uploadSource: 'url',
				fileUrl: `${serverUrl}/data.bin`,
				waitForCompletion: true,
			},
		});
		expect(file).toMatchObject({ display_name: 'data.bin', size: 300_000, folder_id: Number(otherFolderId), upload_status: 'success' });
		expect(sha(await downloadFile(file))).toBe(sha(served['/data.bin'].body));
	});

	it('upload from URL: options, and a URL whose file name needs decoding', async () => {
		const [named] = await runOk({
			resource: 'file',
			operation: 'upload',
			params: {
				contextType: 'course',
				courseId,
				uploadSource: 'url',
				fileUrl: `${serverUrl}/hello.txt?token=abc`,
				options: {
					content_type: 'text/markdown',
					name: 'From URL ünï.md',
					on_duplicate: 'rename',
					parent_folder_path: `${workFolderName}/from url`,
				},
			},
		});
		expect(named).toMatchObject({ display_name: 'From URL ünï.md', 'content-type': 'text/markdown' });
		const folder = await canvas().get<Json>(`/api/v1/folders/${String(named.folder_id)}`);
		expect(folder.full_name).toBe(`course files/${workFolderName}/from url`);
		expect((await downloadFile(named)).toString()).toBe(helloText);

		const [decoded] = await runOk({
			resource: 'file',
			operation: 'upload',
			params: {
				contextType: 'folder',
				folderId: otherFolderId,
				uploadSource: 'url',
				fileUrl: `${serverUrl}/${encodeURIComponent('name with spaces & ünï.txt')}`,
			},
		});
		expect(decoded.display_name).toBe('name with spaces & ünï.txt');
		expect((await downloadFile(decoded)).toString()).toBe(awkwardText);
	});

	it('upload from URL: without waiting the progress object is returned', async () => {
		const [started] = await runOk({
			resource: 'file',
			operation: 'upload',
			params: {
				contextType: 'group',
				groupId: battery.groupId,
				uploadSource: 'url',
				fileUrl: `${serverUrl}/hello.txt`,
				waitForCompletion: false,
				options: { name: `${unique('nowait').replace(/\s/g, '-')}.txt` },
			},
		});
		const progress = started.progress as Json;
		expect(progress).toMatchObject({ tag: 'upload_via_url' });
		expect(['queued', 'running', 'completed']).toContain(progress.workflow_state);

		let done: Json = {};
		for (let i = 0; i < 60 && done.workflow_state !== 'completed' && done.workflow_state !== 'failed'; i++) {
			await new Promise((r) => setTimeout(r, 1000));
			done = await canvas().get<Json>(`/api/v1/progress/${String(progress.id)}`);
		}
		expect(done.workflow_state).toBe('completed');
		const fileId = String((done.results as Json).id);
		strays.push(fileId);
		expect((await downloadFile({ id: fileId })).toString()).toBe(helloText);
	});

	it('upload from URL: a URL Canvas cannot fetch fails with the reason', async () => {
		const run = (fileUrl: string): ReturnType<typeof runNode> =>
			runNode({
				resource: 'file',
				operation: 'upload',
				params: {
					contextType: 'folder',
					folderId: otherFolderId,
					uploadSource: 'url',
					fileUrl,
					errorHandling: { onError: 'continueWithError' },
				},
			});
		const missing = await run(`${serverUrl}/does-not-exist.txt`);
		expect(missing.success).toEqual([]);
		expect(String(missing.error[0].errorMessage)).toContain('Canvas URL upload failed');

		// Loopback and private addresses are refused by Canvas itself.
		const port = (server.address() as { port: number }).port;
		const loopback = await run(`http://127.0.0.1:${port}/hello.txt`);
		expect(loopback.success).toEqual([]);
		expect(String(loopback.error[0].errorMessage)).toContain('Canvas URL upload failed');

		// Canvas keeps the placeholder it created for the file: an entry without content.
		const placeholder = (await filesIn(otherFolderId)).find((f) => f.display_name === 'does-not-exist.txt');
		expect(placeholder).toMatchObject({ size: null });
	});

	// ----------------------------------------------------------- initiateUpload

	it('initiateUpload: returns what is needed to send the file, and that really works', async () => {
		const content = Buffer.from('uploaded by hand');
		const [ticket] = await runOk({
			resource: 'file',
			operation: 'initiateUpload',
			params: {
				contextType: 'course',
				courseId,
				fileName: 'manual ünï.txt',
				options: {
					content_type: 'text/plain',
					on_duplicate: 'rename',
					parent_folder_path: `${workFolderName}/manual`,
					size: content.length,
				},
			},
		});
		expect(ticket.upload_url).toBeTypeOf('string');
		expect(ticket.upload_params).toBeTypeOf('object');

		const form = new FormData();
		for (const [key, value] of Object.entries(ticket.upload_params as Json)) form.append(key, String(value));
		form.append(String(ticket.file_param ?? 'file'), new Blob([new Uint8Array(content)], { type: 'text/plain' }), 'manual ünï.txt');
		const sent = await fetch(String(ticket.upload_url), { method: 'POST', body: form, redirect: 'manual' });
		expect(sent.status).toBeLessThan(400);
		const confirmed = await canvas().request('GET', String(sent.headers.get('location')));
		const file = confirmed.data as Json;
		expect(file).toMatchObject({ display_name: 'manual ünï.txt', size: content.length, 'content-type': 'text/plain' });
		const folder = await canvas().get<Json>(`/api/v1/folders/${String(file.folder_id)}`);
		expect(folder.full_name).toBe(`course files/${workFolderName}/manual`);
	});

	it('initiateUpload: folder, group and user contexts; a size over the quota is refused at once', async () => {
		const contexts: Json[] = [
			{ contextType: 'folder', folderId: otherFolderId },
			{ contextType: 'group', groupId: battery.groupId },
			{ contextType: 'user', userId: 'self' },
		];
		for (const context of contexts) {
			const [ticket] = await runOk({ resource: 'file', operation: 'initiateUpload', params: { ...context, fileName: 'ticket.txt' } });
			expect(ticket.upload_url, JSON.stringify(context)).toBeTypeOf('string');
		}
		const tooBig = await runNode({
			resource: 'file',
			operation: 'initiateUpload',
			params: {
				contextType: 'course',
				courseId,
				fileName: 'huge.bin',
				options: { size: 900_000_000_000 },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(tooBig.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
	});

	// ------------------------------------------------------------ get / getAll

	it('get: returns the file, with includes', async () => {
		const [bulk] = await canvas().get<Json[]>(`/api/v1/folders/${battery.bulkFilesId}/files?per_page=1`);
		const [file] = await runOk({
			resource: 'file',
			operation: 'get',
			items: [{ id: bulk.id }],
			params: {
				fileId: '={{ $json.id }}',
				options: { include: ['blueprint_course_status', 'enhanced_preview_url', 'usage_rights', 'user'] },
			},
		});
		expect(file).toMatchObject({ id: bulk.id, display_name: bulk.display_name, folder_id: Number(battery.bulkFilesId) });
		expect(file.user).toMatchObject({ id: Number(fx('adminUserId')) });
		expect(file).toHaveProperty('usage_rights');

		const [plain] = await runOk({ resource: 'file', operation: 'get', params: { fileId: String(bulk.id) } });
		expect(plain).not.toHaveProperty('user');
		expect(plain).not.toHaveProperty('usage_rights');
	});

	it('get: "replacement chain course ID" finds the file that replaced an overwritten one', async () => {
		const folder = await newFolder('chain');
		const path = `/api/v1/folders/${folder}/files`;
		const first = await uploadDirect(canvas(), path, 'chain.txt', Buffer.from('one'), 'text/plain');
		const second = await uploadDirect(canvas(), path, 'chain.txt', Buffer.from('two'), 'text/plain');
		expect(second.id).not.toBe(first.id);

		const gone = await runNode({
			resource: 'file',
			operation: 'get',
			params: { fileId: String(first.id), errorHandling: { onError: 'continueWithError' } },
		});
		expect(gone.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'file', operation: 'get' });

		const [replacement] = await runOk({
			resource: 'file',
			operation: 'get',
			params: { fileId: String(first.id), options: { replacement_chain_context_id: courseId } },
		});
		expect(replacement.id).toBe(second.id);
	});

	it('getAll: pages through more than 100 files of a folder without duplicates', async () => {
		const expected = await filesIn(battery.bulkFilesId);
		expect(expected).toHaveLength(BULK);
		const params = { contextType: 'folder', folderId: battery.bulkFilesId };

		const defaults = await runOk({ resource: 'file', operation: 'getAll', params });
		expect(defaults.map((f) => f.id)).toEqual(expected.slice(0, 50).map((f) => f.id));

		const all = await runOk({ resource: 'file', operation: 'getAll', params: { ...params, pagination: { returnAll: true } } });
		expect(all.map((f) => f.id)).toEqual(expected.map((f) => f.id));
		expect(new Set(all.map((f) => f.id)).size).toBe(BULK);

		const some = await runOk({ resource: 'file', operation: 'getAll', params: { ...params, pagination: { perPage: 25, maxPages: 3 } } });
		expect(some.map((f) => f.id)).toEqual(expected.slice(0, 75).map((f) => f.id));
	});

	it('getAll: content type filters, search, sort, order, includes and names only', async () => {
		const run = (options: Json): Promise<Json[]> =>
			runOk({
				resource: 'file',
				operation: 'getAll',
				params: { contextType: 'folder', folderId: battery.bulkFilesId, options, pagination: { returnAll: true } },
			});

		const images = await run({ content_types: 'image' });
		expect(images).toHaveLength(35);
		expect(images.every((f) => f['content-type'] === 'image/png')).toBe(true);

		const two = await run({ content_types: 'text/csv, image/png' });
		expect(two).toHaveLength(70);
		expect(new Set(two.map((f) => f['content-type']))).toEqual(new Set(['text/csv', 'image/png']));

		const noText = await run({ exclude_content_types: 'text' });
		expect(noText).toHaveLength(35);
		const noCsvNoPng = await run({ exclude_content_types: 'text/csv,image' });
		expect(new Set(noCsvNoPng.map((f) => f['content-type']))).toEqual(new Set(['text/plain']));

		const searched = await run({ search_term: 'bulk-10' });
		expect(names(searched)).toEqual(['bulk-100.txt', 'bulk-101.csv', 'bulk-102.png', 'bulk-103.txt', 'bulk-104.csv', 'bulk-105.png']);

		const bySize = await run({ sort: 'size', order: 'desc' });
		const sizes = bySize.map((f) => Number(f.size));
		expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
		const byNameDesc = await run({ sort: 'name', order: 'desc' });
		expect(byNameDesc[0].display_name).toBe('bulk-105.png');
		const byType = await run({ sort: 'content_type', order: 'asc' });
		expect(byType[0]['content-type']).toBe('image/png');
		const byCreated = await run({ sort: 'created_at', order: 'asc' });
		const created = byCreated.map((f) => Date.parse(String(f.created_at)));
		expect(created).toEqual([...created].sort((a, b) => a - b));
		expect(await run({ sort: 'updated_at', order: 'desc' })).toHaveLength(BULK);

		const withUser = await run({ include: ['usage_rights', 'user'], sort: 'user', search_term: 'bulk-001' });
		expect(withUser).toHaveLength(1);
		expect(withUser[0].user).toMatchObject({ id: Number(fx('adminUserId')) });
		expect(withUser[0]).toHaveProperty('usage_rights');

		const namesOnly = await run({ only_names: true, search_term: 'bulk-00' });
		expect(namesOnly).toHaveLength(9);
		expect(namesOnly[0]).toHaveProperty('display_name');
		expect(namesOnly[0]).not.toHaveProperty('url');
		expect(namesOnly[0]).not.toHaveProperty('size');
		const full = await run({ only_names: false, search_term: 'bulk-00' });
		expect(full[0]).toHaveProperty('size');

		expect(await run({ search_term: 'nothing is called like this zzz' })).toEqual([]);
	});

	it('getAll: course, group and user contexts', async () => {
		const course = await runOk({
			resource: 'file',
			operation: 'getAll',
			params: { contextType: 'course', courseId, options: { search_term: 'bulk-' }, pagination: { returnAll: true } },
		});
		expect(course).toHaveLength(BULK);

		const group = await runOk({
			resource: 'file',
			operation: 'getAll',
			params: { contextType: 'group', groupId: battery.groupId, pagination: { returnAll: true } },
		});
		expect(group.map((f) => f.id).sort()).toEqual(
			(await canvas().getAll<Json>(`/api/v1/groups/${battery.groupId}/files`)).map((f) => f.id).sort(),
		);
		expect(group.length).toBeGreaterThanOrEqual(1);

		// The personal files of a user: as that user ("self") and, for an admin, by user ID.
		// (Other test files add to these files at the same time, so look for a file of our own.)
		const mine = await uploadDirect(
			new CanvasClient('student2'),
			'/api/v1/users/self/files',
			`${unique('mine').replace(/\s/g, '-')}.txt`,
			Buffer.from('mine'),
			'text/plain',
		);
		strays.push(String(mine.id));
		const own = await runOk({
			resource: 'file',
			operation: 'getAll',
			persona: 'student2',
			params: { contextType: 'user', userId: 'self', options: { search_term: String(mine.display_name) } },
		});
		expect(own.map((f) => f.id)).toEqual([mine.id]);
		const byId = await runOk({
			resource: 'file',
			operation: 'getAll',
			params: { contextType: 'user', userId: fx('student2UserId'), pagination: { returnAll: true } },
		});
		expect(byId.map((f) => f.id)).toContain(mine.id);
		const otherUser = await runOk({
			resource: 'file',
			operation: 'getAll',
			persona: 'student',
			params: { contextType: 'user', userId: 'self', pagination: { returnAll: true } },
		});
		expect(otherUser.map((f) => f.id)).not.toContain(mine.id);
	});

	// ------------------------------------------------------------------ update

	it('update: every field reaches Canvas', async () => {
		const folder = await newFolder('update');
		const file = await uploadDirect(canvas(), `/api/v1/folders/${folder}/files`, 'before.txt', Buffer.from('update me'), 'text/plain');
		const [updated] = await runOk({
			resource: 'file',
			operation: 'update',
			params: {
				fileId: String(file.id),
				updateFields: {
					hidden: true,
					lock_at: '2032-03-01T12:00:00Z',
					locked: false,
					name: 'Nachher ünï "quoted" & more.txt',
					parent_folder_id: otherFolderId,
					unlock_at: '2032-01-15T12:00:00Z',
					visibility_level: 'institution',
				},
			},
		});
		expect(updated.id).toBe(file.id);
		expect(await fileFromCanvas(file.id)).toMatchObject({
			display_name: 'Nachher ünï "quoted" & more.txt',
			folder_id: Number(otherFolderId),
			hidden: true,
			locked: false,
			lock_at: '2032-03-01T12:00:00Z',
			unlock_at: '2032-01-15T12:00:00Z',
			visibility_level: 'institution',
		});

		await runOk({
			resource: 'file',
			operation: 'update',
			params: { fileId: String(file.id), updateFields: { hidden: false, lock_at: '', locked: true, unlock_at: '', visibility_level: 'inherit' } },
		});
		expect(await fileFromCanvas(file.id)).toMatchObject({ hidden: false, locked: true, lock_at: null, unlock_at: null, visibility_level: 'inherit' });
	});

	it('update: a name collision is refused unless "on duplicate" says what to do', async () => {
		const folder = await newFolder('collide');
		const path = `/api/v1/folders/${folder}/files`;
		const keep = await uploadDirect(canvas(), path, 'taken.txt', Buffer.from('keep'), 'text/plain');
		const mover = await uploadDirect(canvas(), path, 'mover.txt', Buffer.from('mover'), 'text/plain');
		const second = await uploadDirect(canvas(), path, 'second.txt', Buffer.from('second'), 'text/plain');

		const refused = await runNode({
			resource: 'file',
			operation: 'update',
			params: { fileId: String(mover.id), updateFields: { name: 'taken.txt' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.error[0]).toMatchObject({ errorCode: 409, errorType: 'CONFLICT' });
		expect(String(refused.error[0].errorMessage)).toContain('file already exists');

		const [renamed] = await runOk({
			resource: 'file',
			operation: 'update',
			params: { fileId: String(mover.id), updateFields: { name: 'taken.txt', on_duplicate: 'rename' } },
		});
		expect(renamed.display_name).toBe('taken-1.txt');

		await runOk({
			resource: 'file',
			operation: 'update',
			params: { fileId: String(second.id), updateFields: { name: 'taken.txt', on_duplicate: 'overwrite' } },
		});
		expect(names(await filesIn(folder))).toEqual(['taken-1.txt', 'taken.txt']);
		expect((await canvas().request('GET', `/api/v1/files/${String(keep.id)}`)).status).toBe(404);
		expect((await fileFromCanvas(second.id)).display_name).toBe('taken.txt');
	});

	// -------------------------------------------------------------------- copy

	it('copy: into another folder, into a group, and with every duplicate strategy', async () => {
		const source = await uploadDirect(canvas(), `/api/v1/folders/${workFolderId}/files`, 'to-copy.txt', Buffer.from('copy me'), 'text/plain');
		const target = await newFolder('copies');

		const [copy] = await runOk({
			resource: 'file',
			operation: 'copy',
			items: [{ file: source.id, folder: Number(target) }],
			params: { fileId: '={{ $json.file }}', destinationFolderId: '={{ $json.folder }}' },
		});
		expect(copy.id).not.toBe(source.id);
		expect(copy).toMatchObject({ display_name: 'to-copy.txt', folder_id: Number(target) });
		expect((await downloadFile(copy)).toString()).toBe('copy me');
		expect((await fileFromCanvas(source.id)).folder_id).toBe(Number(workFolderId));

		const again = await runNode({
			resource: 'file',
			operation: 'copy',
			params: { fileId: String(source.id), destinationFolderId: target, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.error[0]).toMatchObject({ errorCode: 409, errorType: 'CONFLICT', operation: 'copy' });

		const [renamed] = await runOk({
			resource: 'file',
			operation: 'copy',
			params: { fileId: String(source.id), destinationFolderId: target, options: { on_duplicate: 'rename' } },
		});
		expect(renamed.display_name).toBe('to-copy-1.txt');
		const [overwritten] = await runOk({
			resource: 'file',
			operation: 'copy',
			params: { fileId: String(source.id), destinationFolderId: target, options: { on_duplicate: 'overwrite' } },
		});
		expect(overwritten.display_name).toBe('to-copy.txt');
		expect(names(await filesIn(target))).toEqual(['to-copy-1.txt', 'to-copy.txt']);

		const groupRoot = await canvas().get<Json>(`/api/v1/groups/${battery.groupId}/folders/root`);
		const [intoGroup] = await runOk({
			resource: 'file',
			operation: 'copy',
			params: { fileId: String(source.id), destinationFolderId: String(groupRoot.id), options: { on_duplicate: 'rename' } },
		});
		strays.push(String(intoGroup.id));
		expect(intoGroup.folder_id).toBe(groupRoot.id);
	});

	// ------------------------------------------------- public URL, quota, licenses

	it('getPublicUrl: returns a URL that downloads the file without a token', async () => {
		const content = Buffer.from('public content');
		const file = await uploadDirect(canvas(), `/api/v1/folders/${workFolderId}/files`, 'public.txt', content, 'text/plain');
		const [result] = await runOk({ resource: 'file', operation: 'getPublicUrl', params: { fileId: String(file.id) } });
		expect(Object.keys(result)).toEqual(['public_url']);
		const downloaded = await fetch(String(result.public_url));
		expect(downloaded.status).toBe(200);
		expect(Buffer.from(await downloaded.arrayBuffer()).equals(content)).toBe(true);
	});

	it('getPublicUrl: "submission ID" lets a grader reach a file a student handed in', async () => {
		const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: { name: unique('Upload assignment'), submission_types: ['online_upload'], published: true },
		});
		const student = fx('student2UserId');
		const handedIn = await uploadDirect(
			canvas(),
			`/api/v1/courses/${courseId}/assignments/${String(assignment.id)}/submissions/${student}/files`,
			'homework.txt',
			Buffer.from('my homework'),
			'text/plain',
		);
		const submission = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments/${String(assignment.id)}/submissions`, {
			submission: { submission_type: 'online_upload', file_ids: [handedIn.id], user_id: student },
		});
		const attachment = (submission.attachments as Json[])[0];

		const [result] = await runOk({
			resource: 'file',
			operation: 'getPublicUrl',
			params: { fileId: String(attachment.id), options: { submission_id: String(submission.id) } },
		});
		expect((await (await fetch(String(result.public_url))).text())).toBe('my homework');

		// A file that is not part of the submission is refused.
		const other = await canvas().get<Json[]>(`/api/v1/folders/${battery.bulkFilesId}/files?per_page=1`);
		const wrong = await runNode({
			resource: 'file',
			operation: 'getPublicUrl',
			params: {
				fileId: String(other[0].id),
				options: { submission_id: String(submission.id) },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(wrong.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		await canvas().request('DELETE', `/api/v1/courses/${courseId}/assignments/${String(assignment.id)}`);
	});

	it('getQuota: course, group and user', async () => {
		const [course] = await runOk({ resource: 'file', operation: 'getQuota', params: { contextType: 'course', courseId } });
		expect(course).toEqual(await canvas().get<Json>(`/api/v1/courses/${courseId}/files/quota`));
		expect(Number(course.quota)).toBeGreaterThan(0);
		expect(Number(course.quota_used)).toBeGreaterThan(0);

		const [group] = await runOk({ resource: 'file', operation: 'getQuota', params: { contextType: 'group', groupId: battery.groupId } });
		expect(Object.keys(group).sort()).toEqual(['quota', 'quota_used']);

		const [own] = await runOk({ resource: 'file', operation: 'getQuota', persona: 'student2', params: { contextType: 'user', userId: 'self' } });
		expect(own).toEqual(await new CanvasClient('student2').get<Json>('/api/v1/users/self/files/quota'));
		const [byId] = await runOk({ resource: 'file', operation: 'getQuota', params: { contextType: 'user', userId: fx('student2UserId') } });
		expect(byId.quota).toBe(own.quota);
	});

	it('listLicenses: course, group and user', async () => {
		const expected = await canvas().get<Json[]>(`/api/v1/courses/${courseId}/content_licenses`);
		const course = await runOk({ resource: 'file', operation: 'listLicenses', params: { contextType: 'course', courseId } });
		expect(course.map((l) => l.id)).toEqual(expected.map((l) => l.id));
		expect(course.map((l) => l.id)).toContain('cc_by_sa');
		expect(course[0]).toHaveProperty('name');
		expect(course[0]).toHaveProperty('url');

		const group = await runOk({ resource: 'file', operation: 'listLicenses', params: { contextType: 'group', groupId: battery.groupId } });
		expect(group).toHaveLength(expected.length);
		const user = await runOk({ resource: 'file', operation: 'listLicenses', persona: 'student', params: { contextType: 'user', userId: 'self' } });
		expect(user).toHaveLength(expected.length);
	});

	// ------------------------------------------------------------ usage rights

	it('setUsageRights / removeUsageRights: by file and by folder, with every option', async () => {
		const folder = await newFolder('rights');
		const path = `/api/v1/folders/${folder}/files`;
		const a = await uploadDirect(canvas(), path, 'rights-a.txt', Buffer.from('a'), 'text/plain');
		const b = await uploadDirect(canvas(), path, 'rights-b.txt', Buffer.from('b'), 'text/plain');
		await canvas().put(`/api/v1/files/${String(a.id)}`, { locked: true });
		const rightsOf = async (id: unknown): Promise<unknown> => (await fileFromCanvas(id, '?include[]=usage_rights')).usage_rights;

		const [set] = await runOk({
			resource: 'file',
			operation: 'setUsageRights',
			params: {
				contextType: 'course',
				courseId,
				fileIds: ` ${String(a.id)} `,
				useJustification: 'creative_commons',
				options: { legal_copyright: '(C) 2030 Battery ünï', license: 'cc_by_sa', publish: true },
			},
		});
		expect(set).toMatchObject({ use_justification: 'creative_commons', license: 'cc_by_sa', legal_copyright: '(C) 2030 Battery ünï' });
		expect(set.file_ids).toEqual([a.id]);
		expect(await rightsOf(a.id)).toMatchObject({ use_justification: 'creative_commons', license: 'cc_by_sa', legal_copyright: '(C) 2030 Battery ünï' });
		// "Publish" unlocked the file.
		expect((await fileFromCanvas(a.id)).locked).toBe(false);
		expect(await rightsOf(b.id)).toBeNull();

		// A whole folder, with the default license for the justification.
		const [forFolder] = await runOk({
			resource: 'file',
			operation: 'setUsageRights',
			params: { contextType: 'course', courseId, folderIds: folder, useJustification: 'own_copyright' },
		});
		expect((forFolder.file_ids as number[]).sort()).toEqual([a.id, b.id].sort());
		expect(await rightsOf(b.id)).toMatchObject({ use_justification: 'own_copyright' });

		for (const justification of ['fair_use', 'public_domain', 'used_by_permission']) {
			await runOk({
				resource: 'file',
				operation: 'setUsageRights',
				params: { contextType: 'course', courseId, fileIds: String(b.id), useJustification: justification },
			});
			expect(await rightsOf(b.id)).toMatchObject({ use_justification: justification });
		}

		const [removed] = await runOk({
			resource: 'file',
			operation: 'removeUsageRights',
			params: { contextType: 'course', courseId, fileIds: `${String(a.id)},${String(b.id)}` },
		});
		expect((removed.file_ids as number[]).sort()).toEqual([a.id, b.id].sort());
		expect(await rightsOf(a.id)).toBeNull();
		expect(await rightsOf(b.id)).toBeNull();

		await runOk({ resource: 'file', operation: 'setUsageRights', params: { contextType: 'course', courseId, fileIds: String(a.id), useJustification: 'fair_use' } });
		await runOk({ resource: 'file', operation: 'removeUsageRights', params: { contextType: 'course', courseId, folderIds: folder } });
		expect(await rightsOf(a.id)).toBeNull();
	});

	it('setUsageRights: group and user contexts; missing targets and invalid licenses are refused', async () => {
		const groupFile = await uploadDirect(canvas(), `/api/v1/groups/${battery.groupId}/files`, `${unique('g').replace(/\s/g, '-')}.txt`, Buffer.from('g'), 'text/plain');
		strays.push(String(groupFile.id));
		const [group] = await runOk({
			resource: 'file',
			operation: 'setUsageRights',
			params: { contextType: 'group', groupId: battery.groupId, fileIds: String(groupFile.id), useJustification: 'public_domain' },
		});
		expect(group.use_justification).toBe('public_domain');
		await runOk({ resource: 'file', operation: 'removeUsageRights', params: { contextType: 'group', groupId: battery.groupId, fileIds: String(groupFile.id) } });
		expect((await fileFromCanvas(groupFile.id, '?include[]=usage_rights')).usage_rights).toBeNull();

		const userFile = await uploadDirect(new CanvasClient('student2'), '/api/v1/users/self/files', `${unique('u').replace(/\s/g, '-')}.txt`, Buffer.from('u'), 'text/plain');
		strays.push(String(userFile.id));
		const [user] = await runOk({
			resource: 'file',
			operation: 'setUsageRights',
			persona: 'student2',
			params: { contextType: 'user', userId: 'self', fileIds: String(userFile.id), useJustification: 'own_copyright' },
		});
		expect(user.use_justification).toBe('own_copyright');
		await runOk({
			resource: 'file',
			operation: 'removeUsageRights',
			persona: 'student2',
			params: { contextType: 'user', userId: 'self', fileIds: String(userFile.id) },
		});

		const nothing = await runNode({
			resource: 'file',
			operation: 'setUsageRights',
			params: { contextType: 'course', courseId, useJustification: 'fair_use', errorHandling: { onError: 'continueWithError' } },
		});
		expect(nothing.error[0].errorCode).toBe(0);
		expect(String(nothing.error[0].errorMessage)).toContain('At least one file ID or folder ID is required');

		const badLicense = await runNode({
			resource: 'file',
			operation: 'setUsageRights',
			params: {
				contextType: 'course',
				courseId,
				fileIds: String(groupFile.id),
				useJustification: 'creative_commons',
				options: { license: 'not_a_license' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(badLicense.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
	});

	// ------------------------------------------------------------------ delete

	it('delete: removes files, reporting the ones that do not exist', async () => {
		const folder = await newFolder('delete');
		const path = `/api/v1/folders/${folder}/files`;
		const a = await uploadDirect(canvas(), path, 'delete-a.txt', Buffer.from('a'), 'text/plain');
		const b = await uploadDirect(canvas(), path, 'delete-b.txt', Buffer.from('b'), 'text/plain');
		const result = await runNode({
			resource: 'file',
			operation: 'delete',
			items: [{ id: a.id }, { id: 999999999 }, { id: String(b.id) }],
			params: { fileId: '={{ $json.id }}', options: { replace: false }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((f) => f.id)).toEqual([a.id, b.id]);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'file', operation: 'delete' });
		expect(await filesIn(folder)).toEqual([]);
	});

	it('delete: "replace" also destroys the stored content', async () => {
		const file = await uploadDirect(canvas(), `/api/v1/folders/${workFolderId}/files`, 'privacy.txt', Buffer.from('private data'), 'text/plain');
		const [removed] = await runOk({ resource: 'file', operation: 'delete', params: { fileId: String(file.id), options: { replace: true } } });
		expect(removed.id).toBe(file.id);
		const after = await canvas().request('GET', `/api/v1/files/${String(file.id)}`);
		// The record stays, but as a placeholder without the original content.
		if (after.status === 200) {
			const data = after.data as Json;
			expect(data.display_name).not.toBe('privacy.txt');
			expect(data.size).not.toBe(12);
		} else {
			expect(after.status).toBe(404);
		}

		const student = await runNode({
			resource: 'file',
			operation: 'delete',
			persona: 'student',
			params: {
				fileId: String((await canvas().get<Json[]>(`/api/v1/folders/${battery.bulkFilesId}/files?per_page=1`))[0].id),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(student.success).toEqual([]);
		expect([401, 403]).toContain(student.error[0].errorCode);
		expect(await filesIn(battery.bulkFilesId)).toHaveLength(BULK);
	});
});
