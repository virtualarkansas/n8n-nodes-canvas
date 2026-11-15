import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createPacedCourse, waitFor } from './pacing.fixture';
import type { PacedCourse } from './pacing.fixture';
import { sandboxStudents } from './support/gradingSandbox';

/**
 * Resource: coursePace — List Pace Contexts. Runs on a paced course of the
 * file's own with enough sections and students to need more than one page.
 */
describe('coursePace: listContexts', () => {
	let paced: PacedCourse;
	let courseId = '';
	let courseName = '';
	let coursePaceId = '';
	let sectionPaceId = '';
	const SECTIONS = 12;
	const STUDENTS = 12;
	/** Every active section of the course: [id, name]. */
	let sections: Array<{ id: number; name: string }> = [];
	/** Every student enrollment: enrollment ID, user and names. */
	let students: Array<{ enrollmentId: number; userId: number; name: string; sortableName: string }> = [];

	const list = (contextType: string, options: Json = {}, pagination?: Json, persona?: string): Promise<Json[]> =>
		runOk({
			resource: 'coursePace',
			operation: 'listContexts',
			persona,
			params: { courseId, contextType, options, ...(pagination ? { pagination } : {}) },
		});
	const itemIds = (contexts: Json[]): number[] => contexts.map((c) => Number(c.item_id));
	/** Canvas sorts names the way its database collates: case, spaces and punctuation do not count. */
	const collator = new Intl.Collator('en', { ignorePunctuation: true });
	const sorted = (values: number[]): number[] => [...values].sort((a, b) => a - b);

	beforeAll(async () => {
		paced = await createPacedCourse('paceContexts');
		courseId = paced.courseId;
		courseName = String((await canvas().get<Json>(`/api/v1/courses/${courseId}`)).name);

		const extraSections: number[] = [];
		for (let i = 1; i <= SECTIONS; i++) {
			const section = await canvas().post<Json>(`/api/v1/courses/${courseId}/sections`, {
				course_section: { name: `Pace section ${String(i).padStart(2, '0')}${i === 3 ? ' Ünï' : ''}` },
			});
			extraSections.push(Number(section.id));
		}
		const pool = await sandboxStudents(STUDENTS);
		for (const [index, userId] of pool.entries()) {
			await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
				enrollment: {
					user_id: userId,
					type: 'StudentEnrollment',
					enrollment_state: 'active',
					course_section_id: extraSections[index % extraSections.length],
					notify: false,
				},
			});
		}

		await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: { user_id: fx('teacherUserId'), type: 'TeacherEnrollment', enrollment_state: 'active', notify: false },
		});

		sections = (await canvas().getAll<Json>(`/api/v1/courses/${courseId}/sections`)).map((s) => ({ id: Number(s.id), name: String(s.name) }));
		const enrollments = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/enrollments?type[]=StudentEnrollment&include[]=user`);
		students = enrollments.map((e) => ({
			enrollmentId: Number(e.id),
			userId: Number(e.user_id),
			name: String((e.user as Json).name),
			sortableName: String((e.user as Json).sortable_name),
		}));
		expect(sections.length).toBeGreaterThan(SECTIONS);
		expect(students.length).toBeGreaterThan(STUDENTS);
	});

	afterAll(async () => {
		await paced?.cleanup();
	});

	it('type "Course": one entry for the course itself, without a pace before one is published', async () => {
		const contexts = await list('course');
		expect(contexts).toEqual([
			{
				name: courseName,
				type: 'Course',
				item_id: Number(courseId),
				associated_section_count: sections.length,
				associated_student_count: students.length,
				applied_pace: null,
				on_pace: null,
			},
		]);
	});

	it('type "Section": lists every active section, paged', async () => {
		const expected = (
			await canvas().getAll<Json>(`/api/v1/courses/${courseId}/pace_contexts?type=section`, 'pace_contexts')
		).map((c) => Number(c.item_id));
		expect(sorted(expected)).toEqual(sorted(sections.map((s) => s.id)));

		const defaults = await list('section');
		expect(itemIds(defaults)).toEqual(expected);
		for (const context of defaults) {
			const section = sections.find((s) => s.id === context.item_id);
			expect(context).toMatchObject({ type: 'CourseSection', name: section?.name, applied_pace: null, on_pace: null });
			expect(context.associated_student_count).toBeTypeOf('number');
		}

		const all = await list('section', {}, { returnAll: true });
		expect(itemIds(all)).toEqual(expected);
		expect(new Set(itemIds(all)).size).toBe(all.length);

		const firstPages = await list('section', {}, { perPage: 5, maxPages: 2 });
		expect(itemIds(firstPages)).toEqual(expected.slice(0, 10));
	});

	it('type "Section": sort, order, search term and context IDs take effect', async () => {
		const byName = [...sections].sort((a, b) => collator.compare(a.name, b.name));
		const ascending = await list('section', { sort: 'name' }, { returnAll: true });
		expect(ascending.map((c) => c.name)).toEqual(byName.map((s) => s.name));

		const descending = await list('section', { sort: 'name', order: 'desc' }, { returnAll: true });
		expect(descending.map((c) => c.name)).toEqual([...byName].reverse().map((s) => s.name));

		const searched = await list('section', { search_term: 'section 0', sort: 'name', order: 'asc' }, { returnAll: true });
		expect(searched.map((c) => c.name)).toEqual(byName.filter((s) => s.name.includes('section 0')).map((s) => s.name));
		expect(searched).toHaveLength(9);
		const unicode = await list('section', { search_term: 'ünï' });
		expect(unicode.map((c) => c.name)).toEqual(['Pace section 03 Ünï']);

		const wanted = [sections[1].id, sections[4].id];
		const picked = await list('section', { context_ids: ` ${wanted[0]} , ${wanted[1]} ` });
		expect(sorted(itemIds(picked))).toEqual(sorted(wanted));
		const fromExpression = await runOk({
			resource: 'coursePace',
			operation: 'listContexts',
			items: [{ wanted }],
			params: { courseId, contextType: 'section', options: { context_ids: '={{ $json.wanted }}' } },
		});
		expect(sorted(itemIds(fromExpression))).toEqual(sorted(wanted));

		const nothing = await runNode({
			resource: 'coursePace',
			operation: 'listContexts',
			params: { courseId, contextType: 'section', options: { search_term: unique('no such section') } },
		});
		expect(nothing.ok).toBe(true);
		expect(nothing.success).toEqual([]);
	});

	it('type "Student Enrollment": one entry per student, with the enrollment ID; paged, sorted and filtered', async () => {
		const expected = (
			await canvas().getAll<Json>(`/api/v1/courses/${courseId}/pace_contexts?type=student_enrollment`, 'pace_contexts')
		).map((c) => Number(c.item_id));
		expect(sorted(expected)).toEqual(sorted(students.map((s) => s.enrollmentId)));

		const all = await list('student_enrollment', {}, { returnAll: true }, 'teacher');
		expect(itemIds(all)).toEqual(expected);
		for (const context of all) {
			const student = students.find((s) => s.enrollmentId === context.item_id);
			expect(context).toMatchObject({ type: 'StudentEnrollment', name: student?.name, applied_pace: null });
		}

		const defaults = await list('student_enrollment');
		expect(itemIds(defaults)).toEqual(expected);
		const firstPages = await list('student_enrollment', {}, { perPage: 4, maxPages: 2 });
		expect(itemIds(firstPages)).toEqual(expected.slice(0, 8));

		const bySortableName = [...students].sort((a, b) => collator.compare(a.sortableName, b.sortableName));
		const ascending = await list('student_enrollment', { sort: 'name' }, { returnAll: true });
		expect(itemIds(ascending)).toEqual(bySortableName.map((s) => s.enrollmentId));
		const descending = await list('student_enrollment', { sort: 'name', order: 'desc' }, { returnAll: true });
		expect(itemIds(descending)).toEqual([...bySortableName].reverse().map((s) => s.enrollmentId));

		const target = students.find((s) => s.userId === Number(paced.studentUserId)) ?? students[0];
		const searched = await list('student_enrollment', { search_term: target.name });
		expect(itemIds(searched)).toEqual([target.enrollmentId]);

		const wanted = [students[2].enrollmentId, students[7].enrollmentId];
		const picked = await list('student_enrollment', { context_ids: wanted.join(',') });
		expect(sorted(itemIds(picked))).toEqual(sorted(wanted));
	});

	it('applied pace: a published course pace applies to everything, a section pace to its section', async () => {
		const coursePace = await canvas().post<Json>(`/api/v1/courses/${courseId}/course_pacing`, {
			course_pace: {
				workflow_state: 'active',
				course_pace_module_items_attributes: paced.moduleItemIds.map((id) => ({ module_item_id: id, duration: 2 })),
			},
		});
		coursePaceId = String((coursePace.course_pace as Json).id);
		const sectionPace = await canvas().post<Json>(`/api/v1/courses/${courseId}/course_pacing`, {
			course_pace: {
				workflow_state: 'active',
				context_type: 'Section',
				context_id: Number(paced.sectionId),
				course_pace_module_items_attributes: paced.moduleItemIds.map((id) => ({ module_item_id: id, duration: 4 })),
			},
		});
		sectionPaceId = String((sectionPace.course_pace as Json).id);
		for (const id of [coursePaceId, sectionPaceId]) {
			await waitFor(
				async () => (await canvas().get<Json>(`/api/v1/courses/${courseId}/course_pacing/${id}`)).course_pace as Json,
				(pace) => pace.workflow_state === 'active' && pace.published_at !== null,
			);
		}

		const [course] = await list('course');
		expect(course.applied_pace).toMatchObject({ name: courseName, type: 'Course' });
		expect((course.applied_pace as Json).last_modified).toBeTypeOf('string');
		expect((course.applied_pace as Json).duration).toBeTypeOf('number');

		const sectionContexts = await list('section', {}, { returnAll: true });
		const own = sectionContexts.find((c) => c.item_id === Number(paced.sectionId)) as Json;
		expect(own.applied_pace).toMatchObject({ type: 'Section' });
		const other = sectionContexts.find((c) => c.item_id !== Number(paced.sectionId)) as Json;
		expect(other.applied_pace).toMatchObject({ name: courseName, type: 'Course' });

		// The student of the paced section follows the section pace.
		const studentContexts = await list('student_enrollment', { context_ids: paced.studentEnrollmentId });
		expect(studentContexts).toHaveLength(1);
		expect(studentContexts[0]).toMatchObject({ item_id: Number(paced.studentEnrollmentId), type: 'StudentEnrollment' });
		expect(studentContexts[0].applied_pace).toMatchObject({ type: 'Section' });
	});

	it('several input items list different types in one run', async () => {
		const result = await runNode({
			resource: 'coursePace',
			operation: 'listContexts',
			items: [{ course: Number(courseId), ids: [sections[0].id] }, { course: 99999999, ids: [1] }, { course: Number(courseId), ids: [sections[2].id, sections[3].id] }],
			params: {
				courseId: '={{ $json.course }}',
				contextType: 'section',
				options: { context_ids: '={{ $json.ids }}' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.rawSuccess.map((item) => [(item.pairedItem as Json).item, item.json.item_id]).sort()).toEqual(
			[
				[0, sections[0].id],
				[2, sections[2].id],
				[2, sections[3].id],
			].sort(),
		);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'coursePace', operation: 'listContexts' });
	});

	it('errors: context IDs must be numbers; a course without Course Pacing is "not found"; students are refused', async () => {
		const invalid = await runNode({
			resource: 'coursePace',
			operation: 'listContexts',
			params: { courseId, contextType: 'section', options: { context_ids: '12,abc' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(invalid.success).toEqual([]);
		expect(invalid.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', operation: 'listContexts' });
		expect(String(invalid.error[0].errorMessage)).toContain('numeric IDs');

		const notPaced = await runNode({
			resource: 'coursePace',
			operation: 'listContexts',
			params: { courseId: fx('courseId'), contextType: 'course', errorHandling: { onError: 'continueWithError' } },
		});
		expect(notPaced.success).toEqual([]);
		expect(notPaced.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'listContexts' });

		await canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
			enrollment: { user_id: fx('studentUserId'), type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
		});
		const refused = await runNode({
			resource: 'coursePace',
			operation: 'listContexts',
			persona: 'student',
			params: { courseId, contextType: 'section', errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'listContexts' });
		expect([401, 403]).toContain(refused.error[0].errorCode);
	});
});
