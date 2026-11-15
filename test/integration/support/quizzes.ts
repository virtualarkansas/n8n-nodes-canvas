import { canvas, CanvasClient, fx } from '../../lib/canvas';
import type { Json } from '../../lib/n8n';

/**
 * Shared setup for the classic-quiz test files (quiz, quizQuestion, quizQuestionGroup,
 * quizSubmission, quizReport, quizStatistics, quizExtension).
 *
 * The seed does not create quizzes, so these files work in courses of their own.
 * The courses are looked up by SIS ID and reused across runs; every test creates
 * (and removes) its own quizzes inside them.
 */

/**
 * Building the list fixtures for the first time takes a few hundred requests; on later
 * runs they are only looked up. Used as the timeout of the hooks that need them.
 */
export const FIXTURE_TIMEOUT = 900_000;

export const QUIZ_COURSE_SIS_ID = 'BATTERY-QUIZZES';
export const QUIZ_LIST_COURSE_SIS_ID = 'BATTERY-QUIZ-LIST';
/** Number of quizzes kept in the list course for pagination tests. */
export const QUIZ_LIST_SIZE = 57;

async function findCourse(sisId: string): Promise<string | undefined> {
	const res = await canvas().request('GET', `/api/v1/courses/sis_course_id:${sisId}`);
	if (res.status === 200 && (res.data as Json).workflow_state !== 'deleted') {
		return String((res.data as Json).id);
	}
	return undefined;
}

/** Find or create a published course with the teacher, student and student2 personas enrolled. */
export async function ensureCourse(sisId: string, name: string): Promise<string> {
	let id = await findCourse(sisId);
	if (!id) {
		const created = await canvas().request('POST', `/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name, course_code: sisId, sis_course_id: sisId },
			offer: true,
		});
		// Another test file may have created it in the meantime (files run in parallel).
		id = created.status < 300 ? String((created.data as Json).id) : await findCourse(sisId);
		if (!id) {
			throw new Error(`Could not create course ${sisId}: ${JSON.stringify(created.data).slice(0, 300)}`);
		}
	}
	const enrolled = await canvas().getAll<Json>(`/api/v1/courses/${id}/enrollments?state[]=active`);
	const have = new Set(enrolled.map((e) => `${String(e.user_id)}:${String(e.type)}`));
	const wanted: Array<[string, string]> = [
		[fx('teacherUserId'), 'TeacherEnrollment'],
		[fx('studentUserId'), 'StudentEnrollment'],
		[fx('student2UserId'), 'StudentEnrollment'],
	];
	for (const [userId, type] of wanted) {
		if (have.has(`${userId}:${type}`)) continue;
		await canvas().post(`/api/v1/courses/${id}/enrollments`, {
			enrollment: { user_id: userId, type, enrollment_state: 'active', notify: false },
		});
	}
	return id;
}

/** The course the classic-quiz files create their own quizzes in. */
export function quizCourse(): Promise<string> {
	return ensureCourse(QUIZ_COURSE_SIS_ID, 'Battery: classic quizzes');
}

/** A course holding a fixed, large set of quizzes that no test modifies (for list/pagination tests). */
export async function quizListCourse(): Promise<string> {
	const id = await ensureCourse(QUIZ_LIST_COURSE_SIS_ID, 'Battery: quiz list');
	const existing = await canvas().getAll<Json>(`/api/v1/courses/${id}/quizzes`);
	for (let i = existing.length; i < QUIZ_LIST_SIZE; i++) {
		const n = String(i + 1).padStart(2, '0');
		await canvas().post(`/api/v1/courses/${id}/quizzes`, {
			quiz: {
				// A third of the titles share a word so search_term has something to filter on.
				title: i % 3 === 0 ? `Pop quiz ${n} — Zellbiologie` : `Weekly check ${n}`,
				quiz_type: i % 4 === 0 ? 'practice_quiz' : 'assignment',
				// Every fifth quiz stays unpublished: students must not see those.
				published: i % 5 !== 0,
			},
		});
	}
	return id;
}

export interface QuestionSpec {
	question_name: string;
	question_text: string;
	question_type: string;
	points_possible?: number;
	answers?: Json[];
}

export const MULTIPLE_CHOICE: QuestionSpec = {
	question_name: 'Arithmetic',
	question_text: '<p>What is 2 + 2?</p>',
	question_type: 'multiple_choice_question',
	points_possible: 3,
	answers: [
		{ answer_text: '4', answer_weight: 100 },
		{ answer_text: '5', answer_weight: 0 },
	],
};

export const ESSAY: QuestionSpec = {
	question_name: 'Essay',
	question_text: '<p>Explain photosynthesis.</p>',
	question_type: 'essay_question',
	points_possible: 5,
};

/**
 * Create a quiz directly in Canvas, add questions and (by default) publish it afterwards,
 * so the published version contains the questions.
 */
export async function createQuiz(
	courseId: string,
	settings: Json,
	questions: QuestionSpec[] = [],
	publish = true,
): Promise<{ id: string; quiz: Json; questions: Json[] }> {
	const quiz = await canvas().post<Json>(`/api/v1/courses/${courseId}/quizzes`, {
		quiz: { quiz_type: 'assignment', ...settings, published: false },
	});
	const id = String(quiz.id);
	const created: Json[] = [];
	for (const question of questions) {
		created.push(await canvas().post<Json>(`/api/v1/courses/${courseId}/quizzes/${id}/questions`, { question }));
	}
	const final = publish
		? await canvas().put<Json>(`/api/v1/courses/${courseId}/quizzes/${id}`, { quiz: { published: true } })
		: quiz;
	return { id, quiz: final, questions: created };
}

export async function deleteQuiz(courseId: string, quizId: string): Promise<void> {
	await canvas().request('DELETE', `/api/v1/courses/${courseId}/quizzes/${quizId}`);
}

/** Start a quiz attempt directly in Canvas as a persona. */
export async function startAttempt(
	courseId: string,
	quizId: string,
	persona: string,
	accessCode?: string,
): Promise<Json> {
	const res = await new CanvasClient(persona).post<Json>(
		`/api/v1/courses/${courseId}/quizzes/${quizId}/submissions`,
		accessCode ? { access_code: accessCode } : {},
	);
	return (res.quiz_submissions as Json[])[0];
}

/**
 * Answer the questions of a running attempt directly in Canvas. `answers` maps the
 * question ID to the answer (the answer ID for multiple choice, text for essays).
 */
export async function answerQuestions(
	persona: string,
	quizSubmission: Json,
	answers: Record<string, unknown>,
	accessCode?: string,
): Promise<void> {
	await new CanvasClient(persona).post(`/api/v1/quiz_submissions/${String(quizSubmission.id)}/questions`, {
		attempt: quizSubmission.attempt,
		validation_token: quizSubmission.validation_token,
		...(accessCode ? { access_code: accessCode } : {}),
		quiz_questions: Object.entries(answers).map(([id, answer]) => ({ id, answer })),
	});
}

/** Turn an attempt in directly in Canvas. */
export async function completeAttempt(
	courseId: string,
	quizId: string,
	persona: string,
	quizSubmission: Json,
	accessCode?: string,
): Promise<Json> {
	const res = await new CanvasClient(persona).post<Json>(
		`/api/v1/courses/${courseId}/quizzes/${quizId}/submissions/${String(quizSubmission.id)}/complete`,
		{
			attempt: quizSubmission.attempt,
			validation_token: quizSubmission.validation_token,
			...(accessCode ? { access_code: accessCode } : {}),
		},
	);
	return (res.quiz_submissions as Json[])[0];
}

/** Take a whole attempt as a persona: start, answer the first choice / write an essay, turn in. */
export async function takeQuiz(courseId: string, quizId: string, persona: string): Promise<Json> {
	const attempt = await startAttempt(courseId, quizId, persona);
	const shown = await new CanvasClient(persona).get<Json>(
		`/api/v1/quiz_submissions/${String(attempt.id)}/questions`,
	);
	const answers: Record<string, unknown> = {};
	for (const question of shown.quiz_submission_questions as Json[]) {
		const choices = (question.answers as Json[] | undefined) ?? [];
		if (question.question_type === 'multiple_choice_question' && choices.length > 0) {
			answers[String(question.id)] = choices[0].id;
		} else if (question.question_type === 'essay_question') {
			answers[String(question.id)] = '<p>Light becomes sugar.</p>';
		}
	}
	if (Object.keys(answers).length > 0) {
		await answerQuestions(persona, attempt, answers);
	}
	return completeAttempt(courseId, quizId, persona, attempt);
}

const QUIZ_TAKER_LOGIN = 'battery.quiztaker';

/**
 * Users of this battery (not seeded personas) who exist only to take quizzes, so list
 * operations have more quiz submissions than one page holds. Created once, reused.
 */
export async function ensureQuizTakers(count: number): Promise<string[]> {
	const accountId = fx('accountId');
	const found = await canvas().getAll<Json>(
		`/api/v1/accounts/${accountId}/users?search_term=${encodeURIComponent(QUIZ_TAKER_LOGIN)}`,
	);
	const byLogin = new Map(found.map((u) => [String(u.login_id), String(u.id)]));
	const ids: string[] = [];
	for (let i = 1; i <= count; i++) {
		const n = String(i).padStart(2, '0');
		const login = `${QUIZ_TAKER_LOGIN}.${n}@example.edu`;
		let id = byLogin.get(login);
		if (!id) {
			const created = await canvas().post<Json>(`/api/v1/accounts/${accountId}/users`, {
				user: { name: `Quiz Taker ${n}`, skip_registration: true },
				pseudonym: { unique_id: login, send_confirmation: false },
			});
			id = String(created.id);
		}
		ids.push(id);
	}
	return ids;
}

/**
 * A published quiz in the list course that many students have submitted (list fixture
 * for quiz submissions, reports and statistics).
 */
export async function submissionMarathon(count = 23): Promise<{ courseId: string; quizId: string; takers: string[] }> {
	const title = 'Submission marathon (list fixture)';
	const courseId = await quizListCourse();
	const takers = await ensureQuizTakers(count);

	const enrolled = new Set(
		(
			await canvas().getAll<Json>(`/api/v1/courses/${courseId}/enrollments?type[]=StudentEnrollment&state[]=active`)
		).map((e) => String(e.user_id)),
	);
	for (const userId of takers) {
		if (enrolled.has(userId)) continue;
		await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: { user_id: userId, type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
		});
	}

	const quizzes = await canvas().getAll<Json>(
		`/api/v1/courses/${courseId}/quizzes?search_term=${encodeURIComponent(title)}`,
	);
	const existing = quizzes.find((q) => q.title === title);
	const quizId = existing
		? String(existing.id)
		: (await createQuiz(courseId, { title, allowed_attempts: 2, scoring_policy: 'keep_highest' }, [MULTIPLE_CHOICE, ESSAY])).id;

	const base = `/api/v1/courses/${courseId}/quizzes/${quizId}`;
	const submitted = new Set(
		(await canvas().getAll<Json>(`${base}/submissions`, 'quiz_submissions')).map((s) => String(s.user_id)),
	);
	for (const userId of takers) {
		if (submitted.has(userId)) continue;
		// The admin acts as the student (masquerading) to take the quiz.
		const started = await canvas().post<Json>(`${base}/submissions?as_user_id=${userId}`, {});
		const attempt = (started.quiz_submissions as Json[])[0];
		await canvas().post(`${base}/submissions/${String(attempt.id)}/complete?as_user_id=${userId}`, {
			attempt: attempt.attempt,
			validation_token: attempt.validation_token,
		});
	}
	return { courseId, quizId, takers };
}

/**
 * Some operations answer with `{ "<key>": [record] }`. Whether the node hands that
 * wrapper on or unwraps it, the record is what the tests look at.
 */
export function unwrap(item: Json, key: string): Json {
	const wrapped = item[key];
	return Array.isArray(wrapped) ? (wrapped[0] as Json) : item;
}

/** Poll until `probe` returns a value (Canvas does some work in background jobs). */
export async function waitFor<T>(
	probe: () => Promise<T | undefined | null | false>,
	what: string,
	timeoutMs = 60_000,
): Promise<T> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const value = await probe();
		if (value) return value;
		if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
		await new Promise((r) => setTimeout(r, 1000));
	}
}
