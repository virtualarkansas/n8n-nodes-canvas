import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { actingAs, createSandboxCourse, deleteSandboxCourse, unwrap } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: latePolicy. A course has at most one late policy and it cannot be
 * deleted, so every scenario runs in courses created by this file.
 */
describe('latePolicy', () => {
	let course: SandboxCourse;
	let bare: SandboxCourse;
	let courseId = '';

	const policyOf = async (id: string): Promise<Json> =>
		(await canvas().get<Json>(`/api/v1/courses/${id}/late_policy`)).late_policy as Json;

	beforeAll(async () => {
		course = await createSandboxCourse('late-policy', { students: 2, personas: ['teacher', 'student'] });
		bare = await createSandboxCourse('late-policy-defaults', { personas: ['teacher'] });
		courseId = course.id;
	});

	afterAll(async () => {
		await deleteSandboxCourse(course);
		await deleteSandboxCourse(bare);
	});

	it('get: a course without a late policy is "not found"', async () => {
		const result = await runNode({
			resource: 'latePolicy',
			operation: 'get',
			params: { courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'latePolicy', operation: 'get' });
	});

	it('create: every optional field reaches Canvas', async () => {
		const [output] = await runOk({
			resource: 'latePolicy',
			operation: 'create',
			params: {
				courseId,
				additionalFields: {
					late_submission_deduction: 12.5,
					late_submission_deduction_enabled: true,
					late_submission_interval: 'hour',
					late_submission_minimum_percent: 40,
					late_submission_minimum_percent_enabled: true,
					missing_submission_deduction: 75,
					missing_submission_deduction_enabled: true,
				},
			},
		});
		const expected = {
			late_submission_deduction: 12.5,
			late_submission_deduction_enabled: true,
			late_submission_interval: 'hour',
			late_submission_minimum_percent: 40,
			late_submission_minimum_percent_enabled: true,
			missing_submission_deduction: 75,
			missing_submission_deduction_enabled: true,
		};
		expect(unwrap(output, 'late_policy')).toMatchObject(expected);
		expect(await policyOf(courseId)).toMatchObject(expected);
	});

	it('create: a second policy for the same course is refused with Canvas\' explanation', async () => {
		const result = await runNode({
			resource: 'latePolicy',
			operation: 'create',
			params: { courseId, additionalFields: { missing_submission_deduction: 10 }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'latePolicy', operation: 'create' });
		expect(String(result.error[0].errorMessage)).toContain('only one late policy per course is allowed');
		expect((await policyOf(courseId)).missing_submission_deduction).toBe(75);
	});

	it('create: without any field creates Canvas\' default policy (everything switched off), as a teacher', async () => {
		const [output] = await runOk({ resource: 'latePolicy', operation: 'create', persona: 'teacher', params: { courseId: `sis_course_id:${bare.sisId}` } });
		const defaults = {
			late_submission_deduction: 0,
			late_submission_deduction_enabled: false,
			late_submission_interval: 'day',
			late_submission_minimum_percent: 0,
			late_submission_minimum_percent_enabled: false,
			missing_submission_deduction: 100,
			missing_submission_deduction_enabled: false,
		};
		expect(unwrap(output, 'late_policy')).toMatchObject(defaults);
		expect(await policyOf(bare.id)).toMatchObject(defaults);
	});

	it('get: returns the late policy of a course, as a teacher', async () => {
		const [output] = await runOk({ resource: 'latePolicy', operation: 'get', persona: 'teacher', params: { courseId: `sis_course_id:${course.sisId}` } });
		expect(unwrap(output, 'late_policy')).toMatchObject({
			id: (await policyOf(courseId)).id,
			late_submission_deduction: 12.5,
			late_submission_interval: 'hour',
			missing_submission_deduction: 75,
			missing_submission_deduction_enabled: true,
		});
	});

	it('get: returns the policy, for several courses with a mix of found and missing', async () => {
		const result = await runNode({
			resource: 'latePolicy',
			operation: 'get',
			items: [{ course: Number(courseId) }, { course: 99999999 }, { course: bare.id }],
			params: { courseId: '={{ $json.course }}', errorHandling: { onError: 'continueWithError' } },
		});
		const policies = result.success.map((item) => unwrap(item, 'late_policy'));
		expect(policies.map((p) => p.id)).toEqual([(await policyOf(courseId)).id, (await policyOf(bare.id)).id]);
		expect(policies[0]).toMatchObject({ late_submission_interval: 'hour', late_submission_deduction: 12.5 });
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', originalItem: { course: 99999999 } });
	});

	it('update: every optional field reaches Canvas', async () => {
		const [result] = await runOk({
			resource: 'latePolicy',
			operation: 'update',
			params: {
				courseId,
				updateFields: {
					late_submission_deduction: 10,
					late_submission_deduction_enabled: true,
					late_submission_interval: 'day',
					late_submission_minimum_percent: 50,
					late_submission_minimum_percent_enabled: false,
					missing_submission_deduction: 100,
					missing_submission_deduction_enabled: false,
				},
			},
		});
		// Canvas answers 204 No Content; the node returns the policy as it is afterwards.
		expect(result).toMatchObject({
			late_submission_deduction: 10,
			late_submission_deduction_enabled: true,
			late_submission_interval: 'day',
			late_submission_minimum_percent: 50,
			late_submission_minimum_percent_enabled: false,
			missing_submission_deduction: 100,
			missing_submission_deduction_enabled: false,
		});
		expect(await policyOf(courseId)).toMatchObject({
			late_submission_deduction: 10,
			late_submission_deduction_enabled: true,
			late_submission_interval: 'day',
			late_submission_minimum_percent: 50,
			late_submission_minimum_percent_enabled: false,
			missing_submission_deduction: 100,
			missing_submission_deduction_enabled: false,
		});
	});

	it('update: a single field changes only that field', async () => {
		await runOk({
			resource: 'latePolicy',
			operation: 'update',
			persona: 'teacher',
			params: { courseId: Number(courseId), updateFields: { late_submission_minimum_percent_enabled: true } },
		});
		expect(await policyOf(courseId)).toMatchObject({
			late_submission_deduction: 10,
			late_submission_interval: 'day',
			late_submission_minimum_percent: 50,
			late_submission_minimum_percent_enabled: true,
		});
	});

	it('the policy the node configured really deducts points from a late submission', async () => {
		const [student] = course.studentIds;
		const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: {
				name: unique('Due in the past'),
				points_possible: 20,
				submission_types: ['online_text_entry'],
				due_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
				published: true,
			},
		});
		const path = `/api/v1/courses/${courseId}/assignments/${String(assignment.id)}/submissions`;
		await actingAs(student).post(path, { submission: { submission_type: 'online_text_entry', body: '<p>Late work</p>' } });
		await canvas().put(`${path}/${student}`, { submission: { posted_grade: '20' } });

		const graded = await canvas().get<Json>(`${path}/${student}`);
		// 36 hours late = 2 started days at 10% each: 4 of 20 points.
		expect(graded).toMatchObject({ late: true, points_deducted: 4, score: 16, entered_score: 20 });
	});

	it('update: values Canvas does not accept are validation errors', async () => {
		const tooMuch = await runNode({
			resource: 'latePolicy',
			operation: 'update',
			params: { courseId, updateFields: { late_submission_deduction: 150 }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(tooMuch.success).toEqual([]);
		expect(tooMuch.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', resource: 'latePolicy', operation: 'update' });
		expect(JSON.stringify(tooMuch.error[0].canvasErrors)).toContain('late_submission_deduction');

		const interval = await runNode({
			resource: 'latePolicy',
			operation: 'update',
			items: [{ interval: 'week' }],
			params: { courseId, updateFields: { late_submission_interval: '={{ $json.interval }}' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(interval.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR' });
		expect(JSON.stringify(interval.error[0].canvasErrors)).toContain('late_submission_interval');

		expect(await policyOf(courseId)).toMatchObject({ late_submission_deduction: 10, late_submission_interval: 'day' });
	});

	it('update: without fields Canvas refuses the request', async () => {
		const result = await runNode({
			resource: 'latePolicy',
			operation: 'update',
			params: { courseId, updateFields: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'update' });
	});

	it('update: a course without a late policy is "not found"', async () => {
		const empty = await createSandboxCourse('late-policy-none');
		try {
			const result = await runNode({
				resource: 'latePolicy',
				operation: 'update',
				params: { courseId: empty.id, updateFields: { missing_submission_deduction: 10 }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'update' });
		} finally {
			await deleteSandboxCourse(empty);
		}
	});

	it('errors: a student may neither read nor change the late policy', async () => {
		for (const operation of ['get', 'update', 'create']) {
			const result = await runNode({
				resource: 'latePolicy',
				operation,
				persona: 'student',
				params: {
					courseId,
					updateFields: { missing_submission_deduction: 1 },
					additionalFields: { missing_submission_deduction: 1 },
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success).toEqual([]);
			expect([401, 403]).toContain(result.error[0].errorCode);
			expect(result.error[0]).toMatchObject({ resource: 'latePolicy', operation });
		}
		expect((await policyOf(courseId)).missing_submission_deduction).toBe(100);
	});
});
