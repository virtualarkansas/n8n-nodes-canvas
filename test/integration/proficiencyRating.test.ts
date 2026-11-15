import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createSandboxAccount, createSandboxCourse, deleteSandboxAccount, deleteSandboxCourse } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: proficiencyRating (mastery scales). Ratings are only ever set on a
 * sub-account and a course created by this file; the root account's ratings
 * are read and must come out unchanged.
 */
describe('proficiencyRating', () => {
	let accountId = '';
	let course: SandboxCourse;
	let courseId = '';
	let rootRatings: Json[] = [];

	const ratingsOf = async (path: string): Promise<Json[]> => (await canvas().get<Json>(`${path}/outcome_proficiency`)).ratings as Json[];

	const accountScale = [
		{ description: 'Exceeds ✨ "expectations" & more', points: 10, mastery: false, color: '#00AA11' },
		{ description: 'Meets', points: 7.5, mastery: true, color: '#0b874b' },
		{ description: 'Approaching', points: 4, mastery: false, color: 'FAB901' },
		{ description: 'Not yet 还没有', points: 0, mastery: false, color: '#E0061F' },
	];

	beforeAll(async () => {
		accountId = await createSandboxAccount('proficiency');
		course = await createSandboxCourse('proficiency', { accountId, personas: ['teacher', 'student'] });
		courseId = course.id;
		rootRatings = await ratingsOf(`/api/v1/accounts/${fx('accountId')}`);
	});

	afterAll(async () => {
		await deleteSandboxCourse(course);
		await deleteSandboxAccount(accountId);
	});

	it('get: an account or course without ratings of its own shows the ones it inherits', async () => {
		const [fromAccount] = await runOk({ resource: 'proficiencyRating', operation: 'get', params: { context: 'account', accountId } });
		expect(fromAccount.ratings).toEqual(rootRatings);
		expect((fromAccount.ratings as Json[]).filter((r) => r.mastery === true)).toHaveLength(1);

		const [fromCourse] = await runOk({
			resource: 'proficiencyRating',
			operation: 'get',
			persona: 'teacher',
			params: { context: 'course', courseId: `sis_course_id:${course.sisId}` },
		});
		expect(fromCourse.ratings).toEqual(rootRatings);
	});

	it('set: account context, with colors as the color picker delivers them', async () => {
		const [result] = await runOk({
			resource: 'proficiencyRating',
			operation: 'set',
			params: { context: 'account', accountId, ratings: { rating: accountScale } },
		});
		const expected = [
			{ description: 'Exceeds ✨ "expectations" & more', points: 10, mastery: false, color: '00AA11' },
			{ description: 'Meets', points: 7.5, mastery: true, color: '0b874b' },
			{ description: 'Approaching', points: 4, mastery: false, color: 'FAB901' },
			{ description: 'Not yet 还没有', points: 0, mastery: false, color: 'E0061F' },
		];
		expect(result.ratings).toEqual(expected);
		expect(await ratingsOf(`/api/v1/accounts/${accountId}`)).toEqual(expected);
		// The course of the account now inherits these.
		expect(await ratingsOf(`/api/v1/courses/${courseId}`)).toEqual(expected);
	});

	it('set: course context replaces the ratings of the course only', async () => {
		const [result] = await runOk({
			resource: 'proficiencyRating',
			operation: 'set',
			items: [{ top: 3 }],
			params: {
				context: 'course',
				courseId: Number(courseId),
				ratings: {
					rating: [
						{ description: 'Yes', points: '={{ $json.top }}', mastery: true, color: '#127A1B' },
						{ description: 'No', points: 0, mastery: false, color: '#FD5D10' },
					],
				},
			},
		});
		const expected = [
			{ description: 'Yes', points: 3, mastery: true, color: '127A1B' },
			{ description: 'No', points: 0, mastery: false, color: 'FD5D10' },
		];
		expect(result.ratings).toEqual(expected);
		expect(await ratingsOf(`/api/v1/courses/${courseId}`)).toEqual(expected);
		expect(await ratingsOf(`/api/v1/accounts/${accountId}`)).toHaveLength(4);

		const [read] = await runOk({ resource: 'proficiencyRating', operation: 'get', persona: 'student', params: { context: 'course', courseId } });
		expect(read.ratings).toEqual(expected);
	});

	it('set: a second call replaces all ratings', async () => {
		await runOk({
			resource: 'proficiencyRating',
			operation: 'set',
			params: {
				context: 'course',
				courseId,
				ratings: {
					rating: [
						{ description: 'A', points: 5, mastery: false, color: '#111111' },
						{ description: 'B', points: 3, mastery: true, color: '#222222' },
						{ description: 'C', points: 1, mastery: false, color: '#333333' },
					],
				},
			},
		});
		expect((await ratingsOf(`/api/v1/courses/${courseId}`)).map((r) => [r.description, r.points, r.mastery, r.color])).toEqual([
			['A', 5, false, '111111'],
			['B', 3, true, '222222'],
			['C', 1, false, '333333'],
		]);
	});

	it('set: Canvas rejects scales without exactly one mastery level, unordered points and invalid colors', async () => {
		const before = await ratingsOf(`/api/v1/courses/${courseId}`);
		const invalid: Json[][] = [
			// two mastery levels
			[
				{ description: 'A', points: 2, mastery: true, color: '#111111' },
				{ description: 'B', points: 1, mastery: true, color: '#222222' },
			],
			// no mastery level
			[
				{ description: 'A', points: 2, mastery: false, color: '#111111' },
				{ description: 'B', points: 1, mastery: false, color: '#222222' },
			],
			// points not strictly decreasing
			[
				{ description: 'A', points: 1, mastery: true, color: '#111111' },
				{ description: 'B', points: 2, mastery: false, color: '#222222' },
			],
			// not a hex color
			[
				{ description: 'A', points: 2, mastery: true, color: 'green' },
				{ description: 'B', points: 1, mastery: false, color: '#222222' },
			],
		];
		for (const rating of invalid) {
			const result = await runNode({
				resource: 'proficiencyRating',
				operation: 'set',
				params: { context: 'course', courseId, ratings: { rating }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, JSON.stringify(rating)).toEqual([]);
			expect(result.error).toHaveLength(1);
			expect(result.error[0]).toMatchObject({ errorType: 'VALIDATION_ERROR', resource: 'proficiencyRating', operation: 'set' });
			expect([400, 422]).toContain(result.error[0].errorCode);
		}
		expect(await ratingsOf(`/api/v1/courses/${courseId}`)).toEqual(before);
	});

	it('set: at least one rating is required', async () => {
		const result = await runNode({
			resource: 'proficiencyRating',
			operation: 'set',
			params: { context: 'course', courseId, ratings: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(String(result.error[0].errorMessage)).toMatch(/at least one rating/i);
	});

	it('errors: setting ratings needs the "manage proficiency scales" permission, which teachers do not have by default', async () => {
		for (const [persona, params] of [
			['teacher', { context: 'account', accountId }],
			['teacher', { context: 'course', courseId }],
			['student', { context: 'course', courseId }],
		] as const) {
			const result = await runNode({
				resource: 'proficiencyRating',
				operation: 'set',
				persona,
				params: { ...params, ratings: { rating: accountScale }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect([401, 403]).toContain(result.error[0].errorCode);
			expect(result.error[0]).toMatchObject({ resource: 'proficiencyRating', operation: 'set' });
		}

		const missing = await runNode({
			resource: 'proficiencyRating',
			operation: 'get',
			params: { context: 'course', courseId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('the ratings of the root account are untouched', async () => {
		expect(await ratingsOf(`/api/v1/accounts/${fx('accountId')}`)).toEqual(rootRatings);
	});
});
