import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createSandboxAccount, createSandboxCourse, deleteSandboxAccount, deleteSandboxCourse } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: questionBank (question banks of classic quizzes; read-only in the Canvas API).
 *
 * Question banks cannot be created through the REST API, so the fixtures are made
 * with a Rails script in a course and a sub-account that belong to this file alone:
 * a bank with 27 questions (three pages of ten), a small bank with unusual text,
 * an empty bank, a deleted bank, and a bank of the account.
 */

/** Creates the banks and prints their IDs as one line of JSON. */
function fixtureScript(courseId: string, accountId: string): string {
	return `
		course = Course.find(${Number(courseId)})
		account = Account.find(${Number(accountId)})
		choice = lambda do |i|
			{ question_type: "multiple_choice_question", question_name: "Question #{i.to_s.rjust(2, "0")}",
				question_text: "<p>Pick the right one (#{i})</p>", points_possible: 1,
				correct_comments: "Correct!", incorrect_comments: "Try again.",
				answers: [{ answer_text: "Right", answer_weight: 100 }, { answer_text: "Wrong", answer_weight: 0 }] }
		end
		big = course.assessment_question_banks.create!(title: "Big bank")
		28.times { |i| big.assessment_questions.create!(form_question_data: choice.call(i + 1)) }
		big.assessment_questions.order(:id).last.destroy
		small = course.assessment_question_banks.create!(title: "Bank \\"quoted\\" & ünï 題庫")
		small.assessment_questions.create!(form_question_data: { question_type: "essay_question", question_name: "Essay — 説明",
			question_text: "<p>Explain <strong>why</strong> &amp; how</p>", points_possible: 5, neutral_comments: "Graded by hand." })
		small.assessment_questions.create!(form_question_data: { question_type: "true_false_question", question_name: "True or false",
			question_text: "<p>Water is wet.</p>", points_possible: 2,
			answers: [{ answer_text: "True", answer_weight: 100 }, { answer_text: "False", answer_weight: 0 }] })
		empty = course.assessment_question_banks.create!(title: "Empty bank")
		gone = course.assessment_question_banks.create!(title: "Deleted bank")
		gone.destroy
		of_account = account.assessment_question_banks.create!(title: "Account bank")
		3.times { |i| of_account.assessment_questions.create!(form_question_data: choice.call(i + 1)) }
		puts "FIXTURE=" + { big: big.id, small: small.id, empty: empty.id, gone: gone.id, account: of_account.id }.to_json
	`;
}

describe('questionBank', () => {
	let accountId = '';
	let course: SandboxCourse;
	let courseId = '';
	let banks: Record<'big' | 'small' | 'empty' | 'gone' | 'account', number>;
	const eh = { errorHandling: { onError: 'continueWithError' } };
	const SMALL_TITLE = 'Bank "quoted" & ünï 題庫';

	const banksOf = (query: string): Promise<Json[]> => canvas().get<Json[]>(`/api/v1/question_banks?${query}`);
	const questionsOf = (id: number): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/question_banks/${id}/questions`);

	beforeAll(async () => {
		accountId = await createSandboxAccount('question banks');
		course = await createSandboxCourse('question-banks', { accountId, personas: ['teacher'] });
		courseId = course.id;
		const out = execFileSync('docker', ['exec', 'canvas-web', 'bundle', 'exec', 'rails', 'runner', fixtureScript(courseId, accountId)], {
			encoding: 'utf8',
		});
		const line = out.split('\n').find((l) => l.startsWith('FIXTURE='));
		if (!line) throw new Error(`The question bank fixtures were not created: ${out.slice(0, 500)}`);
		banks = JSON.parse(line.slice('FIXTURE='.length));
	}, 900_000);

	afterAll(async () => {
		await deleteSandboxCourse(course);
		await deleteSandboxAccount(accountId);
	}, 300_000);

	// ---------------------------------------------------------------- getAll

	it('getAll (course): every bank of the course that is not deleted', async () => {
		const expected = await banksOf(`context_type=Course&context_id=${courseId}`);
		const listed = await runOk({ resource: 'questionBank', operation: 'getAll', persona: 'teacher', params: { context: 'course', courseId } });
		expect(listed).toEqual(expected);
		expect(listed.map((bank) => bank.id).sort()).toEqual([banks.big, banks.small, banks.empty].sort());
		expect(listed.map((bank) => bank.id)).not.toContain(banks.gone);
		const small = listed.find((bank) => bank.id === banks.small) as Json;
		expect(small).toMatchObject({
			title: SMALL_TITLE,
			context_type: 'Course',
			context_id: Number(courseId),
			context_code: `course_${courseId}`,
			workflow_state: 'active',
		});
		expect(small).not.toHaveProperty('assessment_question_count');

		// Canvas does not page this list: it answers with all banks whatever page size is asked for.
		const smallPages = await runOk({
			resource: 'questionBank',
			operation: 'getAll',
			params: { context: 'course', courseId, pagination: { perPage: 1, maxPages: 1 } },
		});
		expect(smallPages.map((bank) => bank.id)).toEqual(expected.map((bank) => bank.id));
	});

	it('getAll: "Include Question Count" on and off; the ID as a number from an expression', async () => {
		const counted = await runOk({
			resource: 'questionBank',
			operation: 'getAll',
			items: [{ course: Number(courseId) }],
			params: { context: 'course', courseId: '={{ $json.course }}', options: { include_question_count: true } },
		});
		expect(Object.fromEntries(counted.map((bank) => [bank.id, bank.assessment_question_count]))).toEqual({
			[banks.big]: 27,
			[banks.small]: 2,
			[banks.empty]: 0,
		});

		// Off must really be off: Canvas would count as soon as the argument is present, even as "false".
		const uncounted = await runOk({
			resource: 'questionBank',
			operation: 'getAll',
			params: { context: 'course', courseId, options: { include_question_count: false } },
		});
		expect(uncounted).toHaveLength(3);
		expect(uncounted.every((bank) => !('assessment_question_count' in bank))).toBe(true);
	});

	it('getAll (account): the banks of an account', async () => {
		const expected = await banksOf(`context_type=Account&context_id=${accountId}&include_question_count=1`);
		const listed = await runOk({
			resource: 'questionBank',
			operation: 'getAll',
			params: { context: 'account', accountId, options: { include_question_count: true } },
		});
		expect(listed).toEqual(expected);
		expect(listed).toEqual([
			expect.objectContaining({
				id: banks.account,
				title: 'Account bank',
				context_type: 'Account',
				context_id: Number(accountId),
				context_code: `account_${accountId}`,
				assessment_question_count: 3,
			}),
		]);
	});

	// ---------------------------------------------------------------- get

	it('get: one bank, with and without the number of its questions', async () => {
		const [plain] = await runOk({ resource: 'questionBank', operation: 'get', persona: 'teacher', params: { questionBankId: ` ${banks.small} ` } });
		expect(plain).toEqual(await canvas().get<Json>(`/api/v1/question_banks/${banks.small}`));
		expect(plain).toMatchObject({ id: banks.small, title: SMALL_TITLE, context_code: `course_${courseId}` });
		expect(plain).not.toHaveProperty('assessment_question_count');

		const counted = await runOk({
			resource: 'questionBank',
			operation: 'get',
			items: [{ id: banks.big }, { id: banks.empty }, { id: banks.account }],
			params: { questionBankId: '={{ $json.id }}', options: { include_question_count: true } },
		});
		expect(counted.map((bank) => [bank.id, bank.assessment_question_count])).toEqual([
			[banks.big, 27],
			[banks.empty, 0],
			[banks.account, 3],
		]);

		// A deleted bank is left out of the list but can still be read by its ID.
		const [deleted] = await runOk({ resource: 'questionBank', operation: 'get', params: { questionBankId: String(banks.gone) } });
		expect(deleted).toMatchObject({ id: banks.gone, title: 'Deleted bank', workflow_state: 'deleted' });
	});

	// ---------------------------------------------------------------- listQuestions

	it('listQuestions: a bank with more questions than two pages', async () => {
		const expected = await questionsOf(banks.big);
		expect(expected).toHaveLength(27);

		// Default paging: 10 per page, up to 5 pages.
		const byDefault = await runOk({ resource: 'questionBank', operation: 'listQuestions', persona: 'teacher', params: { questionBankId: String(banks.big) } });
		expect(byDefault.map((q) => q.id)).toEqual(expected.map((q) => q.id));
		expect(new Set(byDefault.map((q) => q.id)).size).toBe(27);
		// The question that was deleted from the bank is not listed.
		expect(byDefault.map((q) => q.question_name).sort()).toEqual(Array.from({ length: 27 }, (_, i) => `Question ${String(i + 1).padStart(2, '0')}`));

		const all = await runOk({
			resource: 'questionBank',
			operation: 'listQuestions',
			params: { questionBankId: banks.big, pagination: { returnAll: true } },
		});
		expect(all).toEqual(expected);

		const threePages = await runOk({
			resource: 'questionBank',
			operation: 'listQuestions',
			params: { questionBankId: String(banks.big), pagination: { perPage: 4, maxPages: 3 } },
		});
		expect(threePages.map((q) => q.id)).toEqual(expected.slice(0, 12).map((q) => q.id));

		const smallPages = await runOk({
			resource: 'questionBank',
			operation: 'listQuestions',
			params: { questionBankId: String(banks.big), pagination: { perPage: 7, maxPages: 0 } },
		});
		expect(smallPages.map((q) => q.id)).toEqual(expected.map((q) => q.id));
	});

	it('listQuestions: the questions with their text and answers; an empty bank has no items', async () => {
		const questions = await runOk({ resource: 'questionBank', operation: 'listQuestions', params: { questionBankId: String(banks.small) } });
		expect(questions).toEqual(await questionsOf(banks.small));
		expect(questions).toHaveLength(2);
		const essay = questions.find((q) => q.question_type === 'essay_question') as Json;
		expect(essay).toMatchObject({
			question_name: 'Essay — 説明',
			question_text: '<p>Explain <strong>why</strong> &amp; how</p>',
			points_possible: 5,
			neutral_comments: 'Graded by hand.',
			assessment_question_bank_id: banks.small,
		});
		const trueFalse = questions.find((q) => q.question_type === 'true_false_question') as Json;
		expect((trueFalse.answers as Json[]).map((a) => [a.text, a.weight])).toEqual([
			['True', 100],
			['False', 0],
		]);

		const [first] = await runOk({ resource: 'questionBank', operation: 'listQuestions', params: { questionBankId: String(banks.big), pagination: { perPage: 1, maxPages: 1 } } });
		expect(first).toMatchObject({ question_type: 'multiple_choice_question', correct_comments: 'Correct!', incorrect_comments: 'Try again.' });
		expect((first.answers as Json[]).map((a) => [a.text, a.weight])).toEqual([
			['Right', 100],
			['Wrong', 0],
		]);

		const none = await runNode({ resource: 'questionBank', operation: 'listQuestions', params: { questionBankId: String(banks.empty), pagination: { returnAll: true } } });
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
		expect(none.error).toEqual([]);

		const ofAccount = await runOk({ resource: 'questionBank', operation: 'listQuestions', params: { questionBankId: String(banks.account) } });
		expect(ofAccount.map((q) => q.id)).toEqual((await questionsOf(banks.account)).map((q) => q.id));
		expect(ofAccount).toHaveLength(3);
	});

	// ---------------------------------------------------------------- errors

	it('errors: students may not read banks; Canvas answers "unauthorized" for banks and contexts it does not know', async () => {
		// Enrolled in nothing here: the student persona.
		const cases: Array<[string, Json]> = [
			['getAll', { context: 'course', courseId }],
			['getAll', { context: 'account', accountId }],
			['get', { questionBankId: String(banks.big) }],
			['listQuestions', { questionBankId: String(banks.big) }],
		];
		for (const [operation, params] of cases) {
			const forbidden = await runNode({ resource: 'questionBank', operation, persona: 'student', params: { ...params, ...eh } });
			expect(forbidden.success, operation).toEqual([]);
			expect([401, 403], operation).toContain(forbidden.error[0].errorCode);
			expect(forbidden.error[0], operation).toMatchObject({ resource: 'questionBank', operation });
		}
		// The teacher of the course has no rights in the account.
		const asTeacher = await runNode({ resource: 'questionBank', operation: 'getAll', persona: 'teacher', params: { context: 'account', accountId, ...eh } });
		expect([401, 403]).toContain(asTeacher.error[0].errorCode);
		expect(await new CanvasClient('teacher').request('GET', `/api/v1/question_banks/${banks.big}`)).toMatchObject({ status: 200 });

		// An unknown bank is "unauthorized" rather than "not found"; the other items still go through.
		const unknown = await runNode({
			resource: 'questionBank',
			operation: 'get',
			items: [{ id: 99999999 }, { id: banks.small }],
			params: { questionBankId: '={{ $json.id }}', ...eh },
		});
		expect(unknown.success.map((bank) => bank.id)).toEqual([banks.small]);
		expect(unknown.rawSuccess[0].pairedItem).toEqual({ item: 1 });
		expect(unknown.error).toHaveLength(1);
		expect([401, 403]).toContain(unknown.error[0].errorCode);
		expect(unknown.error[0]).toMatchObject({ originalItem: { id: 99999999 }, endpoint: '/api/v1/question_banks/99999999' });

		// The list only takes numeric IDs: a SIS ID is an unknown course to it.
		for (const id of ['99999999', `sis_course_id:${course.sisId}`]) {
			const noCourse = await runNode({ resource: 'questionBank', operation: 'getAll', params: { context: 'course', courseId: id, ...eh } });
			expect(noCourse.success, id).toEqual([]);
			expect([401, 403], id).toContain(noCourse.error[0].errorCode);
		}
	});
});
