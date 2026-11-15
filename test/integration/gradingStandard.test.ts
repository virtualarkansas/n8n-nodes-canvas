import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createSandboxCourse, deleteSandboxCourse } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: gradingStandard (grading schemes). Course-level schemes live in a
 * course of this file's own; account-level ones are created here and deleted again.
 */
describe('gradingStandard', () => {
	const accountId = fx('accountId');
	let course: SandboxCourse;
	let courseId = '';
	let courseStandardId = '';
	let accountStandardId = '';
	const ownAccountStandardIds: string[] = [];
	const title = unique('Schéma "quoted" & <b>tags</b> 成绩 🎓');

	const letterScheme = {
		gradeEntry: [
			{ name: 'A', value: 90 },
			{ name: 'B', value: 80 },
			{ name: 'C', value: 70 },
			{ name: 'F', value: 0 },
		],
	};

	const courseStandards = (): Promise<Json[]> => canvas().get<Json[]>(`/api/v1/courses/${courseId}/grading_standards`);
	const accountStandards = (): Promise<Json[]> => canvas().get<Json[]>(`/api/v1/accounts/${accountId}/grading_standards`);
	const scheme = (standard: Json): Array<[string, number]> =>
		(standard.grading_scheme as Json[]).map((entry) => [String(entry.name), Number(entry.value)]);

	beforeAll(async () => {
		course = await createSandboxCourse('standards', { students: 2, personas: ['teacher', 'student'] });
		courseId = course.id;
	});

	afterAll(async () => {
		await deleteSandboxCourse(course);
		for (const id of ownAccountStandardIds) {
			await canvas().request('DELETE', `/api/v1/accounts/${accountId}/grading_standards/${id}`);
		}
	});

	it('create: course context, points based with every optional field', async () => {
		const [created] = await runOk({
			resource: 'gradingStandard',
			operation: 'create',
			params: {
				context: 'course',
				courseId,
				title,
				gradingScheme: {
					gradeEntry: [
						{ name: 'Exceeds ✨', value: 3.5 },
						{ name: 'Meets', value: 2.5 },
						{ name: 'Approaching "almost"', value: 1 },
						{ name: 'Not yet', value: 0 },
					],
				},
				additionalFields: { points_based: true, scaling_factor: 4 },
			},
		});
		courseStandardId = String(created.id);
		expect(created).toMatchObject({ title, context_type: 'Course', context_id: Number(courseId), points_based: true, scaling_factor: 4 });

		const actual = await canvas().get<Json>(`/api/v1/courses/${courseId}/grading_standards/${courseStandardId}`);
		expect(actual).toMatchObject({ title, points_based: true, scaling_factor: 4 });
		expect(scheme(actual)).toEqual([
			['Exceeds ✨', 0.875],
			['Meets', 0.625],
			['Approaching "almost"', 0.25],
			['Not yet', 0],
		]);
		expect((actual.grading_scheme as Json[]).map((e) => e.calculated_value)).toEqual([3.5, 2.5, 1, 0]);
	});

	it('create: account context, percentages; entries are stored sorted from highest to lowest', async () => {
		const accountTitle = unique('Battery account scheme');
		const [created] = await runOk({
			resource: 'gradingStandard',
			operation: 'create',
			params: {
				context: 'account',
				accountId,
				title: accountTitle,
				gradingScheme: {
					gradeEntry: [
						{ name: 'F', value: 0 },
						{ name: 'Très bien', value: 93.5 },
						{ name: 'Passable', value: 60 },
					],
				},
			},
		});
		accountStandardId = String(created.id);
		ownAccountStandardIds.push(accountStandardId);
		expect(created).toMatchObject({ title: accountTitle, context_type: 'Account', context_id: Number(accountId), points_based: false, scaling_factor: 1 });

		const actual = (await accountStandards()).find((s) => String(s.id) === accountStandardId) as Json;
		expect(scheme(actual)).toEqual([
			['Très bien', 0.935],
			['Passable', 0.6],
			['F', 0],
		]);
	});

	it('create: one scheme per input item', async () => {
		const titles = Array.from({ length: 11 }, (_, i) => unique(`Scheme ${i + 1}`));
		const result = await runNode({
			resource: 'gradingStandard',
			operation: 'create',
			persona: 'teacher',
			items: titles.map((t, i) => ({ title: t, course: Number(courseId), pass: 50 + i })),
			params: {
				courseId: '={{ $json.course }}',
				title: '={{ $json.title }}',
				gradingScheme: { gradeEntry: [{ name: 'Pass', value: '={{ $json.pass }}' }, { name: 'Fail', value: 0 }] },
			},
		});
		expect(result.error).toEqual([]);
		expect(result.success.map((s) => s.title)).toEqual(titles);
		expect(scheme(result.success[10])).toEqual([
			['Pass', 0.6],
			['Fail', 0],
		]);
	});

	it('create: Canvas\' validation messages reach the Error output', async () => {
		const noZero = await runNode({
			resource: 'gradingStandard',
			operation: 'create',
			params: {
				courseId,
				title: unique('No zero'),
				gradingScheme: { gradeEntry: [{ name: 'A', value: 90 }, { name: 'F', value: 50 }] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(noZero.success).toEqual([]);
		expect(noZero.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'gradingStandard', operation: 'create' });
		expect(String(noZero.error[0].errorMessage)).toContain('grading schemes must have 0% for the lowest grade');

		const scaled = await runNode({
			resource: 'gradingStandard',
			operation: 'create',
			params: {
				courseId,
				title: unique('Scaled percentages'),
				gradingScheme: letterScheme,
				additionalFields: { scaling_factor: 4 },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(scaled.success).toEqual([]);
		expect(scaled.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(JSON.stringify(scaled.error[0].canvasErrors)).toContain('scaling_factor');

		const empty = await runNode({
			resource: 'gradingStandard',
			operation: 'create',
			params: { courseId, title: unique('No entries'), gradingScheme: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(String(empty.error[0].errorMessage)).toMatch(/at least one grade entry/i);
	});

	it('get: course and account context', async () => {
		const [fromCourse] = await runOk({
			resource: 'gradingStandard',
			operation: 'get',
			params: { context: 'course', courseId: `sis_course_id:${course.sisId}`, gradingStandardId: Number(courseStandardId) },
		});
		expect(fromCourse).toMatchObject({ id: Number(courseStandardId), title, points_based: true });

		const [fromAccount] = await runOk({
			resource: 'gradingStandard',
			operation: 'get',
			params: { context: 'account', accountId, gradingStandardId: accountStandardId },
		});
		expect(fromAccount).toMatchObject({ id: Number(accountStandardId), context_type: 'Account' });
		expect(scheme(fromAccount)[0]).toEqual(['Très bien', 0.935]);
	});

	it('get: a scheme is only found in the context that owns it', async () => {
		const result = await runNode({
			resource: 'gradingStandard',
			operation: 'get',
			items: [{ id: courseStandardId }, { id: accountStandardId }, { id: 99999999 }],
			params: { context: 'course', courseId, gradingStandardId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((s) => s.id)).toEqual([Number(courseStandardId)]);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'gradingStandard', operation: 'get' });
		}
	});

	it('getAll: course context returns every scheme of the course (Canvas does not page this list)', async () => {
		const expected = await courseStandards();
		expect(expected.length).toBeGreaterThan(10);

		const defaults = await runOk({ resource: 'gradingStandard', operation: 'getAll', params: { context: 'course', courseId } });
		expect(defaults.map((s) => s.id).sort()).toEqual(expected.map((s) => s.id).sort());
		expect(new Set(defaults.map((s) => s.id)).size).toBe(defaults.length);

		// Canvas ignores per_page here and returns everything in one response.
		const small = await runOk({
			resource: 'gradingStandard',
			operation: 'getAll',
			params: { courseId, pagination: { perPage: 3, maxPages: 1 } },
		});
		expect(small).toHaveLength(expected.length);
	});

	it('getAll: account context lists the account\'s own schemes; a course lists none of them', async () => {
		const expected = await accountStandards();
		const listed = await runOk({
			resource: 'gradingStandard',
			operation: 'getAll',
			params: { context: 'account', accountId, pagination: { returnAll: true } },
		});
		expect(listed.map((s) => s.id).sort()).toEqual(expected.map((s) => s.id).sort());
		expect(listed.map((s) => s.id)).toContain(Number(fx('accountGradingStandardId')));
		expect(listed.map((s) => s.id)).toContain(Number(accountStandardId));
		for (const standard of listed) expect(standard.context_type).toBe('Account');

		expect((await courseStandards()).map((s) => s.id)).not.toContain(Number(accountStandardId));
	});

	it('getAll: a course without schemes yields no items', async () => {
		const empty = await createSandboxCourse('no-standards');
		try {
			const result = await runNode({ resource: 'gradingStandard', operation: 'getAll', params: { courseId: empty.id } });
			expect(result.ok).toBe(true);
			expect(result.success).toEqual([]);
			expect(result.error).toEqual([]);
		} finally {
			await deleteSandboxCourse(empty);
		}
	});

	it('update: the title alone leaves the scheme untouched', async () => {
		const renamed = `${title} (renamed)`;
		const [updated] = await runOk({
			resource: 'gradingStandard',
			operation: 'update',
			params: { context: 'course', courseId, gradingStandardId: courseStandardId, updateFields: { title: renamed } },
		});
		expect(updated).toMatchObject({ id: Number(courseStandardId), title: renamed });
		const actual = await canvas().get<Json>(`/api/v1/courses/${courseId}/grading_standards/${courseStandardId}`);
		expect(actual).toMatchObject({ title: renamed, points_based: true, scaling_factor: 4 });
		expect(scheme(actual)).toHaveLength(4);
	});

	it('update: every field, replacing the grades of the scheme', async () => {
		await runOk({
			resource: 'gradingStandard',
			operation: 'update',
			params: {
				context: 'course',
				courseId,
				gradingStandardId: courseStandardId,
				updateFields: { title: `${title} (v3)`, points_based: true, scaling_factor: 10 },
				gradingScheme: { gradeEntry: [{ name: 'Pass', value: 6 }, { name: 'Fail', value: 0 }] },
			},
		});
		const actual = await canvas().get<Json>(`/api/v1/courses/${courseId}/grading_standards/${courseStandardId}`);
		expect(actual).toMatchObject({ title: `${title} (v3)`, points_based: true, scaling_factor: 10 });
		expect(scheme(actual)).toEqual([
			['Pass', 0.6],
			['Fail', 0],
		]);
	});

	it('update: account context, back to percentages', async () => {
		await runOk({
			resource: 'gradingStandard',
			operation: 'update',
			params: {
				context: 'account',
				accountId,
				gradingStandardId: accountStandardId,
				updateFields: { points_based: false, scaling_factor: 1 },
				gradingScheme: letterScheme,
			},
		});
		const actual = await canvas().get<Json>(`/api/v1/accounts/${accountId}/grading_standards/${accountStandardId}`);
		expect(actual).toMatchObject({ points_based: false, scaling_factor: 1 });
		expect(scheme(actual)).toEqual([
			['A', 0.9],
			['B', 0.8],
			['C', 0.7],
			['F', 0],
		]);
	});

	it('update: changing "Points Based" without sending the grades is refused (Canvas rebuilds the scheme)', async () => {
		const result = await runNode({
			resource: 'gradingStandard',
			operation: 'update',
			params: {
				context: 'course',
				courseId,
				gradingStandardId: courseStandardId,
				updateFields: { points_based: false, scaling_factor: 1 },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'update' });
		expect(JSON.stringify(result.error[0].canvasErrors)).toContain('data');
		expect(scheme(await canvas().get<Json>(`/api/v1/courses/${courseId}/grading_standards/${courseStandardId}`))).toHaveLength(2);
	});

	it('update: once a scheme has been used for grading only its title can change', async () => {
		const used = await canvas().post<Json>(`/api/v1/courses/${courseId}/grading_standards`, {
			title: unique('Used scheme'),
			grading_scheme_entry: [{ name: 'A', value: 90 }, { name: 'F', value: 0 }],
		});
		const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: {
				name: unique('Letter graded'),
				points_possible: 100,
				grading_type: 'letter_grade',
				grading_standard_id: used.id,
				submission_types: ['none'],
				published: true,
			},
		});
		await canvas().put(`/api/v1/courses/${courseId}/assignments/${String(assignment.id)}/submissions/${course.studentIds[0]}`, {
			submission: { posted_grade: '95' },
		});

		const refused = await runNode({
			resource: 'gradingStandard',
			operation: 'update',
			params: {
				courseId,
				gradingStandardId: String(used.id),
				gradingScheme: { gradeEntry: [{ name: 'Pass', value: 50 }, { name: 'Fail', value: 0 }] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(JSON.stringify(refused.error[0].canvasErrors)).toContain('base');

		const [renamed] = await runOk({
			resource: 'gradingStandard',
			operation: 'update',
			params: { courseId, gradingStandardId: String(used.id), updateFields: { title: 'Used scheme (renamed)' } },
		});
		expect(renamed).toMatchObject({ title: 'Used scheme (renamed)' });
		expect(scheme(renamed)).toEqual([
			['A', 0.9],
			['F', 0],
		]);
	});

	it('delete: course and account context', async () => {
		const [fromCourse] = await runOk({
			resource: 'gradingStandard',
			operation: 'delete',
			params: { context: 'course', courseId, gradingStandardId: courseStandardId },
		});
		expect(fromCourse).toMatchObject({ id: Number(courseStandardId) });
		expect((await courseStandards()).map((s) => String(s.id))).not.toContain(courseStandardId);

		const [fromAccount] = await runOk({
			resource: 'gradingStandard',
			operation: 'delete',
			params: { context: 'account', accountId, gradingStandardId: Number(accountStandardId) },
		});
		expect(fromAccount).toMatchObject({ id: Number(accountStandardId) });
		expect((await accountStandards()).map((s) => String(s.id))).not.toContain(accountStandardId);
	});

	it('errors: a deleted scheme is "not found"', async () => {
		for (const operation of ['get', 'update', 'delete']) {
			const result = await runNode({
				resource: 'gradingStandard',
				operation,
				params: {
					courseId,
					gradingStandardId: courseStandardId,
					updateFields: { title: 'gone' },
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'gradingStandard', operation });
		}
	});

	it('errors: a student may read the schemes of the course but not create one; a teacher may not create account schemes', async () => {
		const read = await runOk({ resource: 'gradingStandard', operation: 'getAll', persona: 'student', params: { courseId } });
		expect(read.length).toBeGreaterThan(10);

		const student = await runNode({
			resource: 'gradingStandard',
			operation: 'create',
			persona: 'student',
			params: { courseId, title: unique('Forbidden'), gradingScheme: letterScheme, errorHandling: { onError: 'continueWithError' } },
		});
		expect(student.success).toEqual([]);
		expect([401, 403]).toContain(student.error[0].errorCode);

		const teacher = await runNode({
			resource: 'gradingStandard',
			operation: 'create',
			persona: 'teacher',
			params: { context: 'account', accountId, title: unique('Forbidden'), gradingScheme: letterScheme, errorHandling: { onError: 'continueWithError' } },
		});
		expect(teacher.success).toEqual([]);
		expect([401, 403]).toContain(teacher.error[0].errorCode);
	});
});
