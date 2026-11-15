import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import { createCredential, n8n, runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { asUser, createUserWithToken, deleteUser, WebSession } from './own-users.helper';
import type { OwnUser } from './own-users.helper';
import { waitFor } from './pacing.fixture';
import { createSandboxAccount, deleteSandboxAccount } from './support/gradingSandbox';

/**
 * Resource: webZipExport (offline course exports).
 *
 * "Offline Course Export" is an account setting that only the account settings
 * page of the web interface can change, so the file switches it on for a
 * sub-account of its own through the Rails console. Exports can only be started
 * from the web interface as well: a user of the file's own does that with a
 * browser session. The local Canvas has no compiled front-end assets to put into
 * the zip, so its exports end as "failed"; they are listed and returned all the same.
 *
 * Not covered: a course without "Offline Course Export". A real Canvas answers
 * 404 with an HTML page there; this asset-less local Canvas cannot render that
 * page and answers 500, which says nothing about the node.
 */
describe('webZipExport', () => {
	let accountId = '';
	let courseId = '';
	let user: OwnUser;
	let credential: { id: string; name: string; type: string };
	let exports: Json[] = [];

	beforeAll(async () => {
		accountId = await createSandboxAccount('web-zip-exports');
		const out = execFileSync(
			'docker',
			[
				'exec',
				'canvas-web',
				'bundle',
				'exec',
				'rails',
				'runner',
				`a = Account.find(${Number(accountId)}); a.settings[:enable_offline_web_export] = { value: true }; a.save!; puts "ENABLED=" + a.reload.enable_offline_web_export?.to_s`,
			],
			{ encoding: 'utf8' },
		);
		expect(out).toContain('ENABLED=true');

		const course = await canvas().post<Json>(`/api/v1/accounts/${accountId}/courses`, {
			course: { name: unique('Web zip battery course') },
			offer: true,
		});
		courseId = String(course.id);
		const page = await canvas().post<Json>(`/api/v1/courses/${courseId}/pages`, {
			wiki_page: { title: 'Offline page', body: '<p>Hello offline</p>', published: true },
		});
		const module = await canvas().post<Json>(`/api/v1/courses/${courseId}/modules`, { module: { name: 'Unit 1' } });
		await canvas().post(`/api/v1/courses/${courseId}/modules/${String(module.id)}/items`, {
			module_item: { type: 'Page', page_url: page.url },
		});
		await canvas().put(`/api/v1/courses/${courseId}/modules/${String(module.id)}`, { module: { published: true } });

		user = await createUserWithToken('Web Zip Student');
		credential = await createCredential(String(user.token), 'web zip exports');
		await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: { user_id: user.id, type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
		});

		// The student starts two exports, one after the other, in the web interface.
		const session = new WebSession();
		await session.login(user.login, user.password);
		for (let count = 1; count <= 2; count++) {
			const started = await session.request('POST', `/courses/${courseId}/start_offline_web_export`, {});
			expect(started.status).toBe(302);
			exports = await waitFor(
				() => asUser<Json[]>(user, 'GET', `/api/v1/courses/${courseId}/web_zip_exports`),
				(list) => list.length === count && list.every((e) => ['generated', 'failed'].includes(String(e.workflow_state))),
			);
		}
	});

	afterAll(async () => {
		if (courseId) await canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`);
		await deleteUser(user);
		if (credential) await n8n().api('DELETE', `/credentials/${credential.id}`).catch(() => undefined);
		await deleteSandboxAccount(accountId);
	});

	it('getAll: lists the exports the user started, newest first, paged', async () => {
		expect(exports).toHaveLength(2);
		const listed = await runOk({ resource: 'webZipExport', operation: 'getAll', credential, params: { courseId } });
		expect(listed).toEqual(exports);
		expect(Number(listed[0].id)).toBeGreaterThan(Number(listed[1].id));
		for (const entry of listed) {
			expect(entry).toMatchObject({ course_id: Number(courseId), user_id: Number(user.id) });
			expect(entry.progress_id).toBeTypeOf('number');
			expect(String(entry.progress_url)).toContain(`/api/v1/progress/${String(entry.progress_id)}`);
			expect(['generated', 'failed']).toContain(entry.workflow_state);
		}

		const newest = await runOk({
			resource: 'webZipExport',
			operation: 'getAll',
			credential,
			params: { courseId, pagination: { perPage: 1, maxPages: 1 } },
		});
		expect(newest).toEqual([exports[0]]);

		const all = await runOk({
			resource: 'webZipExport',
			operation: 'getAll',
			credential,
			params: { courseId, pagination: { perPage: 1, returnAll: true } },
		});
		expect(all.map((e) => e.id)).toEqual(exports.map((e) => e.id));
	});

	it('getAll: exports are private — an admin sees none of the student\'s exports', async () => {
		const result = await runNode({ resource: 'webZipExport', operation: 'getAll', params: { courseId } });
		expect(result.ok).toBe(true);
		expect(result.success).toEqual([]);
		expect(result.error).toEqual([]);
	});

	it('get: returns one export; several IDs in one run, an unknown one goes to the Error output (Canvas answers 500)', async () => {
		const [single] = await runOk({
			resource: 'webZipExport',
			operation: 'get',
			credential,
			params: { courseId, webZipExportId: String(exports[1].id) },
		});
		expect(single).toEqual(exports[1]);

		const result = await runNode({
			resource: 'webZipExport',
			operation: 'get',
			credential,
			items: [{ id: exports[0].id }, { id: 99999999 }, { id: exports[1].id }],
			params: { courseId, webZipExportId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([exports[0], exports[1]]);
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual([0, 2]);
		expect(result.error).toHaveLength(1);
		// Canvas does not check that the export exists before it checks the permission: it answers 500, not 404.
		expect(result.error[0]).toMatchObject({
			errorCode: 500,
			errorType: 'SERVER_ERROR',
			resource: 'webZipExport',
			operation: 'get',
			originalItem: { id: 99999999 },
		});
	});

	it('errors: someone who is not in the course may not list its offline exports', async () => {
		const refused = await runNode({
			resource: 'webZipExport',
			operation: 'getAll',
			persona: 'student2',
			params: { courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'webZipExport', operation: 'getAll' });
		expect([401, 403]).toContain(refused.error[0].errorCode);

		const other = await runNode({
			resource: 'webZipExport',
			operation: 'get',
			persona: 'student2',
			params: { courseId, webZipExportId: String(exports[0].id), errorHandling: { onError: 'continueWithError' } },
		});
		expect(other.success).toEqual([]);
		expect(other.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'get' });
	});

	it('errors: a missing course is "not found"', async () => {
		const missing = await runNode({
			resource: 'webZipExport',
			operation: 'getAll',
			params: { courseId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getAll' });
	});

});
