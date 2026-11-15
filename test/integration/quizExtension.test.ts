import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import type { Json } from '../lib/n8n';
import { runNode, runOk } from './support/run';
import { createQuiz, deleteQuiz, ensureCourse, MULTIPLE_CHOICE, quizCourse, startAttempt, unwrap } from './support/quizzes';

/**
 * Resource: quizExtension (extra attempts / extra time for individual students).
 * Every operation runs through a real n8n instance; the result is verified on the
 * students' quiz submissions read from Canvas directly.
 */
describe('quizExtension', () => {
	let courseId = '';
	let quizId = '';
	const student = fx('studentUserId');
	const student2 = fx('student2UserId');

	/** The quiz submissions of a quiz by user ID (Canvas stores extensions on them). */
	const submissionsByUser = async (course: string, quiz: string): Promise<Record<string, Json>> => {
		const all = await canvas().getAll<Json>(`/api/v1/courses/${course}/quizzes/${quiz}/submissions`, 'quiz_submissions');
		return Object.fromEntries(all.map((s) => [String(s.user_id), s]));
	};
	const entries = (item: Json): Json[] => (Array.isArray(item.quiz_extensions) ? (item.quiz_extensions as Json[]) : [item]);

	beforeAll(async () => {
		courseId = await quizCourse();
		quizId = (
			await createQuiz(courseId, { title: unique('Extended quiz'), time_limit: 20, allowed_attempts: 1 }, [MULTIPLE_CHOICE])
		).id;
	});

	it('setExtensions: extra attempts, extra time and unlocking for several students at once', async () => {
		const items = await runOk({
			resource: 'quizExtension',
			operation: 'setExtensions',
			persona: 'teacher',
			params: {
				courseId,
				quizId,
				extensions: {
					extensionValues: [
						{ user_id: student, extra_attempts: 2, extra_time: 15, manually_unlocked: true },
						{ user_id: Number(student2), extra_attempts: 1, extra_time: 0, manually_unlocked: false },
					],
				},
			},
		});
		const returned = items.flatMap(entries);
		expect(returned.map((e) => [String(e.user_id), e.extra_attempts, e.extra_time, e.manually_unlocked])).toEqual([
			[student, 2, 15, true],
			[student2, 1, 0, false],
		]);
		expect(returned.every((e) => String(e.quiz_id) === quizId)).toBe(true);

		const actual = await submissionsByUser(courseId, quizId);
		expect(actual[student]).toMatchObject({ extra_attempts: 2, extra_time: 15, manually_unlocked: true });
		expect(actual[student2]).toMatchObject({ extra_attempts: 1, extra_time: 0, manually_unlocked: false });
		// Nobody has started the quiz: the extension lives on a placeholder submission.
		expect(actual[student].workflow_state).toBe('settings_only');
	});

	it('setExtensions: the values are replaced, not added up; Canvas caps them', async () => {
		await runOk({
			resource: 'quizExtension',
			operation: 'setExtensions',
			params: {
				courseId,
				quizId,
				extensions: { extensionValues: [{ user_id: ` ${student} `, extra_attempts: 5000, extra_time: 20000, manually_unlocked: false }] },
			},
		});
		const actual = await submissionsByUser(courseId, quizId);
		expect(actual[student]).toMatchObject({ extra_attempts: 1000, extra_time: 10080, manually_unlocked: false });
		// The other student was not in the request and keeps what they had.
		expect(actual[student2]).toMatchObject({ extra_attempts: 1, extra_time: 0 });
	});

	it('setExtensions: extending the time of an attempt in progress, from its end and from now', async () => {
		// With 15 extra minutes the student's attempt runs for 20 + 15 minutes.
		await runOk({
			resource: 'quizExtension',
			operation: 'setExtensions',
			params: { courseId, quizId, extensions: { extensionValues: [{ user_id: student, extra_attempts: 0, extra_time: 15 }] } },
		});
		const attempt = await startAttempt(courseId, quizId, 'student');
		const endAt = async (): Promise<number> =>
			new Date(String((await submissionsByUser(courseId, quizId))[student].end_at)).getTime();
		const started = new Date(String(attempt.started_at)).getTime();
		expect(Math.abs((await endAt()) - (started + 35 * 60_000))).toBeLessThan(5000);

		// The UI pre-fills "Extend From Now" with 0. Canvas would read that 0 as the extension
		// and ignore "Extend From End At"; the node leaves the 0 out.
		const [item] = await runOk({
			resource: 'quizExtension',
			operation: 'setExtensions',
			params: {
				courseId,
				quizId,
				extensions: {
					extensionValues: [{ user_id: student, extra_attempts: 0, extra_time: 15, extend_from_now: 0, extend_from_end_at: 10 }],
				},
			},
		});
		expect(Math.abs((await endAt()) - (started + 45 * 60_000))).toBeLessThan(5000);
		expect(new Date(String(entries(item)[0].end_at)).getTime()).toBe(await endAt());

		const before = Date.now();
		await runOk({
			resource: 'quizExtension',
			operation: 'setExtensions',
			params: {
				courseId,
				quizId,
				extensions: {
					extensionValues: [{ user_id: student, extra_attempts: 0, extra_time: 15, extend_from_now: 90, extend_from_end_at: 0 }],
				},
			},
		});
		expect((await endAt()) - before).toBeGreaterThan(89 * 60_000);
		expect((await endAt()) - before).toBeLessThan(91 * 60_000);

		// Both given: Canvas (and the node) go by "Extend From Now".
		const again = Date.now();
		await runOk({
			resource: 'quizExtension',
			operation: 'setExtensions',
			params: {
				courseId,
				quizId,
				extensions: {
					extensionValues: [{ user_id: student, extra_attempts: 0, extra_time: 15, extend_from_now: 30, extend_from_end_at: 600 }],
				},
			},
		});
		expect((await endAt()) - again).toBeGreaterThan(29 * 60_000);
		expect((await endAt()) - again).toBeLessThan(31 * 60_000);
	});

	it('setExtensions: one request per input item, with values from expressions', async () => {
		const quizB = (await createQuiz(courseId, { title: unique('Extended quiz B') }, [MULTIPLE_CHOICE])).id;
		const result = await runNode({
			resource: 'quizExtension',
			operation: 'setExtensions',
			items: [
				{ quiz: Number(quizId), user: Number(student2), attempts: 3 },
				{ quiz: quizB, user: student2, attempts: 4 },
			],
			params: {
				courseId,
				quizId: '={{ $json.quiz }}',
				extensions: { extensionValues: [{ user_id: '={{ $json.user }}', extra_attempts: '={{ $json.attempts }}' }] },
			},
		});
		expect(result.error).toEqual([]);
		expect(result.success).toHaveLength(2);
		expect((await submissionsByUser(courseId, quizId))[student2]).toMatchObject({ extra_attempts: 3 });
		expect((await submissionsByUser(courseId, quizB))[student2]).toMatchObject({ extra_attempts: 4 });
		await deleteQuiz(courseId, quizB);
	});

	it('setExtensions: errors — nobody listed, an unknown student, a student as caller', async () => {
		const empty = await runNode({
			resource: 'quizExtension',
			operation: 'setExtensions',
			params: { courseId, quizId, extensions: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(empty.success).toEqual([]);
		expect(empty.error[0]).toMatchObject({ errorCode: 0, operation: 'setExtensions' });
		expect(String(empty.error[0].errorMessage)).toContain('At least one extension entry');

		const unknown = await runNode({
			resource: 'quizExtension',
			operation: 'setExtensions',
			params: {
				courseId,
				quizId,
				// The teacher is in the course, but not as a student.
				extensions: { extensionValues: [{ user_id: fx('teacherUserId'), extra_attempts: 1 }] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(unknown.success).toEqual([]);
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'setExtensions' });

		const forbidden = await runNode({
			resource: 'quizExtension',
			operation: 'setExtensions',
			persona: 'student',
			params: {
				courseId,
				quizId,
				extensions: { extensionValues: [{ user_id: student, extra_attempts: 9 }] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'quizExtension' });
		expect((await submissionsByUser(courseId, quizId))[student].extra_attempts).toBe(0);
		await deleteQuiz(courseId, quizId);
	});

	describe('for every quiz of a course', () => {
		let extensionCourseId = '';
		let quizIds: string[] = [];

		beforeAll(async () => {
			// This operation touches every quiz of the course, so it gets a course of its own.
			extensionCourseId = await ensureCourse('BATTERY-QUIZ-EXTENSIONS', 'Battery: course quiz extensions');
			const existing = await canvas().getAll<Json>(`/api/v1/courses/${extensionCourseId}/quizzes`);
			for (let i = existing.length; i < 3; i++) {
				const quiz = await createQuiz(extensionCourseId, { title: `Course extension quiz ${i + 1}`, time_limit: 10 }, [MULTIPLE_CHOICE]);
				existing.push(quiz.quiz);
			}
			quizIds = existing.map((q) => String(q.id));
		});

		it('setCourseExtensions: the students get the extension on every quiz', async () => {
			const extraTime = 10 + Math.floor(Math.random() * 80);
			const extraAttempts = 1 + Math.floor(Math.random() * 8);
			const items = await runOk({
				resource: 'quizExtension',
				operation: 'setCourseExtensions',
				persona: 'teacher',
				params: {
					courseId: extensionCourseId,
					extensions: {
						extensionValues: [
							{ user_id: student, extra_attempts: extraAttempts, extra_time: extraTime, manually_unlocked: true },
							{ user_id: student2, extra_attempts: 0, extra_time: extraTime + 1, manually_unlocked: false },
						],
					},
				},
			});
			const returned = items.flatMap(entries);
			expect(returned).toHaveLength(quizIds.length * 2);
			expect(new Set(returned.map((e) => String(e.quiz_id)))).toEqual(new Set(quizIds));
			expect(unwrap(items[0], 'quiz_extensions')).toHaveProperty('user_id');

			for (const id of quizIds) {
				const actual = await submissionsByUser(extensionCourseId, id);
				expect(actual[student], `quiz ${id}`).toMatchObject({
					extra_attempts: extraAttempts,
					extra_time: extraTime,
					manually_unlocked: true,
				});
				expect(actual[student2], `quiz ${id}`).toMatchObject({
					extra_attempts: 0,
					extra_time: extraTime + 1,
					manually_unlocked: false,
				});
			}
		});

		it('setCourseExtensions: students may not grant extensions; an unknown user is not found', async () => {
			const forbidden = await runNode({
				resource: 'quizExtension',
				operation: 'setCourseExtensions',
				persona: 'student',
				params: {
					courseId: extensionCourseId,
					extensions: { extensionValues: [{ user_id: student, extra_attempts: 999 }] },
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(forbidden.success).toEqual([]);
			expect(forbidden.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'setCourseExtensions' });

			const unknown = await runNode({
				resource: 'quizExtension',
				operation: 'setCourseExtensions',
				params: {
					courseId: extensionCourseId,
					extensions: { extensionValues: [{ user_id: '99999999', extra_attempts: 1 }] },
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(unknown.success).toEqual([]);
			expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'setCourseExtensions' });
			expect((await submissionsByUser(extensionCourseId, quizIds[0]))[student].extra_attempts).not.toBe(999);
		});
	});
});
