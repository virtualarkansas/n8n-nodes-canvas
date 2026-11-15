import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CanvasClient } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { RunNodeOptions, RunNodeResult } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createDedicatedUser, removeDedicatedUser } from './misc-support/dedicated';
import type { DedicatedUser } from './misc-support/dedicated';
import { createCourse, deleteCourses } from './misc-support/world';
import type { OwnCourse } from './misc-support/world';

vi.mock('../lib/state', async (original) =>
	(await import('./misc-support/state-overlay')).overlayState(await original()),
);

/**
 * Resource: poll. Polls belong to the teacher who creates them, so the battery
 * uses a teacher of its own (the shared teacher persona's poll list stays empty).
 * Poll choices, sessions and submissions are separate Canvas resources that the
 * `poll` resource does not offer; a session is created directly here only to show
 * what a student may see.
 */
describe('poll', () => {
	let course: OwnCourse;
	let owner: DedicatedUser; // teacher
	let colleague: DedicatedUser; // teacher of another course
	let learner: DedicatedUser; // student in the owner's course
	let otherCourse: OwnCourse;
	let asOwner: CanvasClient;
	let pollId = '';

	const question = 'Which topic first? — Ünïcødé 投票 "quoted" & <b>tags</b> 🗳️';
	const description = 'Choose one. مرحبا / שלום';

	const run = (opts: RunNodeOptions): Promise<RunNodeResult> => runNode({ persona: owner.persona, ...opts });
	const ok = (opts: RunNodeOptions): Promise<Json[]> => runOk({ persona: owner.persona, ...opts });
	const direct = async (id: string): Promise<Json> =>
		((await asOwner.get<Json>(`/api/v1/polls/${id}`)).polls as Json[])[0];
	const allPolls = (): Promise<Json[]> => asOwner.getAll<Json>('/api/v1/polls', 'polls');
	/**
	 * POST/PUT answers keep Canvas' wrapper, { polls: [poll], meta: {} }: the node unwraps
	 * `dataKey` for GET responses only (a change for Canvas.node.ts, see the battery report).
	 */
	const unwrap = (item: Json): Json => {
		expect(Object.keys(item).sort()).toEqual(['meta', 'polls']);
		expect(item.polls).toHaveLength(1);
		return (item.polls as Json[])[0];
	};

	beforeAll(async () => {
		[course, otherCourse] = await Promise.all([createCourse('Poll Course'), createCourse('Poll Other Course')]);
		[owner, colleague, learner] = await Promise.all([
			createDedicatedUser('poll-teacher', [{ courseId: course.id, type: 'TeacherEnrollment' }]),
			createDedicatedUser('poll-colleague', [{ courseId: otherCourse.id, type: 'TeacherEnrollment' }]),
			createDedicatedUser('poll-student', [{ courseId: course.id, type: 'StudentEnrollment' }]),
		]);
		asOwner = new CanvasClient(owner.persona);
	});

	afterAll(async () => {
		for (const poll of await allPolls().catch(() => [] as Json[])) {
			await asOwner.request('DELETE', `/api/v1/polls/${String(poll.id)}`).catch(() => undefined);
		}
		await Promise.all([removeDedicatedUser(owner), removeDedicatedUser(colleague), removeDedicatedUser(learner)]);
		await deleteCourses([course, otherCourse]);
	});

	it('getAll: a teacher without polls gets no items', async () => {
		const result = await run({ resource: 'poll', operation: 'getAll' });
		expect(result.ok).toBe(true);
		expect(result.success).toEqual([]);
		expect(result.error).toEqual([]);
	});

	it('create: question and description reach Canvas', async () => {
		const [created] = await ok({
			resource: 'poll',
			operation: 'create',
			params: { question, additionalFields: { description } },
		});
		const poll = unwrap(created);
		pollId = String(poll.id);
		// The polls API serialises IDs as strings.
		expect(poll).toMatchObject({ question, description, user_id: owner.id, total_results: {} });
		expect(poll.id).toBeTypeOf('string');

		expect(await direct(pollId)).toMatchObject({ id: pollId, question, description, user_id: owner.id });
	});

	it('create: without a description', async () => {
		const [created] = await ok({ resource: 'poll', operation: 'create', params: { question: 'No description' } });
		const poll = unwrap(created);
		expect(await direct(String(poll.id))).toMatchObject({ question: 'No description', description: null });
	});

	it('create: Canvas limits question and description to 255 characters and requires a question', async () => {
		const result = await run({
			resource: 'poll',
			operation: 'create',
			items: [
				{ q: 'x'.repeat(255), d: 'd'.repeat(255) },
				{ q: 'x'.repeat(256), d: 'fine' },
				{ q: 'fine', d: 'd'.repeat(256) },
				{ q: '', d: 'no question' },
			],
			params: {
				question: '={{ $json.q }}',
				additionalFields: { description: '={{ $json.d }}' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toHaveLength(1);
		expect(unwrap(result.success[0])).toMatchObject({ question: 'x'.repeat(255), description: 'd'.repeat(255) });
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }]);
		expect(result.error).toHaveLength(3);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'poll', operation: 'create' });
		}
		expect(String(result.error[0].errorMessage)).toMatch(/question/);
		expect(String(result.error[1].errorMessage)).toMatch(/description/);
		expect(String(result.error[2].errorMessage)).toMatch(/question/);
	});

	it('create: only teachers may create polls', async () => {
		const result = await runNode({
			resource: 'poll',
			operation: 'create',
			persona: learner.persona,
			params: { question: 'Student poll', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'poll', operation: 'create', endpoint: '/api/v1/polls' });
		expect([401, 403]).toContain(result.error[0].errorCode);
	});

	it('get: returns the poll itself, not Canvas\' { polls: [...] } wrapper', async () => {
		const result = await run({
			resource: 'poll',
			operation: 'get',
			items: [{ id: pollId }, { id: Number(pollId) }, { id: ` ${pollId} ` }],
			params: { pollId: '={{ $json.id }}' },
		});
		expect(result.error).toEqual([]);
		expect(result.success).toHaveLength(3);
		for (const poll of result.success) {
			expect(poll).toEqual(await direct(pollId));
			expect(poll).toMatchObject({ id: pollId, question, description });
		}
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 1 }, { item: 2 }]);
	});

	it('getAll: every poll of the teacher, newest first, across pages', async () => {
		const bulk = await run({
			resource: 'poll',
			operation: 'create',
			items: Array.from({ length: 22 }, (_, i) => ({ n: i })),
			params: { question: '=Bulk poll {{ $json.n }}', batchProcessing: { mode: 'individual' } },
		});
		expect(bulk.error).toEqual([]);
		expect(bulk.success).toHaveLength(22);

		const expected = await allPolls();
		expect(expected).toHaveLength(25);
		const ids = (items: Json[]): string[] => items.map((p) => String(p.id));

		const defaults = await ok({ resource: 'poll', operation: 'getAll' });
		expect(ids(defaults)).toEqual(ids(expected));
		expect(defaults[0]).toMatchObject({ question: 'Bulk poll 21' });
		expect(defaults.every((p) => !('polls' in p))).toBe(true);

		const twoPages = await ok({ resource: 'poll', operation: 'getAll', params: { pagination: { perPage: 4, maxPages: 2 } } });
		expect(ids(twoPages)).toEqual(ids(expected).slice(0, 8));

		const all = await ok({ resource: 'poll', operation: 'getAll', params: { pagination: { returnAll: true, perPage: 9 } } });
		expect(ids(all)).toEqual(ids(expected));
		expect(new Set(ids(all)).size).toBe(25);

		// Someone else's list is their own.
		const colleagues = await runNode({ resource: 'poll', operation: 'getAll', persona: colleague.persona });
		expect(colleagues.success).toEqual([]);
	});

	it('update: question and description reach Canvas', async () => {
		const [updated] = await ok({
			resource: 'poll',
			operation: 'update',
			params: { pollId, updateFields: { question: 'Renamed question?', description: 'Renamed description' } },
		});
		expect(unwrap(updated)).toMatchObject({ id: pollId, question: 'Renamed question?', description: 'Renamed description' });
		expect(await direct(pollId)).toMatchObject({ question: 'Renamed question?', description: 'Renamed description' });
	});

	it('update: one field at a time; an empty description clears it', async () => {
		await ok({ resource: 'poll', operation: 'update', params: { pollId, updateFields: { description: 'Only the description' } } });
		expect(await direct(pollId)).toMatchObject({ question: 'Renamed question?', description: 'Only the description' });

		await ok({ resource: 'poll', operation: 'update', params: { pollId, updateFields: { question: 'Only the question?' } } });
		expect(await direct(pollId)).toMatchObject({ question: 'Only the question?', description: 'Only the description' });

		await ok({ resource: 'poll', operation: 'update', params: { pollId, updateFields: { description: '' } } });
		const cleared = await direct(pollId);
		expect(cleared.question).toBe('Only the question?');
		expect(cleared.description ?? '').toBe('');
	});

	it('update: a too long question is refused and nothing changes', async () => {
		const result = await run({
			resource: 'poll',
			operation: 'update',
			params: { pollId, updateFields: { question: 'y'.repeat(300) }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'update', endpoint: `/api/v1/polls/${pollId}` });
		expect((await direct(pollId)).question).toBe('Only the question?');
	});

	it('permissions: another teacher can neither read, change nor delete the poll', async () => {
		for (const operation of ['get', 'update', 'delete']) {
			const result = await runNode({
				resource: 'poll',
				operation,
				persona: colleague.persona,
				params: {
					pollId,
					...(operation === 'update' ? { updateFields: { question: 'Hijacked' } } : {}),
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error[0], operation).toMatchObject({ errorType: 'FORBIDDEN', resource: 'poll', operation });
		}
		expect((await direct(pollId)).question).toBe('Only the question?');
	});

	it('permissions: a student sees a poll once it has a session in their course, without the teacher-only fields', async () => {
		// (Canvas caches a refusal per user and poll, so the two cases use different polls.)
		const withoutSession = String((await allPolls()).find((p) => p.question === 'Bulk poll 3')?.id);
		const hidden = await runNode({
			resource: 'poll',
			operation: 'get',
			persona: learner.persona,
			params: { pollId: withoutSession, errorHandling: { onError: 'continueWithError' } },
		});
		expect(hidden.success).toEqual([]);
		expect(hidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'get' });

		await asOwner.post(`/api/v1/polls/${pollId}/poll_sessions`, { poll_sessions: [{ course_id: course.id }] });
		const [seen] = await runOk({ resource: 'poll', operation: 'get', persona: learner.persona, params: { pollId } });
		expect(seen).toMatchObject({ id: pollId, question: 'Only the question?' });
		expect(seen).not.toHaveProperty('user_id');
		expect(seen).not.toHaveProperty('total_results');
		// The poll is still not in the student's own list: that only holds polls they created.
		expect((await runNode({ resource: 'poll', operation: 'getAll', persona: learner.persona })).success).toEqual([]);
	});

	it('delete: removes the poll; Canvas answers with no content', async () => {
		const [result] = await ok({ resource: 'poll', operation: 'delete', params: { pollId } });
		expect(result).toEqual({ success: true });
		expect((await asOwner.request('GET', `/api/v1/polls/${pollId}`)).status).toBe(404);
	});

	it('delete / get: several items, with polls that no longer exist', async () => {
		const [first, second] = (await allPolls()).map((p) => String(p.id));
		const result = await run({
			resource: 'poll',
			operation: 'delete',
			items: [{ id: first }, { id: pollId }, { id: second }, { id: 999999999 }],
			params: { pollId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([{ success: true }, { success: true }]);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'poll', operation: 'delete' });
		}
		const left = (await allPolls()).map((p) => String(p.id));
		expect(left).not.toContain(first);
		expect(left).not.toContain(second);
		expect(left).toHaveLength(22);

		const missing = await run({
			resource: 'poll',
			operation: 'get',
			params: { pollId: first, errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'get' });
	});

	it('getAll: the shared teacher persona (read only) matches Canvas', async () => {
		const expected = await new CanvasClient('teacher').getAll<Json>('/api/v1/polls', 'polls');
		const listed = await runOk({ resource: 'poll', operation: 'getAll', persona: 'teacher', params: { pagination: { returnAll: true } } });
		expect(listed.map((p) => p.id)).toEqual(expected.map((p) => p.id));
	});
});
