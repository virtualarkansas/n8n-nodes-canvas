import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { canvasSql, createSandboxAccount, createSandboxCourse, deleteSandboxAccount, deleteSandboxCourse, unwrap } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: rubric (rubrics, their associations with assignments and rubric
 * assessments). Everything is created in a course of this file's own; account
 * rubrics (which Canvas has no API to create) are only read.
 */
describe('rubric', () => {
	let course: SandboxCourse;
	let accountCourse: SandboxCourse | undefined;
	let subAccountId: string | undefined;
	let courseId = '';
	let rubricId = '';
	let assignmentIds: string[] = [];
	let associationId = '';
	let assessmentId = '';
	let criteria: Json[] = [];
	const title = unique('Rübric "quoted" & <b>tags</b> 评分 📝');

	const rubric = (id: string, query = ''): Promise<Json> => canvas().get<Json>(`/api/v1/courses/${courseId}/rubrics/${id}${query}`);
	const rubricIds = async (): Promise<number[]> =>
		(await canvas().getAll<Json>(`/api/v1/courses/${courseId}/rubrics`)).map((r) => Number(r.id));
	const associationsOf = async (id: string): Promise<Json[]> =>
		(await rubric(id, '?include[]=associations')).associations as Json[];
	const assessedSubmission = (assignmentId: string, userId: number): Promise<Json> =>
		canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}?include[]=rubric_assessment`);

	beforeAll(async () => {
		course = await createSandboxCourse('rubrics', { students: 3, personas: ['teacher', 'student'] });
		courseId = course.id;
		for (const label of ['A', 'B', 'C']) {
			const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
				assignment: { name: unique(`Rubric assignment ${label}`), points_possible: 10, submission_types: ['online_text_entry'], published: true },
			});
			assignmentIds.push(String(assignment.id));
		}
	});

	afterAll(async () => {
		await deleteSandboxCourse(course);
		await deleteSandboxCourse(accountCourse);
		await deleteSandboxAccount(subAccountId);
		assignmentIds = [];
	});

	it('create: criteria with and without ratings, bookmarked in the course by default', async () => {
		const [output] = await runOk({
			resource: 'rubric',
			operation: 'create',
			params: {
				courseId,
				title,
				criteria: {
					criterion: [
						// Only points: Canvas' default ratings "Full Marks" / "No Marks" are created.
						{ description: 'Thesis — "clear" & <focused>', long_description: 'States a claim', points: 5 },
						{
							description: 'Evidence 证据',
							long_description: 'Uses sources',
							points: 0,
							criterion_use_range: true,
							ratings: {
								rating: [
									{ description: 'Developing', long_description: 'Some sources', points: 6 },
									{ description: 'Excellent ✨', long_description: 'Many good sources', points: 10 },
									{ description: 'Missing', points: 0 },
								],
							},
						},
					],
				},
				additionalFields: { free_form_criterion_comments: true },
			},
		});
		const created = unwrap(output, 'rubric');
		rubricId = String(created.id);
		expect(created).toMatchObject({ title, points_possible: 15, free_form_criterion_comments: true, context_id: Number(courseId) });
		expect(unwrap(output, 'rubric_association')).toMatchObject({ association_type: 'Course', association_id: Number(courseId), purpose: 'bookmark', bookmarked: true });

		const actual = await rubric(rubricId, '?include[]=associations');
		expect(actual).toMatchObject({ title, points_possible: 15, free_form_criterion_comments: true });
		criteria = actual.data as Json[];
		expect(criteria.map((c) => [c.description, c.long_description, c.points, c.criterion_use_range])).toEqual([
			['Thesis — "clear" & <focused>', 'States a claim', 5, false],
			['Evidence 证据', 'Uses sources', 10, true],
		]);
		expect((criteria[0].ratings as Json[]).map((r) => [r.description, r.points])).toEqual([
			['Full Marks', 5],
			['No Marks', 0],
		]);
		// Canvas sorts ratings from most to fewest points.
		expect((criteria[1].ratings as Json[]).map((r) => [r.description, r.long_description, r.points])).toEqual([
			['Excellent ✨', 'Many good sources', 10],
			['Developing', 'Some sources', 6],
			['Missing', '', 0],
		]);
		expect(actual.associations).toMatchObject([{ association_type: 'Course', association_id: Number(courseId), purpose: 'bookmark' }]);
	});

	it('create: attached to an assignment with every association option', async () => {
		const [output] = await runOk({
			resource: 'rubric',
			operation: 'create',
			persona: 'teacher',
			params: {
				courseId: Number(courseId),
				title: unique('Grading rubric'),
				criteria: { criterion: [{ description: 'Only criterion', points: 20 }] },
				additionalFields: {
					rubric_association_association_id: Number(assignmentIds[2]),
					rubric_association_association_type: 'Assignment',
					rubric_association_purpose: 'grading',
					rubric_association_use_for_grading: true,
					rubric_association_hide_score_total: true,
					free_form_criterion_comments: false,
				},
			},
		});
		expect(unwrap(output, 'rubric')).toMatchObject({ points_possible: 20, free_form_criterion_comments: false });
		expect(unwrap(output, 'rubric_association')).toMatchObject({
			association_type: 'Assignment',
			association_id: Number(assignmentIds[2]),
			purpose: 'grading',
			use_for_grading: true,
			hide_score_total: true,
		});

		const assignment = await canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${assignmentIds[2]}`);
		expect(assignment).toMatchObject({ use_rubric_for_grading: true, points_possible: 20 });
		expect(assignment.rubric_settings).toMatchObject({ id: unwrap(output, 'rubric').id, points_possible: 20, hide_score_total: true });
	});

	it('create: with a SIS course ID the association has to be given explicitly', async () => {
		const implicit = await runNode({
			resource: 'rubric',
			operation: 'create',
			params: {
				courseId: `sis_course_id:${course.sisId}`,
				title: unique('Never created'),
				criteria: { criterion: [{ description: 'x', points: 1 }] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(implicit.success).toEqual([]);
		expect(String(implicit.error[0].errorMessage)).toMatch(/numeric course ID/i);

		const [explicit] = await runOk({
			resource: 'rubric',
			operation: 'create',
			params: {
				courseId: `sis_course_id:${course.sisId}`,
				title: unique('Via SIS course ID'),
				criteria: { criterion: [{ description: 'x', points: 1 }] },
				additionalFields: { rubric_association_association_id: courseId, rubric_association_association_type: 'Course' },
			},
		});
		expect(unwrap(explicit, 'rubric_association')).toMatchObject({ association_type: 'Course', purpose: 'bookmark' });
		expect(await rubricIds()).toContain(Number(unwrap(explicit, 'rubric').id));
	});

	it('create: one rubric per input item', async () => {
		const titles = Array.from({ length: 10 }, (_, i) => unique(`Batch rubric ${i + 1}`));
		const result = await runNode({
			resource: 'rubric',
			operation: 'create',
			items: titles.map((t, i) => ({ title: t, points: i + 1 })),
			params: {
				courseId,
				title: '={{ $json.title }}',
				criteria: { criterion: [{ description: 'Quality', points: '={{ $json.points }}' }] },
			},
		});
		expect(result.error).toEqual([]);
		const created = result.success.map((item) => unwrap(item, 'rubric'));
		expect(created.map((r) => r.title)).toEqual(titles);
		expect(created.map((r) => r.points_possible)).toEqual(titles.map((_, i) => i + 1));
	});

	it('getAll: course context returns every rubric exactly once, across pages', async () => {
		const expected = await rubricIds();
		expect(expected.length).toBeGreaterThan(10);

		const defaults = await runOk({ resource: 'rubric', operation: 'getAll', params: { context: 'course', courseId } });
		expect(defaults.map((r) => r.id).sort()).toEqual([...expected].sort());
		expect(new Set(defaults.map((r) => r.id)).size).toBe(defaults.length);
		expect(defaults.find((r) => String(r.id) === rubricId)).toMatchObject({ title, points_possible: 15 });

		const twoPages = await runOk({
			resource: 'rubric',
			operation: 'getAll',
			persona: 'teacher',
			params: { courseId, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(twoPages).toHaveLength(8);
		expect(new Set(twoPages.map((r) => r.id)).size).toBe(8);

		const all = await runOk({
			resource: 'rubric',
			operation: 'getAll',
			params: { context: 'course', courseId: `sis_course_id:${course.sisId}`, pagination: { returnAll: true } },
		});
		expect(all.map((r) => r.id).sort()).toEqual([...expected].sort());
	});

	it('getAll: account context lists the rubrics of the account', async () => {
		const accountId = fx('accountId');
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${accountId}/rubrics`);
		expect(expected.length, 'the seed creates account rubrics').toBeGreaterThan(0);

		const listed = await runOk({
			resource: 'rubric',
			operation: 'getAll',
			params: { context: 'account', accountId, pagination: { returnAll: true } },
		});
		expect(listed.map((r) => r.id).sort()).toEqual(expected.map((r) => r.id).sort());
		for (const item of listed) expect(item.context_type).toBe('Account');
	});

	it('get / getUsedLocations: account context serves rubrics that are bookmarked in the account', async () => {
		// Canvas has no API to create an account rubric (the Rubrics page of the account does it), so
		// one is inserted the way that page stores it: a rubric owned by the account plus its bookmark.
		subAccountId = await createSandboxAccount('rubrics');
		accountCourse = await createSandboxCourse('account-rubric-user', { accountId: subAccountId });
		const root = Number(fx('accountId'));
		const accountRubricId = canvasSql(
			`with r as (
				insert into public.rubrics (context_id, context_type, context_code, title, data, points_possible, user_id, workflow_state, root_account_id, created_at, updated_at)
				select ${Number(subAccountId)}, 'Account', 'account_${Number(subAccountId)}', 'Battery account rubric', data, points_possible, user_id, 'active', ${root}, now(), now()
				from public.rubrics where id = ${Number(rubricId)} returning id)
			insert into public.rubric_associations (rubric_id, association_id, association_type, context_id, context_type, context_code, purpose, bookmarked, title, workflow_state, root_account_id, created_at, updated_at)
			select r.id, ${Number(subAccountId)}, 'Account', ${Number(subAccountId)}, 'Account', 'account_${Number(subAccountId)}', 'bookmark', true, 'Battery account rubric', 'active', ${root}, now(), now() from r
			returning rubric_id`,
		).split('\n')[0];
		expect(accountRubricId).toMatch(/^\d+$/);

		const listed = await runOk({ resource: 'rubric', operation: 'getAll', params: { context: 'account', accountId: subAccountId } });
		expect(listed.map((r) => String(r.id))).toEqual([accountRubricId]);

		const [fetched] = await runOk({
			resource: 'rubric',
			operation: 'get',
			params: { context: 'account', accountId: subAccountId, rubricId: Number(accountRubricId), options: { include_associations: 'account_associations' } },
		});
		expect(fetched).toMatchObject({ id: Number(accountRubricId), title: 'Battery account rubric', context_type: 'Account', points_possible: 15 });
		expect(fetched.associations).toMatchObject([{ association_type: 'Account', association_id: Number(subAccountId), purpose: 'bookmark' }]);

		// Use the account rubric on an assignment of a course of that account.
		const assignment = await canvas().post<Json>(`/api/v1/courses/${accountCourse.id}/assignments`, {
			assignment: { name: 'Uses the account rubric', points_possible: 15, submission_types: ['none'], published: true },
		});
		await runOk({
			resource: 'rubric',
			operation: 'createAssociation',
			params: { courseId: accountCourse.id, rubricId: accountRubricId, associationType: 'Assignment', associationId: String(assignment.id) },
		});
		const used = await runOk({
			resource: 'rubric',
			operation: 'getUsedLocations',
			params: { context: 'account', accountId: subAccountId, rubricId: accountRubricId },
		});
		expect(used).toHaveLength(1);
		expect(used[0]).toMatchObject({ id: Number(accountCourse.id), assignments: [{ id: assignment.id, title: 'Uses the account rubric' }] });

		// The seeded account rubrics are not bookmarked in their account: Canvas lists them but does not serve them one by one.
		const unbookmarked = await runNode({
			resource: 'rubric',
			operation: 'get',
			params: { context: 'account', accountId: fx('accountId'), rubricId: fx('accountRubricId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(unbookmarked.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', errorMessage: 'Rubric not found' });
	});

	it('createAssociation: attaches the rubric to an assignment with every option', async () => {
		const [output] = await runOk({
			resource: 'rubric',
			operation: 'createAssociation',
			params: {
				courseId,
				rubricId,
				associationType: 'Assignment',
				associationId: assignmentIds[0],
				additionalFields: { bookmarked: false, hide_score_total: true, purpose: 'grading', title: 'Essay rubric "A"', use_for_grading: true },
			},
		});
		const association = unwrap(output, 'rubric_association');
		associationId = String(association.id);
		expect(association).toMatchObject({
			rubric_id: Number(rubricId),
			association_type: 'Assignment',
			association_id: Number(assignmentIds[0]),
			bookmarked: false,
			hide_score_total: true,
			purpose: 'grading',
			title: 'Essay rubric "A"',
			use_for_grading: true,
		});

		const stored = (await associationsOf(rubricId)).find((a) => String(a.id) === associationId);
		expect(stored).toMatchObject({ association_type: 'Assignment', association_id: Number(assignmentIds[0]), use_for_grading: true, hide_score_total: true, purpose: 'grading' });
		const assignment = await canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${assignmentIds[0]}`);
		// Used for grading: the assignment takes over the points of the rubric.
		expect(assignment).toMatchObject({ use_rubric_for_grading: true, points_possible: 15 });
	});

	it('createAssociation: an assignment of another course is refused', async () => {
		const result = await runNode({
			resource: 'rubric',
			operation: 'createAssociation',
			persona: 'teacher',
			params: {
				courseId,
				rubricId,
				associationType: 'Assignment',
				associationId: '99999999',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(1);
		expect(Number(result.error[0].errorCode)).toBeGreaterThanOrEqual(400);
		expect(result.error[0]).toMatchObject({ resource: 'rubric', operation: 'createAssociation' });
	});

	it('get: includes one kind of associations and one kind of assessments', async () => {
		const [plain] = await runOk({ resource: 'rubric', operation: 'get', params: { context: 'course', courseId, rubricId } });
		expect(plain).toMatchObject({ id: Number(rubricId), title });
		expect(plain).not.toHaveProperty('associations');
		expect(plain).not.toHaveProperty('assessments');

		const [withAssignments] = await runOk({
			resource: 'rubric',
			operation: 'get',
			persona: 'teacher',
			params: {
				context: 'course',
				courseId,
				rubricId: Number(rubricId),
				options: { include_associations: 'assignment_associations', include_assessments: 'graded_assessments', style: 'full' },
			},
		});
		expect((withAssignments.associations as Json[]).map((a) => a.association_type)).toEqual(['Assignment']);
		expect(withAssignments.assessments).toEqual([]);
		expect(withAssignments.criteria).toHaveLength(2);

		const [withCourse] = await runOk({
			resource: 'rubric',
			operation: 'get',
			params: { context: 'course', courseId, rubricId, options: { include_associations: 'course_associations', include_assessments: 'none' } },
		});
		expect((withCourse.associations as Json[]).map((a) => a.association_type)).toEqual(['Course']);
		expect(withCourse).not.toHaveProperty('assessments');
	});

	it('getUsedLocations: lists the course with the assignments that use the rubric', async () => {
		const used = await runOk({ resource: 'rubric', operation: 'getUsedLocations', params: { context: 'course', courseId, rubricId } });
		expect(used).toHaveLength(1);
		expect(used[0]).toMatchObject({ id: Number(courseId) });
		expect((used[0].assignments as Json[]).map((a) => String(a.id))).toEqual([assignmentIds[0]]);

		// A rubric that is only bookmarked is used nowhere: no items.
		const bookmarked = (await canvas().getAll<Json>(`/api/v1/courses/${courseId}/rubrics`)).find((r) => String(r.title).startsWith('Batch rubric 1 '));
		const unused = await runNode({
			resource: 'rubric',
			operation: 'getUsedLocations',
			params: { context: 'course', courseId, rubricId: String(bookmarked?.id) },
		});
		expect(unused.ok).toBe(true);
		expect(unused.success).toEqual([]);
		expect(unused.error).toEqual([]);
	});

	it('updateAssociation: every option reaches Canvas', async () => {
		const [output] = await runOk({
			resource: 'rubric',
			operation: 'updateAssociation',
			params: {
				courseId,
				rubricAssociationId: associationId,
				updateFields: { bookmarked: true, hide_score_total: false, purpose: 'grading', title: 'Renamed association', use_for_grading: true },
			},
		});
		expect(unwrap(output, 'rubric_association')).toMatchObject({
			id: Number(associationId),
			bookmarked: true,
			hide_score_total: false,
			title: 'Renamed association',
			use_for_grading: true,
		});
		const stored = (await associationsOf(rubricId)).find((a) => String(a.id) === associationId);
		expect(stored).toMatchObject({ hide_score_total: false, use_for_grading: true, purpose: 'grading' });
	});

	it('createAssessment: assesses students against the rubric and grades the submission', async () => {
		const [first, second] = criteria;
		const excellent = (second.ratings as Json[])[0];
		const result = await runNode({
			resource: 'rubric',
			operation: 'createAssessment',
			items: [
				{ student: course.studentIds[0], thesis: 4, evidence: 10 },
				{ student: course.studentIds[1], thesis: 2.5, evidence: 6 },
			],
			params: {
				courseId,
				rubricAssociationId: Number(associationId),
				userId: '={{ $json.student }}',
				assessmentType: 'grading',
				criterionAssessments: {
					criterion: [
						{ criterion_id: first.id, points: '={{ $json.thesis }}', comments: 'Clear, but "short" & <dense> 👍', save_comment: true },
						{ criterion_id: second.id, points: '={{ $json.evidence }}', rating_id: excellent.id, comments: '' },
					],
				},
			},
		});
		expect(result.error).toEqual([]);
		expect(result.success.map((a) => [a.user_id, a.score, a.assessment_type])).toEqual([
			[course.studentIds[0], 14, 'grading'],
			[course.studentIds[1], 8.5, 'grading'],
		]);
		assessmentId = String(result.success[0].id);

		const submission = await assessedSubmission(assignmentIds[0], course.studentIds[0]);
		expect(submission).toMatchObject({ score: 14, workflow_state: 'graded' });
		expect(submission.rubric_assessment).toMatchObject({
			[String(first.id)]: { points: 4, comments: 'Clear, but "short" & <dense> 👍' },
			[String(second.id)]: { points: 10, rating_id: excellent.id },
		});
		expect((await assessedSubmission(assignmentIds[0], course.studentIds[1])).score).toBe(8.5);

		const [withAssessments] = await runOk({
			resource: 'rubric',
			operation: 'get',
			params: { context: 'course', courseId, rubricId, options: { include_assessments: 'assessments', style: 'comments_only' } },
		});
		expect((withAssessments.assessments as Json[]).map((a) => a.id)).toContain(Number(assessmentId));
	});

	it('updateAssessment: changes the points of an assessment', async () => {
		const [first, second] = criteria;
		const [updated] = await runOk({
			resource: 'rubric',
			operation: 'updateAssessment',
			persona: 'teacher',
			params: {
				courseId,
				rubricAssociationId: associationId,
				rubricAssessmentId: assessmentId,
				userId: course.studentIds[0],
				criterionAssessments: {
					criterion: [
						{ criterion_id: first.id, points: 5 },
						{ criterion_id: second.id, points: 6, comments: 'Revised' },
					],
				},
				options: { graded_anonymously: false },
			},
		});
		expect(updated).toMatchObject({ id: Number(assessmentId), score: 11 });
		const submission = await assessedSubmission(assignmentIds[0], course.studentIds[0]);
		expect(submission.score).toBe(11);
		expect(submission.rubric_assessment).toMatchObject({ [String(second.id)]: { points: 6, comments: 'Revised' } });
	});

	it('createAssessment: a user who is not a student of the course cannot be assessed', async () => {
		const result = await runNode({
			resource: 'rubric',
			operation: 'createAssessment',
			params: {
				courseId,
				rubricAssociationId: associationId,
				userId: fx('adminUserId'),
				criterionAssessments: { criterion: [{ criterion_id: criteria[0].id, points: 1 }] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(1);
		expect(Number(result.error[0].errorCode)).toBeGreaterThanOrEqual(400);
	});

	it('deleteAssessment: removes the assessment', async () => {
		const [deleted] = await runOk({
			resource: 'rubric',
			operation: 'deleteAssessment',
			params: { courseId, rubricAssociationId: associationId, rubricAssessmentId: Number(assessmentId) },
		});
		expect(unwrap(deleted, 'rubric_assessment')).toMatchObject({ id: Number(assessmentId) });
		const remaining = (await rubric(rubricId, '?include[]=assessments')).assessments as Json[];
		expect(remaining.map((a) => a.id)).not.toContain(Number(assessmentId));
		expect(remaining).toHaveLength(1);
	});

	it('update: replaces the title and criteria, keeps criterion IDs and updates the association', async () => {
		const renamed = `${title} (v2)`;
		const [output] = await runOk({
			resource: 'rubric',
			operation: 'update',
			params: {
				courseId,
				rubricId,
				title: renamed,
				criteria: {
					criterion: [
						{ id: criteria[0].id, description: 'Thesis (reworded)', points: 8 },
						{
							description: 'Mechanics',
							points: 0,
							ratings: { rating: [{ description: 'Clean', points: 4 }, { description: 'Messy', points: 1 }] },
						},
					],
				},
				options: {
					free_form_criterion_comments: false,
					rubric_association_id: associationId,
					rubric_association_association_id: assignmentIds[0],
					rubric_association_association_type: 'Assignment',
					rubric_association_purpose: 'grading',
					rubric_association_use_for_grading: true,
					rubric_association_hide_score_total: true,
					skip_updating_points_possible: true,
				},
			},
		});
		expect(unwrap(output, 'rubric')).toMatchObject({ id: Number(rubricId), title: renamed, points_possible: 12 });
		expect(unwrap(output, 'rubric_association')).toMatchObject({ id: Number(associationId), hide_score_total: true, skip_updating_points_possible: true });

		const actual = await rubric(rubricId, '?include[]=associations');
		expect(actual).toMatchObject({ title: renamed, points_possible: 12, free_form_criterion_comments: false });
		const data = actual.data as Json[];
		expect(data.map((c) => [c.description, c.points])).toEqual([
			['Thesis (reworded)', 8],
			['Mechanics', 4],
		]);
		expect(data[0].id).toBe(criteria[0].id);
		expect((actual.associations as Json[]).find((a) => String(a.id) === associationId)).toMatchObject({ hide_score_total: true, use_for_grading: true });
		// "Skip Updating Points Possible": the assignment keeps the 15 points it had.
		expect((await canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${assignmentIds[0]}`)).points_possible).toBe(15);
		criteria = data;
	});

	it('update: without criteria the node refuses, because Canvas would empty the rubric', async () => {
		const result = await runNode({
			resource: 'rubric',
			operation: 'update',
			params: { courseId, rubricId, title: 'No criteria', criteria: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(String(result.error[0].errorMessage)).toMatch(/at least one criterion/i);
		expect((await rubric(rubricId)).data).toHaveLength(2);
	});

	it('update: a rubric used by more than one assignment is not changed; Canvas returns a changed copy', async () => {
		await canvas().post(`/api/v1/courses/${courseId}/rubric_associations`, {
			rubric_association: { rubric_id: rubricId, association_type: 'Assignment', association_id: assignmentIds[1], purpose: 'grading' },
		});
		const before = await rubric(rubricId);
		const [output] = await runOk({
			resource: 'rubric',
			operation: 'update',
			params: {
				courseId,
				rubricId,
				title: 'Changed copy',
				criteria: { criterion: [{ description: 'Brand new', points: 3 }] },
			},
		});
		const copy = unwrap(output, 'rubric');
		expect(copy.id).not.toBe(Number(rubricId));
		expect(copy).toMatchObject({ title: 'Changed copy', points_possible: 3, rubric_id: Number(rubricId) });
		expect(await rubric(rubricId)).toMatchObject({ title: before.title, points_possible: before.points_possible });
	});

	it('deleteAssociation: detaches the rubric from the assignment', async () => {
		const [output] = await runOk({
			resource: 'rubric',
			operation: 'deleteAssociation',
			params: { courseId, rubricAssociationId: Number(associationId) },
		});
		expect(unwrap(output, 'rubric_association')).toMatchObject({ id: Number(associationId), workflow_state: 'deleted' });
		expect((await associationsOf(rubricId)).map((a) => String(a.id))).not.toContain(associationId);
		const assignment = await canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${assignmentIds[0]}`);
		expect(assignment).not.toHaveProperty('rubric');
	});

	it('delete: removes the rubric from the course', async () => {
		const [output] = await runOk({ resource: 'rubric', operation: 'delete', params: { courseId, rubricId } });
		expect(unwrap(output, 'rubric')).toMatchObject({ id: Number(rubricId), workflow_state: 'deleted' });
		expect(await rubricIds()).not.toContain(Number(rubricId));
	});

	it('errors: a deleted rubric is "not found" for get; deleting it again makes Canvas fail', async () => {
		for (const operation of ['get', 'getUsedLocations']) {
			const result = await runNode({
				resource: 'rubric',
				operation,
				params: { context: 'course', courseId, rubricId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'rubric', operation });
		}
		// Canvas looks the rubric up through its association and trips over the missing one (HTTP 500).
		const again = await runNode({
			resource: 'rubric',
			operation: 'delete',
			params: { courseId, rubricId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.success).toEqual([]);
		expect(again.error).toHaveLength(1);
		expect(Number(again.error[0].errorCode)).toBeGreaterThanOrEqual(400);
	});

	it('errors: a student may neither list nor create rubrics', async () => {
		for (const operation of ['getAll', 'create']) {
			const result = await runNode({
				resource: 'rubric',
				operation,
				persona: 'student',
				params: {
					context: 'course',
					courseId,
					title: unique('Forbidden'),
					criteria: { criterion: [{ description: 'x', points: 1 }] },
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success).toEqual([]);
			expect([401, 403]).toContain(result.error[0].errorCode);
			expect(result.error[0]).toMatchObject({ resource: 'rubric', operation });
		}
	});
});
