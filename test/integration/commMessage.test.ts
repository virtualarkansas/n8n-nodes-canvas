import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import type { Sandbox, SandboxUser } from './support/commsSandbox';
import { clientFor, commsSandbox, waitFor } from './support/commsSandbox';

/**
 * Resource: commMessage (the notifications Canvas has sent to a user).
 *
 * Canvas creates these in background jobs, and other tests keep producing new
 * ones, so every comparison is pinned to a point in time with "End Time".
 */
describe('commMessage', () => {
	let sbx: Sandbox;
	let reader: SandboxUser;
	/** Nothing created after this instant is part of a comparison. */
	let cutoff = '';
	// More than one Canvas page (100), so that paging is really exercised.
	const MIN_MESSAGES = 105;

	const listPath = (userId: string, query = ''): string =>
		`/api/v1/comm_messages?user_id=${userId}${query ? `&${query}` : ''}`;

	beforeAll(async () => {
		sbx = await commsSandbox();
		// Student 2 receives a notification for every inbox message the sandbox teacher sends.
		reader = sbx.students[1];
		const have = (await canvas().getAll<Json>(listPath(reader.id))).length;
		if (have < MIN_MESSAGES) {
			const teacher = clientFor(sbx.teacher);
			const [conversation] = await teacher.post<Json[]>('/api/v1/conversations', {
				recipients: [reader.id],
				body: 'Notification 0',
				subject: unique('Notifications for the battery'),
				group_conversation: true,
			});
			for (let i = 1; i < MIN_MESSAGES - have; i++) {
				await teacher.post(`/api/v1/conversations/${String(conversation.id)}/add_message`, { body: `Notification ${i}` });
			}
			await waitFor(
				async () => (await canvas().getAll<Json>(listPath(reader.id))).length >= MIN_MESSAGES,
				300_000,
				'Canvas to deliver the notifications',
			);
		}
		const [newest] = await canvas().get<Json[]>(listPath(reader.id, 'per_page=1'));
		cutoff = new Date(new Date(String(newest.created_at)).getTime() + 1000).toISOString().replace(/\.\d+Z$/, 'Z');
		// Let the clock pass the cut-off so nothing new can fall on or before it.
		await waitFor(async () => Date.now() > new Date(cutoff).getTime() + 1500, 30_000, 'the cut-off to pass');
	}, 900_000);

	it('getAll: Return All follows the pages, the default stops at 50, Limit at any number', async () => {
		const expected = await canvas().getAll<Json>(listPath(reader.id, `end_time=${cutoff}`));
		expect(expected.length).toBeGreaterThanOrEqual(MIN_MESSAGES);

		const all = await runOk({
			resource: 'commMessage',
			operation: 'getAll',
			params: { userId: reader.id, returnAll: true, options: { end_time: cutoff } },
		});
		expect(all.map((m) => m.id)).toEqual(expected.map((m) => m.id));
		expect(new Set(all.map((m) => m.id)).size).toBe(all.length);
		expect(all[0]).toMatchObject({ to: reader.login, workflow_state: expect.any(String) });
		for (const key of ['id', 'created_at', 'subject', 'body', 'from', 'to']) expect(all[0]).toHaveProperty(key);

		const byDefault = await runOk({
			resource: 'commMessage',
			operation: 'getAll',
			params: { userId: reader.id, options: { end_time: cutoff } },
		});
		expect(byDefault.map((m) => m.id)).toEqual(expected.slice(0, 50).map((m) => m.id));

		const seven = await runOk({
			resource: 'commMessage',
			operation: 'getAll',
			params: { userId: reader.id, returnAll: false, limit: 7, options: { end_time: cutoff } },
		});
		expect(seven.map((m) => m.id)).toEqual(expected.slice(0, 7).map((m) => m.id));

		// A limit above Canvas' page size spans two requests and stops in the middle of the second page.
		const beyondAPage = await runOk({
			resource: 'commMessage',
			operation: 'getAll',
			params: { userId: reader.id, returnAll: false, limit: 103, options: { end_time: cutoff } },
		});
		expect(beyondAPage.map((m) => m.id)).toEqual(expected.slice(0, 103).map((m) => m.id));
	});

	it('getAll: without a time range the newest messages come first', async () => {
		const listed = await runOk({ resource: 'commMessage', operation: 'getAll', params: { userId: reader.id, limit: 10 } });
		expect(listed).toHaveLength(10);
		const times = listed.map((m) => new Date(String(m.created_at)).getTime());
		expect(times).toEqual([...times].sort((a, b) => b - a));
		// Messages are never removed, so everything listed must still be there.
		const now = (await canvas().getAll<Json>(listPath(reader.id))).map((m) => m.id);
		for (const message of listed) expect(now).toContain(message.id);
	});

	it('getAll: Start Time and End Time bound the result', async () => {
		const everything = await canvas().getAll<Json>(listPath(reader.id, `end_time=${cutoff}`));
		// A window from the 20th-newest message up to the 5th-newest.
		const start = String(everything[19].created_at);
		const end = String(everything[4].created_at);
		const expected = await canvas().getAll<Json>(listPath(reader.id, `start_time=${start}&end_time=${end}`));
		expect(expected.length).toBeGreaterThan(0);
		expect(expected.length).toBeLessThan(everything.length);

		const windowed = await runOk({
			resource: 'commMessage',
			operation: 'getAll',
			params: { userId: reader.id, returnAll: true, options: { start_time: start, end_time: end } },
		});
		expect(windowed.map((m) => m.id)).toEqual(expected.map((m) => m.id));
		for (const message of windowed) {
			const at = new Date(String(message.created_at)).getTime();
			expect(at).toBeGreaterThanOrEqual(new Date(start).getTime());
			expect(at).toBeLessThanOrEqual(new Date(end).getTime() + 999);
		}

		const onlyStart = await runOk({
			resource: 'commMessage',
			operation: 'getAll',
			params: { userId: reader.id, returnAll: true, options: { start_time: start, end_time: cutoff } },
		});
		expect(onlyStart.map((m) => m.id)).toEqual(
			(await canvas().getAll<Json>(listPath(reader.id, `start_time=${start}&end_time=${cutoff}`))).map((m) => m.id),
		);

		const future = await runOk({
			resource: 'commMessage',
			operation: 'getAll',
			params: { userId: reader.id, returnAll: true, options: { start_time: '2040-01-01T00:00:00Z' } },
		});
		expect(future).toEqual([]);
	});

	it('getAll: several users in one execution, by numeric ID and by SIS ID', async () => {
		const past = new Date(Date.now() - 120_000).toISOString().replace(/\.\d+Z$/, 'Z');
		const sisUser = fx('studentUserId');
		const expectedSis = await canvas().getAll<Json>(listPath(sisUser, `end_time=${past}`));
		const expectedReader = await canvas().getAll<Json>(listPath(reader.id, `end_time=${past}`));

		const result = await runNode({
			resource: 'commMessage',
			operation: 'getAll',
			items: [{ user: `sis_user_id:${fx('studentSisUserId')}` }, { user: Number(reader.id) }],
			params: { userId: '={{ $json.user }}', returnAll: true, options: { end_time: past } },
		});
		expect(result.error).toEqual([]);
		const fromFirst = result.rawSuccess.filter((i) => (i.pairedItem as Json).item === 0).map((i) => i.json.id);
		const fromSecond = result.rawSuccess.filter((i) => (i.pairedItem as Json).item === 1).map((i) => i.json.id);
		expect(fromFirst).toEqual(expectedSis.map((m) => m.id));
		expect(fromSecond).toEqual(expectedReader.map((m) => m.id));
	});

	it('getAll: a user without any notifications yields no items', async () => {
		// The seeded account admin has never been sent anything.
		const expected = await canvas().getAll<Json>(listPath(fx('adminUserId')));
		const listed = await runOk({ resource: 'commMessage', operation: 'getAll', params: { userId: fx('adminUserId'), returnAll: true } });
		expect(listed.map((m) => m.id)).toEqual(expected.map((m) => m.id));
	});

	it('errors: only admins may read notification messages', async () => {
		const result = await runNode({
			resource: 'commMessage',
			operation: 'getAll',
			persona: 'sbxTeacher',
			params: { userId: reader.id, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'commMessage', operation: 'getAll' });
		expect([401, 403]).toContain(result.error[0].errorCode);

		const own = await runNode({
			resource: 'commMessage',
			operation: 'getAll',
			persona: 'sbxStudent2',
			params: { userId: 'self', errorHandling: { onError: 'continueWithError' } },
		});
		expect(own.success).toEqual([]);
		expect(own.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
	});

	it('errors: an unknown user is not found', async () => {
		const result = await runNode({
			resource: 'commMessage',
			operation: 'getAll',
			params: { userId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', endpoint: '/api/v1/comm_messages' });
	});
});
