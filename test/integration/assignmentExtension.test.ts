import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { ensureAssignmentsBattery } from './contentBattery';
import type { AssignmentsBattery } from './contentBattery';

/**
 * Resource: assignmentExtension (extra submission attempts per student).
 */
describe('assignmentExtension', () => {
	let battery: AssignmentsBattery;
	let courseId = '';
	let assignmentId = '';
	let secondAssignmentId = '';

	const extraAttempts = async (assignment: string, userId: string): Promise<unknown> =>
		(await canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${assignment}/submissions/${userId}`)).extra_attempts;

	beforeAll(async () => {
		battery = await ensureAssignmentsBattery();
		courseId = battery.courseId;
		const make = async (): Promise<string> =>
			String(
				(
					await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
						assignment: {
							name: unique('Extension assignment'),
							submission_types: ['online_text_entry'],
							allowed_attempts: 1,
							points_possible: 10,
							published: true,
						},
					})
				).id,
			);
		assignmentId = await make();
		secondAssignmentId = await make();
	}, 900_000);

	afterAll(async () => {
		for (const id of [assignmentId, secondAssignmentId]) {
			await canvas().request('DELETE', `/api/v1/courses/${courseId}/assignments/${id}`);
		}
	});

	it('setExtensions: grants extra attempts to several students in one call', async () => {
		const [result] = await runOk({
			resource: 'assignmentExtension',
			operation: 'setExtensions',
			params: {
				courseId,
				assignmentId,
				extensions: {
					extensionValues: [
						{ user_id: fx('studentUserId'), extra_attempts: 2 },
						{ user_id: ` ${fx('student2UserId')} `, extra_attempts: 5 },
					],
				},
			},
		});
		const granted = result.assignment_extensions as Json[];
		expect(granted).toHaveLength(2);
		expect(granted).toEqual(
			expect.arrayContaining([
				{ user_id: Number(fx('studentUserId')), extra_attempts: 2 },
				{ user_id: Number(fx('student2UserId')), extra_attempts: 5 },
			]),
		);
		expect(await extraAttempts(assignmentId, fx('studentUserId'))).toBe(2);
		expect(await extraAttempts(assignmentId, fx('student2UserId'))).toBe(5);
	});

	it('setExtensions: replaces an earlier extension; zero removes it', async () => {
		await runOk({
			resource: 'assignmentExtension',
			operation: 'setExtensions',
			params: {
				courseId,
				assignmentId,
				extensions: {
					extensionValues: [
						{ user_id: fx('studentUserId'), extra_attempts: 7 },
						{ user_id: fx('student2UserId'), extra_attempts: 0 },
					],
				},
			},
		});
		expect(await extraAttempts(assignmentId, fx('studentUserId'))).toBe(7);
		expect(await extraAttempts(assignmentId, fx('student2UserId'))).toBe(0);
	});

	it('setExtensions: values from expressions, one call per input item', async () => {
		const result = await runNode({
			resource: 'assignmentExtension',
			operation: 'setExtensions',
			items: [
				{ assignment: Number(assignmentId), user: Number(fx('studentUserId')), attempts: 1 },
				{ assignment: Number(secondAssignmentId), user: Number(fx('student2UserId')), attempts: 3 },
			],
			params: {
				courseId,
				assignmentId: '={{ $json.assignment }}',
				extensions: { extensionValues: [{ user_id: '={{ $json.user }}', extra_attempts: '={{ $json.attempts }}' }] },
			},
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		expect(result.success).toHaveLength(2);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
		expect(await extraAttempts(assignmentId, fx('studentUserId'))).toBe(1);
		expect(await extraAttempts(secondAssignmentId, fx('student2UserId'))).toBe(3);
	});

	it('setExtensions: users who are not students of the course are skipped by Canvas', async () => {
		const [result] = await runOk({
			resource: 'assignmentExtension',
			operation: 'setExtensions',
			params: {
				courseId,
				assignmentId,
				extensions: {
					extensionValues: [
						{ user_id: battery.teacherIds[0], extra_attempts: 4 },
						{ user_id: fx('student2UserId'), extra_attempts: 4 },
					],
				},
			},
		});
		expect(result.assignment_extensions).toEqual([{ user_id: Number(fx('student2UserId')), extra_attempts: 4 }]);
	});

	it('errors: negative attempts are refused with the reason per student', async () => {
		const result = await runNode({
			resource: 'assignmentExtension',
			operation: 'setExtensions',
			params: {
				courseId,
				assignmentId,
				extensions: { extensionValues: [{ user_id: fx('studentUserId'), extra_attempts: -3 }] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'assignmentExtension' });
		expect(JSON.stringify(result.error[0].canvasErrors)).toContain(fx('studentUserId'));
		expect(await extraAttempts(assignmentId, fx('studentUserId'))).toBe(1);
	});

	it('errors: no extension entry, unknown assignment, student credential', async () => {
		const empty = await runNode({
			resource: 'assignmentExtension',
			operation: 'setExtensions',
			params: { courseId, assignmentId, extensions: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(empty.error[0].errorCode).toBe(0);
		expect(String(empty.error[0].errorMessage)).toContain('At least one extension entry is required');

		const extensions = { extensionValues: [{ user_id: fx('studentUserId'), extra_attempts: 1 }] };
		const missing = await runNode({
			resource: 'assignmentExtension',
			operation: 'setExtensions',
			params: { courseId, assignmentId: '999999999', extensions, errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const forbidden = await runNode({
			resource: 'assignmentExtension',
			operation: 'setExtensions',
			persona: 'student',
			params: { courseId, assignmentId, extensions, errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect([401, 403, 404]).toContain(forbidden.error[0].errorCode);
		expect(await extraAttempts(assignmentId, fx('studentUserId'))).toBe(1);
	});
});
