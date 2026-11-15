import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createPacedCourse, waitFor } from './pacing.fixture';
import { canvasSql } from './support/gradingSandbox';
import type { PacedCourse } from './pacing.fixture';

/**
 * Resource: coursePace. Runs on a course created for this file with Course
 * Pacing enabled; every write is verified by reading the pace back from Canvas.
 */
describe('coursePace', () => {
	let paced: PacedCourse;
	let courseId = '';
	let coursePaceId = '';
	let sectionPaceId = '';
	let studentPaceId = '';

	const readPace = async (id: string): Promise<Json> =>
		(await canvas().get<Json>(`/api/v1/courses/${courseId}/course_pacing/${id}`)).course_pace as Json;
	const itemsOf = (pace: Json): Json[] => (pace.modules as Json[]).flatMap((m) => m.items as Json[]);
	const durations = (pace: Json): Record<string, unknown> =>
		Object.fromEntries(itemsOf(pace).map((item) => [String(item.module_item_id), item.duration]));

	beforeAll(async () => {
		paced = await createPacedCourse('coursePace');
		courseId = paced.courseId;
	});

	afterAll(async () => {
		await paced?.cleanup();
	});

	it('getByContext: before any pace exists, returns an unsaved draft listing the module items', async () => {
		const [draft] = await runOk({ resource: 'coursePace', operation: 'getByContext', params: { courseId, paceContext: 'course' } });
		const pace = draft.course_pace as Json;
		expect(pace).toMatchObject({ id: null, course_id: Number(courseId), context_type: 'Course', workflow_state: 'unpublished' });
		expect(itemsOf(pace).map((item) => String(item.module_item_id))).toEqual(paced.moduleItemIds);
	});

	it('create: every optional field reaches Canvas (default pace of the course)', async () => {
		const [a, b, c] = paced.moduleItemIds;
		const [created] = await runOk({
			resource: 'coursePace',
			operation: 'create',
			params: {
				courseId,
				additionalFields: {
					context_type: 'Course',
					end_date: '2027-03-01T00:00:00Z',
					hard_end_dates: true,
					selected_days_to_skip: 'Fri, saturday ,sun',
					workflow_state: 'active',
				},
				moduleItems: {
					item: [
						{ module_item_id: a, duration: 3 },
						{ module_item_id: Number(b), duration: 5 },
						{ module_item_id: c, duration: 0 },
					],
				},
			},
		});
		const pace = created.course_pace as Json;
		coursePaceId = String(pace.id);
		expect(pace.id).toBeTypeOf('number');
		// Canvas publishes a new pace right away and reports the job.
		expect(created.progress).toMatchObject({ tag: 'course_pace_publish' });

		const actual = await waitFor(() => readPace(coursePaceId), (p) => p.workflow_state === 'active' && p.published_at !== null);
		expect(actual).toMatchObject({
			course_id: Number(courseId),
			course_section_id: null,
			user_id: null,
			context_type: 'Course',
			hard_end_dates: true,
			selected_days_to_skip: ['fri', 'sat', 'sun'],
			end_date_context: 'hard',
		});
		expect(String(actual.end_date)).toMatch(/^2027-03-01/);
		expect(durations(actual)).toEqual({ [a]: 3, [b]: 5, [c]: 0 });
	});

	it('create: section pace and student pace land on the right context', async () => {
		const [sectionPace] = await runOk({
			resource: 'coursePace',
			operation: 'create',
			params: {
				courseId,
				additionalFields: { context_type: 'Section', context_id: Number(paced.sectionId), selected_days_to_skip: 'sat,sun' },
				moduleItems: { item: paced.moduleItemIds.map((id) => ({ module_item_id: id, duration: 2 })) },
			},
		});
		sectionPaceId = String((sectionPace.course_pace as Json).id);
		expect(await readPace(sectionPaceId)).toMatchObject({
			course_section_id: Number(paced.sectionId),
			user_id: null,
			context_type: 'Section',
			context_id: Number(paced.sectionId),
		});

		const [studentPace] = await runOk({
			resource: 'coursePace',
			operation: 'create',
			params: { courseId, additionalFields: { context_type: 'Enrollment', context_id: paced.studentUserId } },
		});
		studentPaceId = String((studentPace.course_pace as Json).id);
		expect(await readPace(studentPaceId)).toMatchObject({ course_section_id: null, user_id: Number(paced.studentUserId), context_type: 'Enrollment' });
	});

	it('create: workflows saved with the old "User" context still create a student pace, not a second course pace', async () => {
		const [legacy] = await runOk({
			resource: 'coursePace',
			operation: 'create',
			params: { courseId, additionalFields: { context_type: 'User', context_id: paced.studentUserId } },
		});
		const id = String((legacy.course_pace as Json).id);
		expect(await readPace(id)).toMatchObject({ user_id: Number(paced.studentUserId), course_section_id: null });
		await canvas().request('DELETE', `/api/v1/courses/${courseId}/course_pacing/${id}`);
	});

	it('get: returns the pace with its publishing progress, for several input items', async () => {
		const result = await runNode({
			resource: 'coursePace',
			operation: 'get',
			items: [{ id: Number(coursePaceId) }, { id: 99999999 }, { id: Number(sectionPaceId) }],
			params: { courseId: Number(courseId), coursePaceId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((item) => (item.course_pace as Json).id)).toEqual([Number(coursePaceId), Number(sectionPaceId)]);
		expect(result.success[0]).toHaveProperty('progress');
		expect(durations(result.success[0].course_pace as Json)).toEqual(durations(await readPace(coursePaceId)));
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'coursePace', operation: 'get' });
	});

	it('getByContext: finds the pace of the course, a section and a student enrollment', async () => {
		const [forCourse] = await runOk({ resource: 'coursePace', operation: 'getByContext', params: { courseId, paceContext: 'course' } });
		expect((forCourse.course_pace as Json).id).toBe(Number(coursePaceId));

		const [forSection] = await runOk({
			resource: 'coursePace',
			operation: 'getByContext',
			params: { courseId, paceContext: 'section', sectionId: paced.sectionId },
		});
		expect((forSection.course_pace as Json).id).toBe(Number(sectionPaceId));

		const [forStudent] = await runOk({
			resource: 'coursePace',
			operation: 'getByContext',
			params: { courseId, paceContext: 'enrollment', enrollmentId: paced.studentEnrollmentId },
		});
		expect(forStudent.course_pace).toMatchObject({ id: Number(studentPaceId), user_id: Number(paced.studentUserId) });
	});

	it('update: every optional field reaches Canvas, including changed and added item durations', async () => {
		const before = await readPace(sectionPaceId);
		const [first, second] = itemsOf(before);
		const [updated] = await runOk({
			resource: 'coursePace',
			operation: 'update',
			params: {
				courseId,
				coursePaceId: sectionPaceId,
				updateFields: {
					end_date: '2027-05-20T00:00:00Z',
					hard_end_dates: true,
					selected_days_to_skip: 'mon',
					workflow_state: 'active',
				},
				moduleItems: {
					item: [
						{ id: String(first.id), module_item_id: String(first.module_item_id), duration: 9 },
						{ id: Number(second.id), module_item_id: Number(second.module_item_id), duration: 0 },
					],
				},
			},
		});
		expect((updated.course_pace as Json).id).toBe(Number(sectionPaceId));

		const actual = await readPace(sectionPaceId);
		expect(actual).toMatchObject({ hard_end_dates: true, selected_days_to_skip: ['mon'] });
		expect(String(actual.end_date)).toMatch(/^2027-05-20/);
		expect(durations(actual)).toEqual({
			...durations(before),
			[String(first.module_item_id)]: 9,
			[String(second.module_item_id)]: 0,
		});
		expect(itemsOf(actual)).toHaveLength(itemsOf(before).length);
	});

	it('update: an empty list of days clears the skipped days', async () => {
		await runOk({
			resource: 'coursePace',
			operation: 'update',
			params: { courseId, coursePaceId: sectionPaceId, updateFields: { selected_days_to_skip: '', hard_end_dates: false } },
		});
		expect(await readPace(sectionPaceId)).toMatchObject({ selected_days_to_skip: [], hard_end_dates: false });
	});

	it('publish: starts the publishing job for a pace', async () => {
		const [progress] = await runOk({ resource: 'coursePace', operation: 'publish', params: { courseId, coursePaceId: studentPaceId } });
		expect(progress).toMatchObject({ tag: 'course_pace_publish', context_type: 'CoursePace', context_id: Number(studentPaceId) });
		const finished = await waitFor(
			() => canvas().get<Json>(`/api/v1/progress/${String(progress.id)}`),
			(p) => p.workflow_state === 'completed' || p.workflow_state === 'failed',
		);
		expect(finished.workflow_state).toBe('completed');
		expect(await readPace(studentPaceId)).toMatchObject({ workflow_state: 'active' });
		expect((await readPace(studentPaceId)).published_at).not.toBeNull();
	});

	it('delete: Canvas refuses to delete the published default pace of the course', async () => {
		const result = await runNode({
			resource: 'coursePace',
			operation: 'delete',
			params: { courseId, coursePaceId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', resource: 'coursePace', operation: 'delete' });
		expect((await readPace(coursePaceId)).workflow_state).toBe('active');
	});

	it('delete: removes section and student paces', async () => {
		const result = await runNode({
			resource: 'coursePace',
			operation: 'delete',
			items: [{ pace: sectionPaceId }, { pace: studentPaceId }],
			params: { courseId, coursePaceId: '={{ $json.pace }}' },
		});
		expect(result.ok).toBe(true);
		expect(result.success.map((item) => (item.course_pace as Json).id)).toEqual([Number(sectionPaceId), Number(studentPaceId)]);
		for (const id of [sectionPaceId, studentPaceId]) {
			expect((await readPace(id)).workflow_state).toBe('deleted');
		}
		// The section falls back to the course pace again.
		const fallback = await canvas().get<Json>(`/api/v1/courses/${courseId}/course_pacing/new?course_section_id=${paced.sectionId}`);
		expect((fallback.course_pace as Json).id).not.toBe(Number(sectionPaceId));
	});

	it('create / update: "Exclude Weekends" is stored, but the selected days decide while "skip selected days" is on', async () => {
		const flag = await canvas().get<Json>(`/api/v1/accounts/${fx('accountId')}/features/flags/course_paces_skip_selected_days`);
		const skipSelectedDays = ['on', 'allowed_on'].includes(String(flag.state));
		const stored = (id: string): string => canvasSql(`SELECT exclude_weekends FROM course_paces WHERE id = ${id}`);

		const [created] = await runOk({
			resource: 'coursePace',
			operation: 'create',
			params: {
				courseId,
				additionalFields: { context_type: 'Section', context_id: Number(paced.sectionId), exclude_weekends: false, selected_days_to_skip: 'sat,sun' },
			},
		});
		const id = String((created.course_pace as Json).id);
		try {
			expect(stored(id)).toBe('f');
			// What Canvas reports (and schedules by) comes from the selected days while the feature is on.
			expect((await readPace(id)).exclude_weekends).toBe(skipSelectedDays);

			await runOk({
				resource: 'coursePace',
				operation: 'update',
				params: { courseId, coursePaceId: id, updateFields: { exclude_weekends: true, selected_days_to_skip: 'mon' } },
			});
			expect(stored(id)).toBe('t');
			expect((await readPace(id)).exclude_weekends).toBe(!skipSelectedDays);
		} finally {
			await canvas().request('DELETE', `/api/v1/courses/${courseId}/course_pacing/${id}`);
		}
	});

	it('errors: a course without Course Pacing answers 404; students are refused', async () => {
		const notPaced = await runNode({
			resource: 'coursePace',
			operation: 'getByContext',
			params: { courseId: fx('courseId'), paceContext: 'course', errorHandling: { onError: 'continueWithError' } },
		});
		expect(notPaced.success).toEqual([]);
		expect(notPaced.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'coursePace', operation: 'getByContext' });

		const created = await runNode({
			resource: 'coursePace',
			operation: 'create',
			persona: 'student',
			params: { courseId, additionalFields: { hard_end_dates: true }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(created.success).toEqual([]);
		expect(created.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'coursePace', operation: 'create' });
		expect([401, 403]).toContain(created.error[0].errorCode);
	});
});
