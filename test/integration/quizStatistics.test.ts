import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import type { Json } from '../lib/n8n';
import { runNode, runOk } from './support/run';
import {
	createQuiz,
	deleteQuiz,
	FIXTURE_TIMEOUT,
	MULTIPLE_CHOICE,
	quizCourse,
	submissionMarathon,
	takeQuiz,
} from './support/quizzes';

/**
 * Resource: quizStatistics (aggregate statistics of a classic quiz). The
 * operation runs through a real n8n instance and is compared with what Canvas
 * answers directly.
 */
describe('quizStatistics', () => {
	let courseId = '';
	let quizId = '';
	let takerCount = 0;
	let defaultSectionId = '';
	let emptySectionId = '';

	const statsPath = (): string => `/api/v1/courses/${courseId}/quizzes/${quizId}/statistics`;
	const readStats = async (query = ''): Promise<Json> =>
		((await canvas().get<Json>(`${statsPath()}${query}`)).quiz_statistics as Json[])[0];
	const counts = (stats: Json): Json => {
		const submissions = stats.submission_statistics as Json;
		return { unique_count: submissions.unique_count, score_high: submissions.score_high, score_low: submissions.score_low };
	};

	beforeAll(async () => {
		// The quiz many students have taken (see support/quizzes.ts).
		const marathon = await submissionMarathon();
		courseId = marathon.courseId;
		quizId = marathon.quizId;
		takerCount = marathon.takers.length;

		const sections = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/sections`);
		const name = 'Nobody is in here (statistics fixture)';
		const empty =
			sections.find((s) => s.name === name) ??
			(await canvas().post<Json>(`/api/v1/courses/${courseId}/sections`, { course_section: { name } }));
		emptySectionId = String(empty.id);
		defaultSectionId = String((sections.find((s) => s.name !== name) as Json).id);
	}, FIXTURE_TIMEOUT);

	it('get: returns the statistics record itself, with question and submission statistics', async () => {
		const expected = await readStats();
		const result = await runNode({ resource: 'quizStatistics', operation: 'get', params: { courseId, quizId } });
		expect(result.error).toEqual([]);
		expect(result.success).toHaveLength(1);
		const [stats] = result.success;
		expect(stats).not.toHaveProperty('quiz_statistics');
		expect(stats).toMatchObject({
			id: expected.id,
			includes_all_versions: false,
			points_possible: expected.points_possible,
			multiple_attempts_exist: expected.multiple_attempts_exist,
		});
		expect(counts(stats)).toEqual(counts(expected));
		expect((stats.submission_statistics as Json).unique_count).toBeGreaterThanOrEqual(takerCount);
		expect((stats.question_statistics as Json[]).map((q) => q.id)).toEqual(
			(expected.question_statistics as Json[]).map((q) => q.id),
		);
		expect((stats.question_statistics as Json[]).map((q) => q.question_type).sort()).toEqual([
			'essay_question',
			'multiple_choice_question',
		]);
	});

	it('get: "all versions" counts every attempt', async () => {
		const expected = await readStats('?all_versions=true');
		const [stats] = await runOk({
			resource: 'quizStatistics',
			operation: 'get',
			persona: 'teacher',
			params: { courseId, quizId: Number(quizId), options: { all_versions: true } },
		});
		expect(stats).toMatchObject({ includes_all_versions: true });
		expect(counts(stats)).toEqual(counts(expected));

		const [latest] = await runOk({
			resource: 'quizStatistics',
			operation: 'get',
			params: { courseId, quizId, options: { all_versions: false } },
		});
		expect(latest).toMatchObject({ includes_all_versions: false });
	});

	it('get: section IDs restrict the statistics to the students of those sections', async () => {
		const [everyone] = await runOk({
			resource: 'quizStatistics',
			operation: 'get',
			params: { courseId, quizId, options: { section_ids: ` ${defaultSectionId} , ${emptySectionId} ` } },
		});
		expect(counts(everyone)).toEqual(
			counts(await readStats(`?section_ids[]=${defaultSectionId}&section_ids[]=${emptySectionId}`)),
		);
		expect((everyone.submission_statistics as Json).unique_count).toBeGreaterThanOrEqual(takerCount);

		const [nobody] = await runOk({
			resource: 'quizStatistics',
			operation: 'get',
			params: { courseId, quizId, options: { section_ids: emptySectionId } },
		});
		expect((nobody.submission_statistics as Json).unique_count).toBe(0);
		expect(counts(nobody)).toEqual(counts(await readStats(`?section_ids[]=${emptySectionId}`)));
	});

	it('get: a quiz nobody has taken has empty statistics; one item per input quiz', async () => {
		const mainCourse = await quizCourse();
		const untaken = await createQuiz(mainCourse, { title: unique('Stats: untaken') }, [MULTIPLE_CHOICE]);
		const taken = await createQuiz(mainCourse, { title: unique('Stats: taken once') }, [MULTIPLE_CHOICE]);
		await takeQuiz(mainCourse, taken.id, 'student');

		const result = await runNode({
			resource: 'quizStatistics',
			operation: 'get',
			items: [{ quiz: untaken.id }, { quiz: Number(taken.id) }, { quiz: 99999999 }],
			params: { courseId: mainCourse, quizId: '={{ $json.quiz }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toHaveLength(2);
		expect(result.rawSuccess.map((i) => (i.pairedItem as Json).item)).toEqual([0, 1]);
		expect((result.success[0].submission_statistics as Json).unique_count).toBe(0);
		expect(result.success[0].question_statistics).toEqual([]);
		expect(result.success[1].question_statistics).toHaveLength(1);
		expect(result.success[1].submission_statistics).toMatchObject({ unique_count: 1, score_high: 3, score_low: 3 });
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({
			errorCode: 404,
			errorType: 'NOT_FOUND',
			resource: 'quizStatistics',
			operation: 'get',
		});
		await deleteQuiz(mainCourse, untaken.id);
		await deleteQuiz(mainCourse, taken.id);
	});

	it('errors: students may not read quiz statistics', async () => {
		const mainCourse = await quizCourse();
		const quiz = await createQuiz(mainCourse, { title: unique('Stats: forbidden') }, [MULTIPLE_CHOICE]);
		const result = await runNode({
			resource: 'quizStatistics',
			operation: 'get',
			persona: 'student',
			params: { courseId: mainCourse, quizId: quiz.id, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'quizStatistics', operation: 'get' });
		await deleteQuiz(mainCourse, quiz.id);
	});
});
