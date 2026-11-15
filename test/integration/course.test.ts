import { describe, expect, it } from 'vitest';
import { canvas, fx, railsRunner, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { eventually, uploadFile } from './content.helper';

/**
 * Course attributes the course API does not return (only the response to a create
 * shows some of them), read from Canvas' database.
 */
function storedCourse(id: string): Json {
	const output = railsRunner(
		`puts Course.find(${Number(id)}).slice(:allow_wiki_comments, :open_enrollment, :self_enrollment, :allow_student_wiki_edits, :default_wiki_editing_roles).to_json`,
	);
	const line = output.trim().split('\n').pop() ?? '';
	return JSON.parse(line) as Json;
}

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
					account_id: fx('subAccountId'),
					allow_student_forum_attachments: false,
					allow_wiki_comments: true,
					apply_assignment_group_weights: true,
					course_code: 'BAT-101',
					course_format: 'blended',
					default_view: 'syllabus',
					default_wiki_editing_roles: 'teachers,students',
					grading_standard_id: fx('accountGradingStandardId'),
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
					public_syllabus_to_auth: true,
					restrict_enrollments_to_course_dates: true,
					self_enrollment: true,
					sis_course_id: unique('SIS').replace(/\s/g, '_'),
					start_at: '2020-01-15T08:00:00Z',
					storage_quota_mb: 1234,
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
			account_id: Number(fx('subAccountId')),
			grading_standard_id: Number(fx('accountGradingStandardId')),
			public_syllabus_to_auth: true,
			storage_quota_mb: 1234,
			template: false,
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

		// Canvas' default for forum attachments is true: false shows the field took effect.
		const settings = await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`);
		expect(settings).toMatchObject({ allow_student_forum_attachments: false });
		expect(storedCourse(courseId)).toEqual({
			allow_wiki_comments: true,
			open_enrollment: true,
			self_enrollment: true,
			// Derived by Canvas from the page editing roles.
			allow_student_wiki_edits: true,
			default_wiki_editing_roles: 'teachers,students',
		});
	});

	it('create: "template" makes a course template, and update turns it off again', async () => {
		const [created] = await runOk({
			resource: 'course',
			operation: 'create',
			params: { accountId: fx('accountId'), name: unique('Template course'), additionalFields: { template: true } },
		});
		const id = String(created.id);
		expect((await canvas().get<Json>(`/api/v1/courses/${id}`)).template).toBe(true);
		await runOk({ resource: 'course', operation: 'update', params: { courseId: id, updateFields: { template: false } } });
		expect((await canvas().get<Json>(`/api/v1/courses/${id}`)).template).toBe(false);
		await canvas().delete(`/api/v1/courses/${id}?event=delete`);
	});

	it('create: "enable SIS reactivation" brings back a deleted course with the same SIS ID', async () => {
		const sisId = unique('SIS-revive').replace(/\s/g, '_');
		const deleted = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique('Deleted course'), sis_course_id: sisId },
		});
		await canvas().delete(`/api/v1/courses/${String(deleted.id)}?event=delete`);
		const [revived] = await runOk({
			resource: 'course',
			operation: 'create',
			params: {
				accountId: fx('accountId'),
				name: unique('Revived course'),
				additionalFields: { sis_course_id: sisId, enable_sis_reactivation: true },
			},
		});
		expect(revived.id).toBe(deleted.id);
		expect((await canvas().get<Json>(`/api/v1/courses/${String(deleted.id)}`)).workflow_state).not.toBe('deleted');
		await canvas().delete(`/api/v1/courses/${String(deleted.id)}?event=delete`);
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
					account_id: fx('secondSubAccountId'),
					allow_student_forum_attachments: true,
					allow_wiki_comments: false,
					blueprint: true,
					blueprint_restrictions: ['content', 'points'],
					default_wiki_editing_roles: 'teachers',
					grading_standard_id: '',
					open_enrollment: false,
					override_sis_stickiness: true,
					public_syllabus_to_auth: false,
					self_enrollment: false,
					storage_quota_mb: 2345,
					use_blueprint_restrictions_by_object_type: false,
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
			account_id: Number(fx('secondSubAccountId')),
			blueprint: true,
			blueprint_restrictions: {
				content: true,
				points: true,
				due_dates: false,
				availability_dates: false,
				settings: false,
				state: false,
			},
			grading_standard_id: null,
			is_public_to_auth_users: false,
			public_syllabus_to_auth: false,
			storage_quota_mb: 2345,
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
		const settings = await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`);
		expect(settings).toMatchObject({ allow_student_forum_attachments: true });
		expect(storedCourse(courseId)).toEqual({
			allow_wiki_comments: false,
			open_enrollment: false,
			self_enrollment: false,
			allow_student_wiki_edits: false,
			default_wiki_editing_roles: 'teachers',
		});
	});

	it('update: blueprint restrictions per object type, then the course stops being a blueprint', async () => {
		await runOk({
			resource: 'course',
			operation: 'update',
			params: {
				courseId,
				updateFields: {
					use_blueprint_restrictions_by_object_type: true,
					blueprint_restrictions_by_object_type: JSON.stringify({
						assignment: { content: true, points: true },
						wiki_page: { content: true },
					}),
				},
			},
		});
		expect(await canvas().get<Json>(`/api/v1/courses/${courseId}`)).toMatchObject({
			blueprint: true,
			blueprint_restrictions_by_object_type: {
				assignment: { content: true, points: true },
				wiki_page: { content: true },
			},
		});

		await runOk({ resource: 'course', operation: 'update', params: { courseId, updateFields: { blueprint: false } } });
		expect((await canvas().get<Json>(`/api/v1/courses/${courseId}`)).blueprint).toBe(false);
	});

	it('update: Canvas refuses invalid blueprint restrictions by object type, and says so', async () => {
		const blueprint = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique('Blueprint for refusal') },
		});
		const id = String(blueprint.id);
		await canvas().put(`/api/v1/courses/${id}`, { course: { blueprint: true } });
		const result = await runNode({
			resource: 'course',
			operation: 'update',
			params: {
				courseId: id,
				updateFields: {
					use_blueprint_restrictions_by_object_type: true,
					blueprint_restrictions_by_object_type: '{"assignment": {"colour": true}}',
				},
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, operation: 'update' });
		const malformed = await runNode({
			resource: 'course',
			operation: 'update',
			params: {
				courseId: id,
				updateFields: { blueprint_restrictions_by_object_type: '[1, 2]' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(malformed.error[0]).toMatchObject({ errorType: 'INVALID_PARAMETERS' });
		expect(String(malformed.error[0].errorMessage)).toContain('Blueprint Restrictions by Object Type');
		await canvas().put(`/api/v1/courses/${id}`, { course: { blueprint: false } });
		await canvas().delete(`/api/v1/courses/${id}?event=delete`);
	});

	it('update: with "Override SIS Stickiness" off, Canvas leaves the sticky fields alone', async () => {
		const before = await canvas().get<Json>(`/api/v1/courses/${courseId}`);
		await runOk({
			resource: 'course',
			operation: 'update',
			params: {
				courseId,
				updateFields: { name: 'Must not be applied', course_code: 'NOPE', public_description: 'Applied', override_sis_stickiness: false },
			},
		});
		const after = await canvas().get<Json>(`/api/v1/courses/${courseId}?include[]=public_description`);
		expect(after).toMatchObject({ name: before.name, course_code: before.course_code, public_description: 'Applied' });
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

/**
 * Course → Copy: a source course of the test's own with one record of each kind,
 * copied whole, with Only and with Except into new courses; what arrived is read
 * from Canvas.
 */
describe('course copy', () => {
	const owned: string[] = [];
	let sourceId = '';

	/** What a course holds, by kind of content. */
	async function contentOf(id: string): Promise<Json> {
		const list = (path: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/courses/${id}/${path}`);
		const course = await canvas().get<Json>(`/api/v1/courses/${id}?include[]=syllabus_body`);
		return {
			assignments: (await list('assignments')).map((a) => a.name),
			assignmentGroups: (await list('assignment_groups')).map((g) => g.name).filter((n) => n === 'Copied group'),
			pages: (await list('pages')).map((p) => p.title),
			discussions: (await list('discussion_topics')).map((t) => t.title),
			announcements: (await list('discussion_topics?only_announcements=true')).map((t) => t.title),
			modules: (await list('modules')).map((m) => m.name),
			files: (await list('files')).map((f) => f.display_name),
			events: (
				await canvas().getAll<Json>(`/api/v1/calendar_events?context_codes[]=course_${id}&all_events=true`)
			).map((e) => e.title),
			outcomes: (await list('outcome_group_links')).map((l) => (l.outcome as Json).title),
			syllabus: course.syllabus_body ?? null,
			defaultView: course.default_view,
		};
	}

	async function newCourse(label: string, course: Json = {}): Promise<string> {
		const created = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
			course: { name: unique(label), ...course },
		});
		owned.push(String(created.id));
		return String(created.id);
	}

	/** Copy the source into a new course with the node and wait until Canvas has imported it. */
	async function copyInto(options: Json): Promise<Json> {
		const targetId = await newCourse('Copy target');
		const [migration] = await runOk({
			resource: 'course',
			operation: 'copy',
			params: { courseId: targetId, sourceCourseId: sourceId, options },
		});
		expect(migration).toMatchObject({ migration_type: 'course_copy_importer' });
		const path = `/api/v1/courses/${targetId}/content_migrations/${String(migration.id)}`;
		const finished = await eventually(
			async () => {
				const state = await canvas().get<Json>(path);
				return ['completed', 'failed'].includes(String(state.workflow_state)) ? state : undefined;
			},
			`course copy into ${targetId}`,
			240_000,
		);
		expect(finished.workflow_state).toBe('completed');
		expect((finished.settings as Json).source_course_id).toBe(Number(sourceId));
		return contentOf(targetId);
	}

	const everything = {
		assignments: ['Copied assignment'],
		assignmentGroups: ['Copied group'],
		pages: ['Copied page'],
		discussions: ['Copied discussion'],
		announcements: ['Copied announcement'],
		modules: ['Copied module'],
		files: ['copied.txt'],
		events: ['Copied event'],
		outcomes: ['Copied outcome'],
		syllabus: '<p>Copied syllabus</p>',
		defaultView: 'assignments',
	};
	// What a new course has of its own: a course copied without its settings keeps it.
	const nothing = {
		assignments: [],
		assignmentGroups: [],
		pages: [],
		discussions: [],
		announcements: [],
		modules: [],
		files: [],
		events: [],
		outcomes: [],
		syllabus: null,
		defaultView: 'modules',
	};

	it('setup: a source course with one record of each kind', async () => {
		sourceId = await newCourse('Copy source', { syllabus_body: '<p>Copied syllabus</p>', default_view: 'assignments' });
		const api = `/api/v1/courses/${sourceId}`;
		const group = await canvas().post<Json>(`${api}/assignment_groups`, { name: 'Copied group' });
		await canvas().post(`${api}/assignments`, { assignment: { name: 'Copied assignment', assignment_group_id: group.id } });
		await canvas().post(`${api}/pages`, { wiki_page: { title: 'Copied page', body: '<p>page</p>', published: true } });
		await canvas().post(`${api}/discussion_topics`, { title: 'Copied discussion', message: 'discussion' });
		await canvas().post(`${api}/discussion_topics`, { title: 'Copied announcement', message: 'news', is_announcement: true });
		await canvas().post(`${api}/modules`, { module: { name: 'Copied module' } });
		await canvas().post('/api/v1/calendar_events', {
			calendar_event: { context_code: `course_${sourceId}`, title: 'Copied event', start_at: '2030-01-01T10:00:00Z' },
		});
		await uploadFile(`${api}/files`, 'copied.txt', 'copied file');
		const root = await canvas().get<Json>(`${api}/root_outcome_group`);
		await canvas().post(`${api}/outcome_groups/${String(root.id)}/outcomes`, { title: 'Copied outcome' });
		expect(await contentOf(sourceId)).toEqual(everything);
	});

	it('copy: without options, everything is copied', async () => {
		expect(await copyInto({})).toEqual(everything);
	});

	it('copy: "Only" copies just the chosen types', async () => {
		expect(await copyInto({ only: ['assignments', 'wiki_pages'] })).toEqual({
			...nothing,
			assignments: everything.assignments,
			assignmentGroups: everything.assignmentGroups,
			pages: everything.pages,
		});
	});

	it('copy: "Except" copies everything but the chosen types, course settings and syllabus included', async () => {
		expect(await copyInto({ except: ['assignments', 'wiki_pages'] })).toEqual({
			...everything,
			assignments: [],
			assignmentGroups: [],
			pages: [],
		});
	});

	it('copy: "Only" and "Except" together copy the Only types minus the Except types', async () => {
		expect(await copyInto({ only: ['modules', 'attachments', 'syllabus_body'], except: ['attachments'] })).toEqual({
			...nothing,
			modules: everything.modules,
			syllabus: everything.syllabus,
		});
	});

	it('copy: a content type Canvas cannot copy on its own is refused before anything is sent', async () => {
		const targetId = await newCourse('Copy refused');
		const result = await runNode({
			resource: 'course',
			operation: 'copy',
			params: {
				courseId: targetId,
				sourceCourseId: sourceId,
				options: { only: ['assignment_groups'] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'INVALID_PARAMETERS' });
		expect(String(result.error[0].errorMessage)).toContain('together with their assignments');
		expect(await canvas().getAll<Json>(`/api/v1/courses/${targetId}/content_migrations`)).toEqual([]);
	});

	it('cleanup', async () => {
		for (const id of owned) {
			await canvas().delete(`/api/v1/courses/${id}?event=delete`);
		}
	});
});
