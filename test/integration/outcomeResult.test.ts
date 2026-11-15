import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createSandboxCourse, deleteSandboxCourse } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: outcomeResult. A course of its own with two outcomes, a rubric whose
 * criteria are aligned with them and an assignment graded with that rubric:
 * 12 of the 13 sandbox students are assessed, which gives 24 outcome results
 * (more than two pages) and one student (plus the student persona) without any.
 */
describe('outcomeResult', () => {
	let course: SandboxCourse;
	let courseId = '';
	let groupId = '';
	let outcomeA = 0;
	let outcomeB = 0;
	let assignmentId = '';
	let assessed: number[] = [];
	/** score per assessed student: [outcome A, outcome B] */
	const scores = new Map<number, [number, number]>();

	const allResults = (query = ''): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/courses/${courseId}/outcome_results${query}`, 'outcome_results');
	const allRollups = (query = ''): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/courses/${courseId}/outcome_rollups${query}`, 'rollups');
	const userOf = (item: Json): number => Number((item.links as Json).user);
	const outcomeOf = (item: Json): number => Number((item.links as Json).learning_outcome ?? (item.links as Json).outcome);
	const ids = (items: Json[]): number[] => items.map((r) => Number(r.id)).sort((a, b) => a - b);

	beforeAll(async () => {
		course = await createSandboxCourse('outcome-results', { students: 13, personas: ['teacher', 'student'] });
		courseId = course.id;
		const rootId = String((await canvas().get<Json>(`/api/v1/courses/${courseId}/root_outcome_group`)).id);
		const group = await canvas().post<Json>(`/api/v1/courses/${courseId}/outcome_groups/${rootId}/subgroups`, { title: unique('Results group') });
		groupId = String(group.id);
		const linkA = await canvas().post<Json>(`/api/v1/courses/${courseId}/outcome_groups/${groupId}/outcomes`, { title: 'Outcome A (in a group)' });
		const linkB = await canvas().post<Json>(`/api/v1/courses/${courseId}/outcome_groups/${rootId}/outcomes`, { title: 'Outcome B (in the root group)' });
		outcomeA = Number((linkA.outcome as Json).id);
		outcomeB = Number((linkB.outcome as Json).id);

		const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: { name: unique('Outcome assessed'), points_possible: 8, submission_types: ['online_text_entry'], published: true },
		});
		assignmentId = String(assignment.id);
		const created = await canvas().post<Json>(`/api/v1/courses/${courseId}/rubrics`, {
			rubric: {
				title: unique('Outcome rubric'),
				criteria: {
					0: { description: 'A', learning_outcome_id: outcomeA, ratings: { 0: { description: 'Top', points: 4 }, 1: { description: 'None', points: 0 } } },
					1: { description: 'B', learning_outcome_id: outcomeB, ratings: { 0: { description: 'Top', points: 4 }, 1: { description: 'None', points: 0 } } },
				},
			},
			rubric_association: { association_type: 'Assignment', association_id: assignmentId, purpose: 'grading', use_for_grading: true },
		});
		const criteria = (created.rubric as Json).criteria as Json[];
		const associationId = String((created.rubric_association as Json).id);

		assessed = course.studentIds.slice(0, 12);
		for (const [index, studentId] of assessed.entries()) {
			const pair: [number, number] = [index % 5, (index * 2) % 5];
			scores.set(studentId, pair);
			await canvas().post(`/api/v1/courses/${courseId}/rubric_associations/${associationId}/rubric_assessments`, {
				rubric_assessment: {
					// Canvas fails with a 500 when the user ID arrives as a JSON number.
					user_id: String(studentId),
					assessment_type: 'grading',
					[`criterion_${String(criteria[0].id)}`]: { points: pair[0] },
					[`criterion_${String(criteria[1].id)}`]: { points: pair[1] },
				},
			});
		}
		expect(await allResults()).toHaveLength(24);
	});

	afterAll(async () => {
		await deleteSandboxCourse(course);
	});

	it('getAll: one item per result, every result exactly once, across pages', async () => {
		const expected = await allResults();

		const defaults = await runOk({ resource: 'outcomeResult', operation: 'getAll', params: { courseId } });
		expect(ids(defaults)).toEqual(ids(expected));
		expect(new Set(defaults.map((r) => r.id)).size).toBe(24);
		const sample = defaults.find((r) => userOf(r) === assessed[3] && outcomeOf(r) === outcomeA) as Json;
		expect(sample).toMatchObject({
			score: 3,
			possible: 4,
			percent: 0.75,
			hidden: false,
			links: { user: String(assessed[3]), learning_outcome: String(outcomeA), assignment: `assignment_${assignmentId}` },
		});
		expect(sample).not.toHaveProperty('outcome_results');

		const twoPages = await runOk({
			resource: 'outcomeResult',
			operation: 'getAll',
			persona: 'teacher',
			params: { courseId, pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(twoPages).toHaveLength(10);
		expect(new Set(twoPages.map((r) => r.id)).size).toBe(10);

		const all = await runOk({
			resource: 'outcomeResult',
			operation: 'getAll',
			params: { courseId: `sis_course_id:${course.sisId}`, pagination: { returnAll: true } },
		});
		expect(ids(all)).toEqual(ids(expected));
	});

	it('getAll: filters by students, outcomes, outcome group and section', async () => {
		const [first, second] = assessed;
		const byUsers = await runOk({
			resource: 'outcomeResult',
			operation: 'getAll',
			// Typed with spaces; one student by SIS ID.
			params: { courseId, options: { user_ids: `${first}, sis_user_id:BATTERY-GRD-STU-002` }, pagination: { returnAll: true } },
		});
		expect(byUsers).toHaveLength(4);
		expect(new Set(byUsers.map(userOf))).toEqual(new Set([first, second]));

		const fromExpression = await runOk({
			resource: 'outcomeResult',
			operation: 'getAll',
			items: [{ users: [first, second], outcomes: [outcomeB] }],
			params: {
				courseId: Number(courseId),
				options: { user_ids: '={{ $json.users }}', outcome_ids: '={{ $json.outcomes }}', include_hidden: true },
			},
		});
		expect(fromExpression.map((r) => [userOf(r), outcomeOf(r), r.score]).sort()).toEqual(
			[
				[first, outcomeB, scores.get(first)?.[1]],
				[second, outcomeB, scores.get(second)?.[1]],
			].sort(),
		);

		const byOutcome = await runOk({
			resource: 'outcomeResult',
			operation: 'getAll',
			params: { courseId, options: { outcome_ids: String(outcomeA) }, pagination: { returnAll: true } },
		});
		expect(byOutcome).toHaveLength(12);
		expect(new Set(byOutcome.map(outcomeOf))).toEqual(new Set([outcomeA]));

		const byGroup = await runOk({
			resource: 'outcomeResult',
			operation: 'getAll',
			params: { courseId, options: { outcome_group_id: groupId }, pagination: { returnAll: true } },
		});
		expect(ids(byGroup)).toEqual(ids(byOutcome));

		const [section] = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/sections`);
		const bySection = await runOk({
			resource: 'outcomeResult',
			operation: 'getAll',
			params: { courseId, options: { section_id: section.id }, pagination: { returnAll: true } },
		});
		expect(bySection).toHaveLength(24);
	});

	it('getAll: a student without results yields no items; Canvas explains invalid filters', async () => {
		const none = await runNode({
			resource: 'outcomeResult',
			operation: 'getAll',
			params: { courseId, options: { user_ids: String(course.studentIds[12]) } },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
		expect(none.error).toEqual([]);

		const cases: Array<[Json, string]> = [
			[{ user_ids: fx('adminUserId') }, "can only include id's of users in the outcome context"],
			[{ outcome_ids: String(outcomeA), outcome_group_id: groupId }, "can't filter by both outcome_ids and outcome_group_id"],
			[{ user_ids: String(assessed[0]), section_id: '1' }, 'cannot specify both user_ids and section_id'],
			[{ outcome_ids: '99999999' }, 'can only include id'],
		];
		for (const [options, message] of cases) {
			const result = await runNode({
				resource: 'outcomeResult',
				operation: 'getAll',
				params: { courseId, options, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'outcomeResult', operation: 'getAll' });
			expect(String(result.error[0].errorMessage)).toContain(message);
		}
	});

	it('getRollups: one item per student, across pages', async () => {
		// Sorted by student, which is also what makes Canvas page the rollups at all:
		// unsorted, every page repeats all of them.
		const expected = await allRollups('?sort_by=student');
		// 13 sandbox students and the student persona.
		expect(expected).toHaveLength(14);

		const defaults = await runOk({ resource: 'outcomeResult', operation: 'getRollups', params: { courseId } });
		expect(defaults.map(userOf)).toEqual(expected.map(userOf));
		expect(new Set(defaults.map(userOf)).size).toBe(14);
		expect(defaults[0]).not.toHaveProperty('rollups');
		const student = defaults.find((r) => userOf(r) === assessed[3]) as Json;
		expect((student.scores as Json[]).map((s) => [Number((s.links as Json).outcome), s.score]).sort()).toEqual(
			[
				[outcomeA, 3],
				[outcomeB, 1],
			].sort(),
		);
		expect((defaults.find((r) => userOf(r) === course.studentIds[12]) as Json).scores).toEqual([]);

		const twoPages = await runOk({
			resource: 'outcomeResult',
			operation: 'getRollups',
			persona: 'teacher',
			params: { courseId, pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(twoPages.map(userOf)).toEqual(expected.slice(0, 10).map(userOf));

		const all = await runOk({ resource: 'outcomeResult', operation: 'getRollups', params: { courseId, pagination: { returnAll: true } } });
		expect(all.map(userOf)).toEqual(expected.map(userOf));
	});

	it('getRollups: filters, exclusions and sorting', async () => {
		const withScores = await runOk({
			resource: 'outcomeResult',
			operation: 'getRollups',
			params: { courseId, options: { exclude: ['missing_user_rollups'] }, pagination: { returnAll: true } },
		});
		expect(withScores.map(userOf).sort()).toEqual([...assessed].sort());

		const sorted = await runOk({
			resource: 'outcomeResult',
			operation: 'getRollups',
			params: {
				courseId,
				options: { sort_by: 'outcome', sort_outcome_id: String(outcomeA), sort_order: 'desc', exclude: ['missing_user_rollups'], outcome_ids: String(outcomeA) },
				pagination: { returnAll: true },
			},
		});
		const sortedScores = sorted.map((r) => Number((r.scores as Json[])[0].score));
		expect(sortedScores).toEqual([...sortedScores].sort((a, b) => b - a));
		expect(sortedScores).toHaveLength(12);
		for (const rollup of sorted) {
			expect((rollup.scores as Json[]).map((s) => Number((s.links as Json).outcome))).toEqual([outcomeA]);
		}

		const byStudent = await runOk({
			resource: 'outcomeResult',
			operation: 'getRollups',
			params: { courseId, options: { sort_by: 'student', sort_order: 'desc', user_ids: `${assessed[0]},${assessed[1]},${assessed[2]}` } },
		});
		expect(byStudent.map(userOf)).toEqual([assessed[2], assessed[1], assessed[0]]);

		const byGroupAndSection = await runOk({
			resource: 'outcomeResult',
			operation: 'getRollups',
			items: [{ group: Number(groupId), section: (await canvas().getAll<Json>(`/api/v1/courses/${courseId}/sections`))[0].id }],
			params: {
				courseId,
				options: { outcome_group_id: '={{ $json.group }}', section_id: '={{ $json.section }}', add_defaults: true },
				pagination: { returnAll: true },
			},
		});
		expect(byGroupAndSection).toHaveLength(14);
		for (const rollup of byGroupAndSection) {
			for (const score of rollup.scores as Json[]) expect(Number((score.links as Json).outcome)).toBe(outcomeA);
		}
	});

	it('getRollups: aggregated for the course, by mean and by median', async () => {
		const values = assessed.map((id) => scores.get(id)?.[0] as number);
		const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
		const ordered = [...values].sort((a, b) => a - b);
		const median = (ordered[5] + ordered[6]) / 2;

		const [byMean] = await runOk({
			resource: 'outcomeResult',
			operation: 'getRollups',
			params: { courseId, options: { aggregate: 'course', outcome_ids: String(outcomeA) } },
		});
		expect(byMean.links).toMatchObject({ course: courseId });
		expect((byMean.scores as Json[])[0]).toMatchObject({ links: { outcome: String(outcomeA) }, count: 12 });
		expect(Number((byMean.scores as Json[])[0].score)).toBeCloseTo(mean, 1);

		const aggregated = await runOk({
			resource: 'outcomeResult',
			operation: 'getRollups',
			persona: 'teacher',
			params: { courseId, options: { aggregate: 'course', aggregate_stat: 'median', outcome_ids: String(outcomeA) } },
		});
		expect(aggregated).toHaveLength(1);
		expect(Number((aggregated[0].scores as Json[])[0].score)).toBeCloseTo(median, 1);
	});

	it('getContributingScores: the alignments of an outcome and the scores students got on them', async () => {
		const [all] = await runOk({ resource: 'outcomeResult', operation: 'getContributingScores', params: { courseId, outcomeId: outcomeA } });
		expect(all.outcome).toMatchObject({ id: String(outcomeA), title: 'Outcome A (in a group)' });
		// The outcome is aligned with the rubric and, through it, with the assignment.
		expect((all.alignments as Json[]).map((a) => a.associated_asset_type).sort()).toEqual(['Assignment', 'Rubric']);
		expect((all.alignments as Json[]).find((a) => a.associated_asset_type === 'Assignment')).toMatchObject({ associated_asset_id: assignmentId });
		const allScores = all.scores as Json[];
		expect(allScores).toHaveLength(12);
		expect(allScores.find((s) => Number(s.user_id) === assessed[3])).toMatchObject({ score: 3 });

		const [some] = await runOk({
			resource: 'outcomeResult',
			operation: 'getContributingScores',
			persona: 'teacher',
			params: {
				courseId: Number(courseId),
				outcomeId: String(outcomeB),
				options: { user_ids: `${assessed[1]}, ${assessed[2]}`, only_assignment_alignments: true, show_unpublished_assignments: true },
			},
		});
		expect(some.outcome).toMatchObject({ id: String(outcomeB) });
		expect((some.alignments as Json[]).map((a) => a.associated_asset_type)).toEqual(['Assignment']);
		expect((some.scores as Json[]).map((s) => [Number(s.user_id), s.score]).sort()).toEqual(
			[
				[assessed[1], scores.get(assessed[1])?.[1]],
				[assessed[2], scores.get(assessed[2])?.[1]],
			].sort(),
		);
	});

	it('errors: an outcome that is not linked into the course; students need their own ID', async () => {
		const foreign = await runNode({
			resource: 'outcomeResult',
			operation: 'getContributingScores',
			params: { courseId, outcomeId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(foreign.success).toEqual([]);
		expect(foreign.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'getContributingScores' });
		expect(String(foreign.error[0].errorMessage)).toContain('outcome not found in this context');

		for (const operation of ['getAll', 'getRollups', 'getContributingScores']) {
			const result = await runNode({
				resource: 'outcomeResult',
				operation,
				persona: 'student',
				params: { courseId, outcomeId: outcomeA, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'outcomeResult', operation });
		}

		// A student may ask for their own results.
		const own = await runNode({
			resource: 'outcomeResult',
			operation: 'getRollups',
			persona: 'student',
			params: { courseId, options: { user_ids: fx('studentUserId') } },
		});
		expect(own.error).toEqual([]);
		expect(own.success.map(userOf)).toEqual([Number(fx('studentUserId'))]);
	});
});
