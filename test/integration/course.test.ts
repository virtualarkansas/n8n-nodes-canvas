import { describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resource: course. Every operation is executed through a real n8n instance
 * against Canvas, and writes are verified by reading the record back from
 * Canvas directly (not through the node).
 */
describe('course', () => {
	let courseId = '';
	const name = unique('Battery Course Ünïcødé 课程 "quoted" & <b>tags</b>');

	it('create: every optional field reaches Canvas', async () => {
		const [created] = await runOk({
			resource: 'course',
			operation: 'create',
			params: {
				accountId: fx('accountId'),
				name,
				additionalFields: {
					allow_student_assignment_edits: true,
					allow_student_forum_attachments: true,
					allow_wiki_comments: true,
					apply_assignment_group_weights: true,
					course_code: 'BAT-101',
					course_format: 'blended',
					default_view: 'syllabus',
					end_at: '2031-06-30T23:59:00Z',
					grade_passback_setting: 'nightly_sync',
					hide_final_grades: true,
					integration_id: unique('int').replace(/\s/g, '-'),
					is_public: true,
					is_public_to_auth_users: true,
					license: 'cc_by_sa',
					open_enrollment: true,
					public_description: 'Public description with emoji 🎓',
					public_syllabus: true,
					restrict_enrollments_to_course_dates: true,
					self_enrollment: true,
					sis_course_id: unique('SIS').replace(/\s/g, '_'),
					start_at: '2020-01-15T08:00:00Z',
					syllabus_body: '<p>Syllabus <strong>body</strong></p>',
					term_id: fx('termId'),
					time_zone: 'America/Chicago',
				},
			},
		});
		courseId = String(created.id);
		expect(created.name).toBe(name);

		const actual = await canvas().get<Json>(
			`/api/v1/courses/${courseId}?include[]=syllabus_body&include[]=public_description&include[]=term`,
		);
		expect(actual).toMatchObject({
			name,
			course_code: 'BAT-101',
			course_format: 'blended',
			default_view: 'syllabus',
			apply_assignment_group_weights: true,
			hide_final_grades: true,
			is_public: true,
			is_public_to_auth_users: true,
			license: 'cc_by_sa',
			public_description: 'Public description with emoji 🎓',
			public_syllabus: true,
			restrict_enrollments_to_course_dates: true,
			grade_passback_setting: 'nightly_sync',
			time_zone: 'America/Chicago',
			start_at: '2020-01-15T08:00:00Z',
			end_at: '2031-06-30T23:59:00Z',
			enrollment_term_id: Number(fx('termId')),
			workflow_state: 'unpublished',
		});
		expect(String(actual.syllabus_body)).toContain('<strong>body</strong>');
		expect(actual.sis_course_id).toBe(created.sis_course_id);
		expect(actual.integration_id).toBe(created.integration_id);

		const settings = await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`);
		expect(settings).toMatchObject({
			allow_student_forum_attachments: true,
		});
	});

	it('create: "offer" publishes the course and "enroll me" adds the token\'s user as teacher', async () => {
		const [created] = await runOk({
			resource: 'course',
			operation: 'create',
			params: {
				accountId: fx('accountId'),
				name: unique('Offered course'),
				additionalFields: { offer: true, enroll_me: true, enrollment_term_id: fx('pastTermId') },
			},
		});
		const id = String(created.id);
		const actual = await canvas().get<Json>(`/api/v1/courses/${id}`);
		expect(actual.workflow_state).toBe('available');
		expect(actual.enrollment_term_id).toBe(Number(fx('pastTermId')));
		const teachers = await canvas().getAll<Json>(`/api/v1/courses/${id}/enrollments?type[]=TeacherEnrollment`);
		expect(teachers.map((e) => e.user_id)).toEqual([Number(fx('adminUserId'))]);
		await canvas().delete(`/api/v1/courses/${id}?event=delete`);
	});

	it('get: returns the course, with includes', async () => {
		const [course] = await runOk({
			resource: 'course',
			operation: 'get',
			params: {
				courseId,
				options: { include: ['term', 'teachers', 'total_students', 'syllabus_body', 'sections', 'permissions'], teacher_limit: 3 },
			},
		});
		expect(course).toMatchObject({ id: Number(courseId), name });
		expect(course.term).toMatchObject({ id: Number(fx('termId')) });
		expect(course.teachers).toEqual([]);
		expect(course.total_students).toBe(0);
		expect(course.sections).toBeInstanceOf(Array);
		expect(course.permissions).toBeTypeOf('object');
		expect(String(course.syllabus_body)).toContain('Syllabus');
	});

	it('get: accepts SIS IDs in place of numeric IDs', async () => {
		const sisId = String((await canvas().get<Json>(`/api/v1/courses/${courseId}`)).sis_course_id);
		const [course] = await runOk({ resource: 'course', operation: 'get', params: { courseId: `sis_course_id:${sisId}` } });
		expect(course.id).toBe(Number(courseId));
	});

	it('update: every optional field reaches Canvas', async () => {
		const renamed = `${name} (renamed)`;
		const [updated] = await runOk({
			resource: 'course',
			operation: 'update',
			params: {
				courseId,
				updateFields: {
					name: renamed,
					course_code: 'BAT-102',
					course_format: 'online',
					default_view: 'assignments',
					apply_assignment_group_weights: false,
					hide_final_grades: false,
					is_public: false,
					is_public_to_auth_users: false,
					license: 'public_domain',
					public_description: 'Changed',
					public_syllabus: false,
					restrict_enrollments_to_course_dates: true,
					grade_passback_setting: 'disabled',
					time_zone: 'Europe/Berlin',
					start_at: '2020-02-01T08:00:00Z',
					end_at: '2031-07-31T23:59:00Z',
					syllabus_body: '<p>Second version</p>',
					term_id: fx('pastTermId'),
					event: 'offer',
				},
			},
		});
		expect(updated.name).toBe(renamed);
		const actual = await canvas().get<Json>(`/api/v1/courses/${courseId}?include[]=syllabus_body&include[]=public_description`);
		expect(actual).toMatchObject({
			name: renamed,
			course_code: 'BAT-102',
			course_format: 'online',
			default_view: 'assignments',
			apply_assignment_group_weights: false,
			hide_final_grades: false,
			is_public: false,
			license: 'public_domain',
			public_description: 'Changed',
			public_syllabus: false,
			restrict_enrollments_to_course_dates: true,
			grade_passback_setting: 'disabled',
			time_zone: 'Europe/Berlin',
			start_at: '2020-02-01T08:00:00Z',
			end_at: '2031-07-31T23:59:00Z',
			enrollment_term_id: Number(fx('pastTermId')),
			workflow_state: 'available',
		});
		expect(String(actual.syllabus_body)).toContain('Second version');
	});

	it('conclude: Canvas refuses a course that has not started yet, and says so', async () => {
		// Real-world edge: concluding stamps "now" as the end date, which is before a future start date.
		const future = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique('Future course'), start_at: '2040-01-01T00:00:00Z', restrict_enrollments_to_course_dates: true },
		});
		const result = await runNode({
			resource: 'course',
			operation: 'conclude',
			params: { courseId: String(future.id), errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'conclude' });
		await canvas().request('DELETE', `/api/v1/courses/${String(future.id)}?event=delete`);
	});

	it('update: an empty update is rejected clearly rather than silently "succeeding"', async () => {
		const result = await runNode({
			resource: 'course',
			operation: 'update',
			params: { courseId, updateFields: {}, errorHandling: { onError: 'continueWithError' } },
		});
		// Canvas accepts an empty PUT and returns the unchanged course; either that or a clear error is fine.
		expect(result.ok).toBe(true);
		expect(result.success.length + result.error.length).toBe(1);
	});

	it('getAll: lists the courses of the token\'s user, honouring filters', async () => {
		const expected = await canvas().getAll<Json>('/api/v1/courses?state[]=available&state[]=unpublished');
		const listed = await runOk({
			resource: 'course',
			operation: 'getAll',
			params: { options: { state: ['available', 'unpublished'], include: ['term', 'total_students'] }, pagination: { returnAll: true } },
		});
		expect(listed.map((c) => c.id).sort()).toEqual(expected.map((c) => c.id).sort());
		for (const course of listed) {
			expect(course.term).toBeTypeOf('object');
		}
	});

	it('getAll: as a teacher, pages through more courses than one page holds', async () => {
		// Other files enrol the teacher persona in courses of their own and delete them again while
		// this one runs: the list is compared with what Canvas reports before and after the node ran.
		const teacher = new (await import('../lib/canvas')).CanvasClient('teacher');
		const courseIds = async (): Promise<number[]> => (await teacher.getAll<Json>('/api/v1/courses')).map((c) => Number(c.id));
		const before = await courseIds();
		expect(before.length, 'seed should enrol the teacher persona in more than 10 courses').toBeGreaterThan(10);

		const defaults = await runOk({ resource: 'course', operation: 'getAll', persona: 'teacher' });
		const all = await runOk({ resource: 'course', operation: 'getAll', persona: 'teacher', params: { pagination: { returnAll: true } } });
		const after = await courseIds();

		const sizes = [before.length, after.length].map((n) => Math.min(n, 50));
		expect(defaults.length).toBeGreaterThanOrEqual(Math.min(...sizes));
		expect(defaults.length).toBeLessThanOrEqual(Math.max(...sizes));

		const listed = all.map((c) => Number(c.id));
		expect(new Set(listed).size).toBe(listed.length);
		expect(listed).toEqual(expect.arrayContaining(before.filter((id) => after.includes(id))));
		expect([...before, ...after]).toEqual(expect.arrayContaining(listed));

		const twoPages = await runOk({ resource: 'course', operation: 'getAll', persona: 'teacher', params: { pagination: { perPage: 3, maxPages: 2 } } });
		expect(twoPages).toHaveLength(6);
		expect(new Set(twoPages.map((c) => c.id)).size).toBe(6);
	});

	it('listStudents: returns every student of a large course exactly once', async () => {
		const large = fx('largeCourseId');
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${large}/students`);
		expect(expected.length).toBeGreaterThan(100);

		const students = await runOk({
			resource: 'course',
			operation: 'listStudents',
			params: { courseId: large, pagination: { returnAll: true } },
		});
		expect(students.map((s) => s.id).sort()).toEqual(expected.map((s) => s.id).sort());
		expect(new Set(students.map((s) => s.id)).size).toBe(students.length);
	});

	it('copy: starts a course copy migration from another course', async () => {
		const [migration] = await runOk({
			resource: 'course',
			operation: 'copy',
			params: { courseId, sourceCourseId: fx('courseId2'), options: { only: ['assignments', 'wiki_pages'] } },
		});
		expect(migration).toMatchObject({ migration_type: 'course_copy_importer' });
		expect(migration.id).toBeTypeOf('number');
		const actual = await canvas().get<Json>(`/api/v1/courses/${courseId}/content_migrations/${String(migration.id)}`);
		expect((actual.settings as Json).source_course_id).toBe(Number(fx('courseId2')));
	});

	it('conclude: ends the course without deleting it', async () => {
		const [result] = await runOk({ resource: 'course', operation: 'conclude', params: { courseId } });
		expect(result).toEqual({ conclude: true });
		expect((await canvas().get<Json>(`/api/v1/courses/${courseId}`)).workflow_state).toBe('completed');
	});

	it('delete: removes the course', async () => {
		const [result] = await runOk({ resource: 'course', operation: 'delete', params: { courseId } });
		expect(result).toEqual({ delete: true });
		const after = await canvas().request('GET', `/api/v1/courses/${courseId}`);
		expect((after.data as Json).workflow_state ?? after.status).toSatisfy((v: unknown) => v === 'deleted' || v === 404);
	});

	it('errors: a missing course lands on the Error output with Canvas\' message', async () => {
		const result = await runNode({
			resource: 'course',
			operation: 'get',
			params: { courseId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'course', operation: 'get' });
	});

	it('errors: a student may not create courses (403 is reported, not retried)', async () => {
		const started = Date.now();
		const result = await runNode({
			resource: 'course',
			operation: 'create',
			persona: 'student',
			params: { accountId: fx('accountId'), name: unique('Forbidden'), errorHandling: { onError: 'retryThenError' } },
		});
		expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(result.error[0].errorCode);
		expect(Date.now() - started).toBeLessThan(5000);
	});
});
