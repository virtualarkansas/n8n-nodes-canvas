import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import {
	canvasSql,
	createSandboxAccount,
	createSandboxCourse,
	deleteSandboxAccount,
	deleteSandboxCourse,
} from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: outcome. Outcomes are created in outcome groups of a course and a
 * sub-account of this file's own (and one global outcome that is removed again).
 *
 * The root account of the battery uses account-level mastery scales. Canvas then
 * hides the ratings and calculation settings of individual outcomes in its API and
 * refuses to change them, so what Create stored is read back from the database.
 */
describe('outcome', () => {
	let accountId = '';
	let course: SandboxCourse;
	let courseId = '';
	let courseRootId = '';
	let accountRootId = '';
	let globalRootId = '';
	let outcomeId = '';
	let globalOutcomeId = '';
	let assignmentId = '';
	const title = unique('Outcöme "quoted" & <b>tags</b> 目标 🎯');

	const outcome = (id: string | number): Promise<Json> => canvas().get<Json>(`/api/v1/outcomes/${id}`);
	/** ratings / mastery points / calculation settings as stored by Canvas. */
	const stored = (id: string | number): { ratings: Array<[string, number]>; masteryPoints: number | null; method: string; int: number | null } => {
		const [data, method, int] = canvasSql(
			`select replace(coalesce(data, ''), E'\\n', ' '), coalesce(calculation_method, ''), coalesce(calculation_int::text, '') from public.learning_outcomes where id = ${Number(id)}`,
		).split('|');
		const ratings: Array<[string, number]> = [];
		for (const match of data.matchAll(/- :description: (.*?) +:points: ([\d.]+)/g)) {
			ratings.push([match[1].replace(/^["']|["']$/g, ''), Number(match[2])]);
		}
		const mastery = /:mastery_points: ([\d.]+)/.exec(data);
		return { ratings, masteryPoints: mastery ? Number(mastery[1]) : null, method, int: int === '' ? null : Number(int) };
	};

	beforeAll(async () => {
		accountId = await createSandboxAccount('outcomes');
		course = await createSandboxCourse('outcomes', { accountId, students: 2, personas: ['teacher', 'student'] });
		courseId = course.id;
		courseRootId = String((await canvas().get<Json>(`/api/v1/courses/${courseId}/root_outcome_group`)).id);
		accountRootId = String((await canvas().get<Json>(`/api/v1/accounts/${accountId}/root_outcome_group`)).id);
		globalRootId = String((await canvas().get<Json>('/api/v1/global/root_outcome_group')).id);
	});

	afterAll(async () => {
		if (globalOutcomeId) await canvas().request('DELETE', `/api/v1/global/outcome_groups/${globalRootId}/outcomes/${globalOutcomeId}`);
		await deleteSandboxCourse(course);
		await deleteSandboxAccount(accountId);
	});

	it('create: every optional field and ratings reach Canvas', async () => {
		const [link] = await runOk({
			resource: 'outcome',
			operation: 'create',
			params: {
				context: 'course',
				courseId,
				outcomeGroupId: courseRootId,
				title,
				additionalFields: {
					calculation_int: 4,
					calculation_method: 'n_mastery',
					description: '<p>Explains <strong>photosynthesis</strong> & respiration</p>',
					display_name: 'Photosynthesis "friendly" name',
					mastery_points: 3,
					vendor_guid: 'VG/outcome:α-1',
				},
				ratings: {
					rating: [
						{ description: 'Exceeds ✨', points: 5 },
						{ description: 'Meets', points: 3 },
						{ description: 'Not yet', points: 0 },
					],
				},
			},
		});
		// Canvas answers with the link of the new outcome into its group.
		expect(link).toMatchObject({ context_type: 'Course', context_id: Number(courseId), outcome_group: { id: Number(courseRootId) }, outcome: { title } });
		outcomeId = String((link.outcome as Json).id);

		expect(await outcome(outcomeId)).toMatchObject({
			title,
			display_name: 'Photosynthesis "friendly" name',
			description: '<p>Explains <strong>photosynthesis</strong> &amp; respiration</p>',
			vendor_guid: 'VG/outcome:α-1',
			context_type: 'Course',
			context_id: Number(courseId),
		});
		expect(stored(outcomeId)).toEqual({
			ratings: [
				['Exceeds ✨', 5],
				['Meets', 3],
				['Not yet', 0],
			],
			masteryPoints: 3,
			method: 'n_mastery',
			int: 4,
		});
	});

	it('create: with only a title, in an account group and in the global group', async () => {
		const [inAccount] = await runOk({
			resource: 'outcome',
			operation: 'create',
			params: { context: 'account', accountId: Number(accountId), outcomeGroupId: Number(accountRootId), title: unique('Account outcome') },
		});
		expect(inAccount).toMatchObject({ context_type: 'Account', context_id: Number(accountId), outcome: { context_type: 'Account', context_id: Number(accountId) } });

		const [global] = await runOk({
			resource: 'outcome',
			operation: 'create',
			params: { context: 'global', outcomeGroupId: globalRootId, title: unique('Battery global outcome') },
		});
		globalOutcomeId = String((global.outcome as Json).id);
		expect(global).toMatchObject({ context_type: null, outcome: { context_type: null, context_id: null } });
		expect((await outcome(globalOutcomeId)).title).toBe((global.outcome as Json).title);
	});

	it('create: one outcome per input item, as a teacher', async () => {
		const titles = Array.from({ length: 5 }, (_, i) => unique(`Batch outcome ${i + 1}`));
		const result = await runNode({
			resource: 'outcome',
			operation: 'create',
			persona: 'teacher',
			items: titles.map((t, i) => ({ title: t, group: Number(courseRootId), weight: 60 + i })),
			params: {
				courseId: `sis_course_id:${course.sisId}`,
				outcomeGroupId: '={{ $json.group }}',
				title: '={{ $json.title }}',
				additionalFields: { calculation_method: 'decaying_average', calculation_int: '={{ $json.weight }}' },
			},
		});
		expect(result.error).toEqual([]);
		expect(result.success.map((l) => (l.outcome as Json).title)).toEqual(titles);
		expect(stored((result.success[4].outcome as Json).id as number)).toMatchObject({ method: 'decaying_average', int: 64 });
	});

	it('create: a calculation setting Canvas does not accept is a validation error', async () => {
		const result = await runNode({
			resource: 'outcome',
			operation: 'create',
			params: {
				context: 'course',
				courseId,
				outcomeGroupId: courseRootId,
				title: unique('Invalid'),
				additionalFields: { calculation_method: 'n_mastery', calculation_int: 50 },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'outcome', operation: 'create' });
		expect(JSON.stringify(result.error[0].canvasErrors)).toContain('calculation_int');
	});

	it('get: one outcome per input item, with a mix of found and missing', async () => {
		const result = await runNode({
			resource: 'outcome',
			operation: 'get',
			items: [{ id: Number(outcomeId) }, { id: 99999999 }, { id: globalOutcomeId }],
			params: { outcomeId: '={{ $json.id }}', options: { add_defaults: true }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((o) => String(o.id))).toEqual([outcomeId, globalOutcomeId]);
		expect(result.success[0]).toMatchObject({
			title,
			display_name: 'Photosynthesis "friendly" name',
			vendor_guid: 'VG/outcome:α-1',
			can_edit: true,
			assessed: false,
		});
		expect(String(result.success[0].description)).toContain('<strong>photosynthesis</strong>');
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'outcome', operation: 'get' });
	});

	it('update: title, display name, description and vendor GUID', async () => {
		const renamed = `${title} (renamed)`;
		const [updated] = await runOk({
			resource: 'outcome',
			operation: 'update',
			params: {
				outcomeId,
				updateFields: {
					title: renamed,
					display_name: 'New friendly name',
					description: '<p>Second <em>version</em></p>',
					vendor_guid: 'VG-2',
				},
			},
		});
		expect(updated).toMatchObject({ id: Number(outcomeId), title: renamed });
		expect(await outcome(outcomeId)).toMatchObject({
			title: renamed,
			display_name: 'New friendly name',
			description: '<p>Second <em>version</em></p>',
			vendor_guid: 'VG-2',
		});
		// Ratings and calculation settings are untouched.
		expect(stored(outcomeId)).toMatchObject({ masteryPoints: 3, method: 'n_mastery', int: 4 });
	});

	it('update: with account-level mastery scales Canvas refuses ratings, mastery points and calculation settings', async () => {
		const attempts: Json[] = [
			{ updateFields: { mastery_points: 4 } },
			{ updateFields: { calculation_method: 'highest' } },
			{ ratings: { rating: [{ description: 'Pass', points: 1 }, { description: 'Fail', points: 0 }] } },
		];
		for (const attempt of attempts) {
			const result = await runNode({
				resource: 'outcome',
				operation: 'update',
				params: { outcomeId, ...attempt, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'outcome', operation: 'update' });
			// Canvas' own (localized) explanation is passed on.
			expect(String(result.error[0].errorMessage).length).toBeGreaterThan(10);
		}
		expect(stored(outcomeId)).toMatchObject({ masteryPoints: 3, method: 'n_mastery', int: 4 });
		expect(stored(outcomeId).ratings).toHaveLength(3);
	});

	it('getAlignedAssignments: the alignments of an assignment and of a student', async () => {
		const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: { name: unique('Aligned assignment'), points_possible: 5, submission_types: ['online_text_entry'], published: true },
		});
		assignmentId = String(assignment.id);
		// Aligning = using a rubric with an outcome criterion to grade the assignment.
		await canvas().post(`/api/v1/courses/${courseId}/rubrics`, {
			rubric: { title: unique('Outcome rubric'), criteria: { 0: { description: 'Outcome', learning_outcome_id: outcomeId, ratings: { 0: { description: 'Yes', points: 5 }, 1: { description: 'No', points: 0 } } } } },
			rubric_association: { association_type: 'Assignment', association_id: assignmentId, purpose: 'grading', use_for_grading: true },
		});

		const byAssignment = await runOk({
			resource: 'outcome',
			operation: 'getAlignedAssignments',
			params: { courseId, options: { assignment_id: assignmentId } },
		});
		expect(byAssignment).toHaveLength(1);
		expect(byAssignment[0]).toMatchObject({ learning_outcome_id: Number(outcomeId), assignment_id: Number(assignmentId), title: assignment.name });
		expect(String(byAssignment[0].url)).toContain(`/courses/${courseId}/assignments/${assignmentId}`);

		const byStudent = await runOk({
			resource: 'outcome',
			operation: 'getAlignedAssignments',
			persona: 'teacher',
			params: { courseId: Number(courseId), options: { student_id: course.studentIds[0], assignment_id: Number(assignmentId) } },
		});
		expect(byStudent).toMatchObject([{ learning_outcome_id: Number(outcomeId), assignment_id: Number(assignmentId) }]);

		// An assignment without alignments: no items.
		const plain = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: { name: unique('Not aligned'), points_possible: 5, submission_types: ['none'], published: true },
		});
		const none = await runNode({ resource: 'outcome', operation: 'getAlignedAssignments', params: { courseId, options: { assignment_id: String(plain.id) } } });
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
		expect(none.error).toEqual([]);
	});

	it('getAlignedAssignments: Canvas requires a student or an assignment', async () => {
		const missing = await runNode({
			resource: 'outcome',
			operation: 'getAlignedAssignments',
			params: { courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', errorMessage: 'student_id or assignment_id is required' });

		const unknown = await runNode({
			resource: 'outcome',
			operation: 'getAlignedAssignments',
			params: { courseId, options: { assignment_id: '99999999' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('errors: a student may read an outcome of the course but not change it; an unknown outcome is "not found"', async () => {
		const [read] = await runOk({ resource: 'outcome', operation: 'get', persona: 'student', params: { outcomeId } });
		expect(read).toMatchObject({ id: Number(outcomeId), can_edit: false });

		const forbidden = await runNode({
			resource: 'outcome',
			operation: 'update',
			persona: 'student',
			params: { outcomeId, updateFields: { title: 'by a student' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect([401, 403]).toContain(forbidden.error[0].errorCode);

		const missing = await runNode({
			resource: 'outcome',
			operation: 'update',
			params: { outcomeId: '99999999', updateFields: { title: 'nobody' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'outcome', operation: 'update' });
		expect((await outcome(outcomeId)).title).not.toBe('by a student');
	});
});
