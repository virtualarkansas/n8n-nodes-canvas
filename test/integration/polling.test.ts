import { beforeAll, describe, expect, it } from 'vitest';
import { CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resources: pollChoice, pollSession, pollSubmission.
 * A teacher owns a poll, holds sessions for a course they teach, and students
 * of that course answer. Everything is verified against Canvas directly.
 */
const teacher = new CanvasClient('teacher');
const courseId = fx('courseId');
let pollId = '';

beforeAll(async () => {
	const created = await teacher.post<Json>('/api/v1/polls', {
		polls: [{ question: unique('Which topic next? ¿Cuál? 次は?'), description: 'Battery poll' }],
	});
	pollId = String((created.polls as Json[])[0].id);
});

describe('pollChoice', () => {
	const choiceIds: string[] = [];

	it('create: adds choices with text, correctness and position', async () => {
		const inputs = [
			{ text: 'Plain choice', is_correct: true, position: 1 },
			{ text: 'Ünïcødé — "quoted" & <b>markup</b> 🎯', is_correct: false, position: 2 },
			{ text: 'x'.repeat(250), is_correct: false, position: 3 },
		];
		for (const input of inputs) {
			const [choice] = await runOk({
				resource: 'pollChoice',
				operation: 'create',
				persona: 'teacher',
				params: { pollId, text: input.text, additionalFields: { is_correct: input.is_correct, position: input.position } },
			});
			// The API wraps even one record in { poll_choices: [...] }; the node unwraps it.
			expect(choice).toMatchObject({ text: input.text, is_correct: input.is_correct, position: input.position });
			expect(choice.poll_choices).toBeUndefined();
			choiceIds.push(String(choice.id));
		}
		const actual = (await teacher.get<Json>(`/api/v1/polls/${pollId}/poll_choices`)).poll_choices as Json[];
		expect(actual.map((c) => String(c.id)).sort()).toEqual([...choiceIds].sort());
	});

	it('create: a choice with only its text', async () => {
		const [choice] = await runOk({ resource: 'pollChoice', operation: 'create', persona: 'teacher', params: { pollId, text: 'Minimal' } });
		expect(choice).toMatchObject({ text: 'Minimal', is_correct: false });
		choiceIds.push(String(choice.id));
	});

	it('get: returns one choice', async () => {
		const [choice] = await runOk({ resource: 'pollChoice', operation: 'get', persona: 'teacher', params: { pollId, pollChoiceId: choiceIds[1] } });
		expect(choice).toMatchObject({ id: choiceIds[1], text: 'Ünïcødé — "quoted" & <b>markup</b> 🎯' });
	});

	it('getAll: lists every choice of a poll with many choices, one item each', async () => {
		const big = String(((await teacher.post<Json>('/api/v1/polls', { polls: [{ question: unique('Many choices') }] })).polls as Json[])[0].id);
		for (let i = 1; i <= 23; i++) {
			await teacher.post(`/api/v1/polls/${big}/poll_choices`, { poll_choices: [{ text: `Choice ${i}`, position: i }] });
		}
		const all = await runOk({ resource: 'pollChoice', operation: 'getAll', persona: 'teacher', params: { pollId: big, pagination: { returnAll: true } } });
		expect(all).toHaveLength(23);
		expect(new Set(all.map((c) => c.id)).size).toBe(23);
		expect(all.map((c) => c.position)).toEqual([...Array(23)].map((_, i) => i + 1));

		const paged = await runOk({ resource: 'pollChoice', operation: 'getAll', persona: 'teacher', params: { pollId: big, pagination: { perPage: 5, maxPages: 2 } } });
		expect(paged).toHaveLength(10);

		const none = await runOk({
			resource: 'pollChoice',
			operation: 'getAll',
			persona: 'teacher',
			params: { pollId: String(((await teacher.post<Json>('/api/v1/polls', { polls: [{ question: unique('Empty') }] })).polls as Json[])[0].id) },
		});
		expect(none).toEqual([]);
		await teacher.delete(`/api/v1/polls/${big}`);
	});

	it('update: changes text, correctness and position', async () => {
		const [updated] = await runOk({
			resource: 'pollChoice',
			operation: 'update',
			persona: 'teacher',
			params: { pollId, pollChoiceId: choiceIds[3], updateFields: { text: 'Renamed', is_correct: true, position: 9 } },
		});
		expect(updated).toMatchObject({ id: choiceIds[3], text: 'Renamed', is_correct: true, position: 9 });
		const actual = ((await teacher.get<Json>(`/api/v1/polls/${pollId}/poll_choices/${choiceIds[3]}`)).poll_choices as Json[])[0];
		expect(actual).toMatchObject({ text: 'Renamed', is_correct: true, position: 9 });
	});

	it('delete: removes a choice', async () => {
		const [result] = await runOk({ resource: 'pollChoice', operation: 'delete', persona: 'teacher', params: { pollId, pollChoiceId: choiceIds[3] } });
		expect(result).toEqual({ success: true });
		const after = await teacher.request('GET', `/api/v1/polls/${pollId}/poll_choices/${choiceIds[3]}`);
		expect(after.status).toBe(404);
	});

	it('errors: validation and permissions are reported', async () => {
		const blank = await runNode({
			resource: 'pollChoice',
			operation: 'update',
			persona: 'teacher',
			params: { pollId, pollChoiceId: choiceIds[0], updateFields: { text: '' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(blank.success).toEqual([]);
		expect(blank.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });

		const student = await runNode({
			resource: 'pollChoice',
			operation: 'create',
			persona: 'student',
			params: { pollId, text: 'Not allowed', errorHandling: { onError: 'continueWithError' } },
		});
		expect(student.success).toEqual([]);
		expect([401, 403, 404]).toContain(student.error[0].errorCode);
	});

	// Used by the session and submission tests below.
	it('leaves the poll with three choices', async () => {
		const actual = (await teacher.get<Json>(`/api/v1/polls/${pollId}/poll_choices`)).poll_choices as Json[];
		expect(actual).toHaveLength(3);
	});

	describe('pollSession and pollSubmission', () => {
		let sessionId = '';
		let sectionSessionId = '';

		it('pollSession.create: for a whole course and for one section', async () => {
			const [session] = await runOk({
				resource: 'pollSession',
				operation: 'create',
				persona: 'teacher',
				params: { pollId, courseId, additionalFields: { has_public_results: true } },
			});
			expect(session).toMatchObject({ course_id: courseId, is_published: false, has_public_results: true, poll_id: pollId });
			sessionId = String(session.id);

			const [sectionSession] = await runOk({
				resource: 'pollSession',
				operation: 'create',
				persona: 'teacher',
				params: { pollId, courseId, additionalFields: { course_section_id: fx('sectionId') } },
			});
			expect(sectionSession).toMatchObject({ course_id: courseId, course_section_id: fx('sectionId'), has_public_results: false });
			sectionSessionId = String(sectionSession.id);
		});

		it('pollSession.getAll and get: list and read sessions with their results', async () => {
			const sessions = await runOk({ resource: 'pollSession', operation: 'getAll', persona: 'teacher', params: { pollId } });
			expect(sessions.map((s) => String(s.id)).sort()).toEqual([sessionId, sectionSessionId].sort());

			const [session] = await runOk({ resource: 'pollSession', operation: 'get', persona: 'teacher', params: { pollId, pollSessionId: sessionId } });
			expect(session).toMatchObject({ id: sessionId, is_published: false });
			expect(session).toHaveProperty('results');
		});

		it('pollSession.update: moves the session to a section and changes result visibility', async () => {
			const [updated] = await runOk({
				resource: 'pollSession',
				operation: 'update',
				persona: 'teacher',
				params: { pollId, pollSessionId: sectionSessionId, updateFields: { course_section_id: fx('sectionId2'), has_public_results: true } },
			});
			expect(updated).toMatchObject({ course_section_id: fx('sectionId2'), has_public_results: true });
		});

		it('pollSubmission.create: is refused while the session is closed', async () => {
			const choice = String(((await teacher.get<Json>(`/api/v1/polls/${pollId}/poll_choices`)).poll_choices as Json[])[0].id);
			const result = await runNode({
				resource: 'pollSubmission',
				operation: 'create',
				persona: 'student',
				params: { pollId, pollSessionId: sessionId, pollChoiceId: choice, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect([400, 401, 403]).toContain(result.error[0].errorCode);
		});

		it('pollSession.open and getOpened: publishes the session', async () => {
			const [opened] = await runOk({ resource: 'pollSession', operation: 'open', persona: 'teacher', params: { pollId, pollSessionId: sessionId } });
			expect(opened).toMatchObject({ id: sessionId, is_published: true });

			const mine = await runOk({ resource: 'pollSession', operation: 'getOpened', persona: 'teacher', params: { pagination: { returnAll: true } } });
			expect(mine.map((s) => String(s.id))).toContain(sessionId);
			expect(mine.map((s) => String(s.id))).not.toContain(sectionSessionId);

			// Students of the course see it too.
			const theirs = await runOk({ resource: 'pollSession', operation: 'getOpened', persona: 'student', params: { pagination: { returnAll: true } } });
			expect(theirs.map((s) => String(s.id))).toContain(sessionId);
		});

		it('pollSubmission.create and get: a student answers, once', async () => {
			const choices = (await teacher.get<Json>(`/api/v1/polls/${pollId}/poll_choices`)).poll_choices as Json[];
			const choice = String(choices[1].id);
			const [submission] = await runOk({
				resource: 'pollSubmission',
				operation: 'create',
				persona: 'student',
				params: { pollId, pollSessionId: sessionId, pollChoiceId: choice },
			});
			expect(submission).toMatchObject({ poll_choice_id: choice, user_id: fx('studentUserId') });

			const [fetched] = await runOk({
				resource: 'pollSubmission',
				operation: 'get',
				persona: 'student',
				params: { pollId, pollSessionId: sessionId, pollSubmissionId: String(submission.id) },
			});
			expect(fetched).toMatchObject({ id: submission.id, poll_choice_id: choice });

			const again = await runNode({
				resource: 'pollSubmission',
				operation: 'create',
				persona: 'student',
				params: { pollId, pollSessionId: sessionId, pollChoiceId: choice, errorHandling: { onError: 'continueWithError' } },
			});
			expect(again.success).toEqual([]);
			expect(again.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });

			// The teacher sees the tally in the session results.
			const [session] = await runOk({ resource: 'pollSession', operation: 'get', persona: 'teacher', params: { pollId, pollSessionId: sessionId } });
			expect((session.results as Json)[choice]).toBe(1);
		});

		it('pollSession.close and getClosed: stops accepting answers', async () => {
			const [closed] = await runOk({ resource: 'pollSession', operation: 'close', persona: 'teacher', params: { pollId, pollSessionId: sessionId } });
			expect(closed).toMatchObject({ id: sessionId, is_published: false });
			const list = await runOk({ resource: 'pollSession', operation: 'getClosed', persona: 'teacher', params: { pagination: { returnAll: true } } });
			expect(list.map((s) => String(s.id))).toContain(sessionId);
		});

		it('pollSession.delete: removes a session', async () => {
			const [result] = await runOk({ resource: 'pollSession', operation: 'delete', persona: 'teacher', params: { pollId, pollSessionId: sectionSessionId } });
			expect(result).toEqual({ success: true });
			const remaining = (await teacher.get<Json>(`/api/v1/polls/${pollId}/poll_sessions`)).poll_sessions as Json[];
			expect(remaining.map((s) => String(s.id))).toEqual([sessionId]);
		});

		it('errors: a session for a course the teacher does not teach is refused', async () => {
			const result = await runNode({
				resource: 'pollSession',
				operation: 'create',
				persona: 'student',
				params: { pollId, courseId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect([401, 403, 404]).toContain(result.error[0].errorCode);
		});
	});
});
