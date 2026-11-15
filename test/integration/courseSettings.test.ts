import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createSandboxAccount, deleteSandboxAccount, waitForProgress } from './support/gradingSandbox';

/**
 * Resource: course — settings and administration (Get/Update Settings, Get
 * Permissions, Batch Update, Reset Content, Restore Version, Preview HTML).
 *
 * Everything that changes a course runs on courses this file creates in a
 * sub-account of its own.
 */
describe('course: settings and administration', () => {
	let accountId = '';
	let courseId = '';
	const createdCourses: string[] = [];

	const createCourse = async (label: string, attributes: Json = {}, offer = false): Promise<Json> => {
		const course = await canvas().post<Json>(`/api/v1/accounts/${accountId}/courses`, {
			course: { name: unique(label), ...attributes },
			offer,
		});
		createdCourses.push(String(course.id));
		return course;
	};
	const enroll = (course: string, userId: string, type: string): Promise<Json> =>
		canvas().post<Json>(`/api/v1/courses/${course}/enrollments`, {
			enrollment: { user_id: userId, type, enrollment_state: 'active', notify: false },
		});
	const stateOf = async (course: string): Promise<unknown> =>
		(await canvas().get<Json>(`/api/v1/courses/${course}?include[]=all_courses`)).workflow_state;

	beforeAll(async () => {
		accountId = await createSandboxAccount('course-settings');
		const course = await createCourse('Settings battery course', {}, true);
		courseId = String(course.id);
		await enroll(courseId, fx('teacherUserId'), 'TeacherEnrollment');
		await enroll(courseId, fx('studentUserId'), 'StudentEnrollment');
	});

	afterAll(async () => {
		for (const id of createdCourses) {
			await canvas().request('DELETE', `/api/v1/courses/${id}?event=delete`);
		}
		await deleteSandboxAccount(accountId);
	});

	// ----------------------------------
	//         getSettings / updateSettings
	// ----------------------------------
	it('getSettings: returns the settings of the course, for admin, teacher and student', async () => {
		const actual = await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`);
		const [settings] = await runOk({ resource: 'course', operation: 'getSettings', params: { courseId } });
		expect(settings).toEqual(actual);
		expect(settings).toMatchObject({
			allow_student_discussion_topics: true,
			hide_final_grades: false,
			default_due_time: '23:59:59',
		});

		for (const persona of ['teacher', 'student']) {
			const [own] = await runOk({ resource: 'course', operation: 'getSettings', persona, params: { courseId } });
			expect(own).toEqual(actual);
		}
	});

	it('updateSettings: every setting reaches Canvas', async () => {
		const settings = {
			allow_final_grade_override: true,
			allow_student_anonymous_discussion_topics: true,
			allow_student_discussion_editing: false,
			allow_student_discussion_reporting: false,
			allow_student_discussion_topics: false,
			allow_student_forum_attachments: false,
			allow_student_organized_groups: false,
			conditional_release: true,
			default_due_time: '08:30:00',
			filter_speed_grader_by_student_group: true,
			hide_distribution_graphs: true,
			hide_final_grades: true,
			hide_sections_on_course_users_page: true,
			home_page_announcement_limit: 7,
			lock_all_announcements: true,
			restrict_student_future_view: true,
			restrict_student_past_view: true,
			show_announcements_on_home_page: true,
			syllabus_course_summary: false,
			usage_rights_required: true,
		};
		const [updated] = await runOk({ resource: 'course', operation: 'updateSettings', params: { courseId, settings } });
		const actual = await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`);
		expect(updated).toEqual(actual);
		// Canvas keeps "allow final grade override" to itself until the feature is on for the course (next test).
		expect(actual).toMatchObject({ ...settings, allow_final_grade_override: false });
	});

	it('updateSettings: "Allow Final Grade Override" shows once the course has the Final Grade Override feature', async () => {
		await canvas().put(`/api/v1/courses/${courseId}/features/flags/final_grades_override`, { state: 'on' });
		// The value stored by the previous test now counts.
		expect((await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`)).allow_final_grade_override).toBe(true);

		const [off] = await runOk({
			resource: 'course',
			operation: 'updateSettings',
			params: { courseId, settings: { allow_final_grade_override: false } },
		});
		expect(off.allow_final_grade_override).toBe(false);
		expect((await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`)).allow_final_grade_override).toBe(false);

		const [on] = await runOk({
			resource: 'course',
			operation: 'updateSettings',
			params: { courseId, settings: { allow_final_grade_override: true } },
		});
		expect(on.allow_final_grade_override).toBe(true);
		expect((await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`)).allow_final_grade_override).toBe(true);
	});

	it('updateSettings: switching every setting back (false values, "inherit") reaches Canvas too', async () => {
		const settings = {
			allow_final_grade_override: false,
			allow_student_anonymous_discussion_topics: false,
			allow_student_discussion_editing: true,
			allow_student_discussion_reporting: true,
			allow_student_discussion_topics: true,
			allow_student_forum_attachments: true,
			allow_student_organized_groups: true,
			conditional_release: false,
			default_due_time: 'inherit',
			filter_speed_grader_by_student_group: false,
			hide_distribution_graphs: false,
			hide_final_grades: false,
			hide_sections_on_course_users_page: false,
			home_page_announcement_limit: 0,
			lock_all_announcements: false,
			restrict_student_future_view: false,
			restrict_student_past_view: false,
			show_announcements_on_home_page: false,
			syllabus_course_summary: true,
			usage_rights_required: false,
		};
		const [updated] = await runOk({ resource: 'course', operation: 'updateSettings', params: { courseId, settings } });
		const actual = await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`);
		expect(updated).toEqual(actual);
		// "inherit" falls back to the default due time of the account.
		expect(actual).toMatchObject({ ...settings, default_due_time: '23:59:59' });
	});

	it('updateSettings: only the given settings change; values from expressions keep their type', async () => {
		const before = await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`);
		const [updated] = await runOk({
			resource: 'course',
			operation: 'updateSettings',
			items: [{ hide: true, limit: 4, time: '17:00' }],
			params: {
				courseId,
				settings: {
					hide_final_grades: '={{ $json.hide }}',
					home_page_announcement_limit: '={{ $json.limit }}',
					default_due_time: '={{ $json.time }}',
				},
			},
		});
		const expected = { ...before, hide_final_grades: true, home_page_announcement_limit: 4, default_due_time: '17:00:00' };
		expect(updated).toEqual(expected);
		expect(await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`)).toEqual(expected);

		// Nothing selected: Canvas answers with the unchanged settings.
		const [unchanged] = await runOk({ resource: 'course', operation: 'updateSettings', params: { courseId, settings: {} } });
		expect(unchanged).toEqual(expected);
	});

	it('updateSettings: Canvas reads times loosely; a due time it cannot read resets the setting to the account default', async () => {
		const [loose] = await runOk({
			resource: 'course',
			operation: 'updateSettings',
			params: { courseId, settings: { default_due_time: '5:45 pm' } },
		});
		expect(loose.default_due_time).toBe('17:45:00');

		const [updated] = await runOk({
			resource: 'course',
			operation: 'updateSettings',
			params: { courseId, settings: { default_due_time: 'half past nine' } },
		});
		expect(updated.default_due_time).toBe('23:59:59');
		expect((await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`)).default_due_time).toBe('23:59:59');
	});

	it('updateSettings: a teacher of the course may change settings, a student may not', async () => {
		const [byTeacher] = await runOk({
			resource: 'course',
			operation: 'updateSettings',
			persona: 'teacher',
			params: { courseId, settings: { hide_distribution_graphs: true } },
		});
		expect(byTeacher.hide_distribution_graphs).toBe(true);
		expect((await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`)).hide_distribution_graphs).toBe(true);

		const refused = await runNode({
			resource: 'course',
			operation: 'updateSettings',
			persona: 'student',
			params: { courseId, settings: { hide_distribution_graphs: false }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'course', operation: 'updateSettings' });
		expect((await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`)).hide_distribution_graphs).toBe(true);
	});

	it('getSettings / updateSettings: several courses in one run, by SIS ID; a missing course goes to the Error output', async () => {
		const sisId = unique('W2-SETTINGS').replace(/\s/g, '-');
		const second = await createCourse('Settings battery second course', { sis_course_id: sisId });
		const result = await runNode({
			resource: 'course',
			operation: 'updateSettings',
			items: [{ course: Number(courseId) }, { course: 'sis_course_id:does-not-exist' }, { course: `sis_course_id:${sisId}` }],
			params: {
				courseId: '={{ $json.course }}',
				settings: { lock_all_announcements: true },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toHaveLength(2);
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual([0, 2]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'updateSettings' });
		for (const id of [courseId, String(second.id)]) {
			expect((await canvas().get<Json>(`/api/v1/courses/${id}/settings`)).lock_all_announcements).toBe(true);
		}

		const read = await runNode({
			resource: 'course',
			operation: 'getSettings',
			items: [{ course: `sis_course_id:${sisId}` }, { course: 99999999 }],
			params: { courseId: '={{ $json.course }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(read.success).toHaveLength(1);
		expect(read.success[0].lock_all_announcements).toBe(true);
		expect(read.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'getSettings' });
	});

	it('getSettings: someone who is not in the course may not read its settings', async () => {
		const refused = await runNode({
			resource: 'course',
			operation: 'getSettings',
			persona: 'student2',
			params: { courseId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'getSettings' });
	});

	// ----------------------------------
	//         getPermissions
	// ----------------------------------
	it('getPermissions: answers true/false for each named permission of the token\'s user', async () => {
		const names = ['manage_grades', 'send_messages', 'read_roster', 'manage_course_content_edit', 'no_such_permission'];
		for (const persona of ['admin', 'teacher', 'student']) {
			const actual = await new CanvasClient(persona).get<Json>(
				`/api/v1/courses/${courseId}/permissions?${names.map((n) => `permissions[]=${n}`).join('&')}`,
			);
			const [permissions] = await runOk({
				resource: 'course',
				operation: 'getPermissions',
				persona,
				params: { courseId, permissions: ` ${names.join(' , ')} ` },
			});
			expect(permissions).toEqual(actual);
			expect(Object.keys(permissions).sort()).toEqual([...names].sort());
			expect(permissions.no_such_permission).toBe(false);
			expect(permissions.read_roster).toBe(true);
			expect(permissions.manage_grades).toBe(persona !== 'student');
		}
	});

	it('getPermissions: without names Canvas reports every permission; a single name from an expression works', async () => {
		const [everything] = await runOk({ resource: 'course', operation: 'getPermissions', persona: 'teacher', params: { courseId } });
		const actual = await new CanvasClient('teacher').get<Json>(`/api/v1/courses/${courseId}/permissions`);
		expect(everything).toEqual(actual);
		expect(Object.keys(everything).length).toBeGreaterThan(100);
		expect(everything).toMatchObject({ read: true, manage_grades: true, become_user: false });

		const [one] = await runOk({
			resource: 'course',
			operation: 'getPermissions',
			persona: 'student',
			items: [{ wanted: ['manage_grades', 'read_grades'] }],
			params: { courseId, permissions: '={{ $json.wanted }}' },
		});
		expect(one).toEqual({ manage_grades: false, read_grades: true });
	});

	it('getPermissions: no access to the course is an error, not "false"', async () => {
		const refused = await runNode({
			resource: 'course',
			operation: 'getPermissions',
			persona: 'student2',
			params: { courseId, permissions: 'read', errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'getPermissions' });
	});

	// ----------------------------------
	//         previewHtml
	// ----------------------------------
	it('previewHtml: returns the HTML as Canvas would keep it', async () => {
		const html =
			'<p><badhtml></badhtml>processed html <script>alert(1)</script>' +
			`<a href="/courses/${courseId}/files/1/download" onclick="steal()">file</a> <b>Ünï "quoted" &amp; 🎓</b></p>`;
		const [preview] = await runOk({ resource: 'course', operation: 'previewHtml', params: { courseId, html } });
		const actual = await canvas().post<Json>(`/api/v1/courses/${courseId}/preview_html`, { html });
		expect(preview).toEqual(actual);
		const processed = String(preview.html);
		expect(processed).not.toContain('<script');
		expect(processed).not.toContain('badhtml');
		expect(processed).not.toContain('onclick');
		expect(processed).toContain('processed html');
		expect(processed).toContain('<b>Ünï "quoted" &amp; 🎓</b>');
		// Links to course files are made absolute and annotated for API clients.
		expect(processed).toContain(`data-api-endpoint="${canvas().url}/api/v1/courses/${courseId}/files/1"`);

		const [asStudent] = await runOk({
			resource: 'course',
			operation: 'previewHtml',
			persona: 'student',
			params: { courseId, html: '<p onmouseover="x()">plain</p>' },
		});
		expect(asStudent).toEqual({ html: '<p>plain</p>' });
	});

	it('previewHtml: several items; no access to the course is refused', async () => {
		const result = await runNode({
			resource: 'course',
			operation: 'previewHtml',
			items: [{ text: '<em>one</em>' }, { text: '<script src="https://evil.example.com/x.js"></script>two' }],
			params: { courseId, html: '={{ $json.text }}' },
		});
		expect(result.success.map((item) => item.html)).toEqual(['<em>one</em>', 'two']);

		const refused = await runNode({
			resource: 'course',
			operation: 'previewHtml',
			persona: 'student2',
			params: { courseId, html: '<p>x</p>', errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'previewHtml' });
	});

	// ----------------------------------
	//         restoreVersion
	// ----------------------------------
	it('restoreVersion: brings back an earlier syllabus as a new version', async () => {
		for (const body of ['<p>First syllabus</p>', '<p>Second syllabus 🎓</p>', '<p>Third syllabus</p>']) {
			await canvas().put(`/api/v1/courses/${courseId}`, { course: { syllabus_body: body } });
		}
		const [course] = await runOk({
			resource: 'course',
			operation: 'get',
			params: { courseId, options: { include: ['syllabus_versions', 'syllabus_body'] } },
		});
		const versions = course.syllabus_versions as Json[];
		expect(versions.map((v) => v.syllabus_body)).toEqual(['<p>Third syllabus</p>', '<p>Second syllabus 🎓</p>', '<p>First syllabus</p>']);
		const second = versions[1];

		const [restored] = await runOk({
			resource: 'course',
			operation: 'restoreVersion',
			persona: 'teacher',
			items: [{ version: second.version }],
			params: { courseId, versionId: '={{ $json.version }}' },
		});
		expect(restored.id).toBe(Number(courseId));
		const after = await canvas().get<Json>(`/api/v1/courses/${courseId}?include[]=syllabus_versions&include[]=syllabus_body`);
		expect(after.syllabus_body).toBe('<p>Second syllabus 🎓</p>');
		const afterVersions = after.syllabus_versions as Json[];
		expect(afterVersions).toHaveLength(versions.length + 1);
		expect(afterVersions[0].syllabus_body).toBe('<p>Second syllabus 🎓</p>');
		expect((afterVersions[0].edited_by as Json).id).toBe(Number(fx('teacherUserId')));
	});

	it('restoreVersion: an unknown version is "not found"; a student may not restore', async () => {
		const unknown = await runNode({
			resource: 'course',
			operation: 'restoreVersion',
			params: { courseId, versionId: '9999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknown.success).toEqual([]);
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'restoreVersion' });

		const refused = await runNode({
			resource: 'course',
			operation: 'restoreVersion',
			persona: 'student',
			params: { courseId, versionId: '1', errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'restoreVersion' });
		expect((await canvas().get<Json>(`/api/v1/courses/${courseId}?include[]=syllabus_body`)).syllabus_body).toBe(
			'<p>Second syllabus 🎓</p>',
		);
	});

	// ----------------------------------
	//         batchUpdate
	// ----------------------------------
	describe('batchUpdate', () => {
		const batch: string[] = [];
		let sisId = '';
		let outsider = '';

		beforeAll(async () => {
			sisId = unique('W2-BATCH').replace(/\s/g, '-');
			batch.push(String((await createCourse('Batch course A')).id));
			batch.push(String((await createCourse('Batch course B', { sis_course_id: sisId })).id));
			batch.push(String((await createCourse('Batch course C')).id));
			// A course of the root account: not part of the sub-account the batch runs in.
			const other = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
				course: { name: unique('Batch course outside the account') },
			});
			outsider = String(other.id);
		});

		afterAll(async () => {
			if (outsider) await canvas().request('DELETE', `/api/v1/courses/${outsider}?event=delete`);
		});

		it('offer: publishes the listed courses (IDs typed with spaces, a SIS ID among them) and leaves the others alone', async () => {
			const [progress] = await runOk({
				resource: 'course',
				operation: 'batchUpdate',
				params: { accountId, courseIds: ` ${batch[0]} , sis_course_id:${sisId} `, event: 'offer' },
			});
			expect(progress).toMatchObject({ tag: 'course_batch_update', context_type: 'Account', context_id: Number(accountId) });
			expect(progress.id).toBeTypeOf('number');
			const finished = await waitForProgress(String(progress.id));
			expect(finished).toMatchObject({ workflow_state: 'completed', completion: 100, message: '2 courses processed' });
			expect(await stateOf(batch[0])).toBe('available');
			expect(await stateOf(batch[1])).toBe('available');
			expect(await stateOf(batch[2])).toBe('unpublished');
		});

		it('conclude: an array of IDs from an expression; a course outside the account is reported by the job, not updated', async () => {
			const [progress] = await runOk({
				resource: 'course',
				operation: 'batchUpdate',
				items: [{ courses: [Number(batch[0]), Number(batch[1]), Number(outsider)] }],
				params: { accountId, courseIds: '={{ $json.courses }}', event: 'conclude' },
			});
			const finished = await waitForProgress(String(progress.id));
			expect(finished.workflow_state).toBe('completed');
			expect(String(finished.message)).toContain('2 courses processed');
			expect(String(finished.message)).toContain(`The course was not found: ${outsider}`);
			expect(await stateOf(batch[0])).toBe('completed');
			expect(await stateOf(batch[1])).toBe('completed');
			expect(await stateOf(outsider)).toBe('unpublished');
		});

		it('delete, then undelete: restores the courses as unpublished courses', async () => {
			const [deletion] = await runOk({
				resource: 'course',
				operation: 'batchUpdate',
				params: { accountId, courseIds: batch.join(','), event: 'delete' },
			});
			expect((await waitForProgress(String(deletion.id))).message).toBe('3 courses processed');
			for (const id of batch) expect(await stateOf(id)).toBe('deleted');

			const [restore] = await runOk({
				resource: 'course',
				operation: 'batchUpdate',
				params: { accountId, courseIds: `${batch[0]},${batch[2]}`, event: 'undelete' },
			});
			expect((await waitForProgress(String(restore.id))).message).toBe('2 courses processed');
			expect(await stateOf(batch[0])).toBe('unpublished');
			expect(await stateOf(batch[1])).toBe('deleted');
			expect(await stateOf(batch[2])).toBe('unpublished');
		});

		it('several items start one job each', async () => {
			const result = await runNode({
				resource: 'course',
				operation: 'batchUpdate',
				items: [{ id: batch[0] }, { id: batch[2] }],
				params: { accountId, courseIds: '={{ $json.id }}', event: 'offer' },
			});
			expect(result.success).toHaveLength(2);
			expect(new Set(result.success.map((p) => p.id)).size).toBe(2);
			for (const progress of result.success) {
				expect((await waitForProgress(String(progress.id))).message).toBe('1 course processed');
			}
			expect(await stateOf(batch[0])).toBe('available');
			expect(await stateOf(batch[2])).toBe('available');
		});

		it('errors: no course IDs is refused by the node; a teacher may not batch update an account', async () => {
			const empty = await runNode({
				resource: 'course',
				operation: 'batchUpdate',
				params: { accountId, courseIds: ' , ', event: 'offer', errorHandling: { onError: 'continueWithError' } },
			});
			expect(empty.success).toEqual([]);
			expect(empty.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', operation: 'batchUpdate' });
			expect(String(empty.error[0].errorMessage)).toContain('at least one course ID');

			const refused = await runNode({
				resource: 'course',
				operation: 'batchUpdate',
				persona: 'teacher',
				params: { accountId, courseIds: batch[0], event: 'conclude', errorHandling: { onError: 'continueWithError' } },
			});
			expect(refused.success).toEqual([]);
			expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'batchUpdate' });
			expect(await stateOf(batch[0])).toBe('available');

			const missing = await runNode({
				resource: 'course',
				operation: 'batchUpdate',
				params: { accountId: '99999999', courseIds: batch[0], event: 'conclude', errorHandling: { onError: 'continueWithError' } },
			});
			expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		});
	});

	// ----------------------------------
	//         resetContent
	// ----------------------------------
	describe('resetContent', () => {
		it('replaces the course by an empty one that keeps name, sections and enrollments', async () => {
			const name = unique('Reset me — Ünï "quoted" & 课程');
			const original = await createCourse('ignored', { name, course_code: 'RESET-1' }, true);
			const originalId = String(original.id);
			const section = await canvas().post<Json>(`/api/v1/courses/${originalId}/sections`, {
				course_section: { name: 'Reset section B' },
			});
			await enroll(originalId, fx('teacherUserId'), 'TeacherEnrollment');
			await canvas().post(`/api/v1/courses/${originalId}/enrollments`, {
				enrollment: {
					user_id: fx('studentUserId'),
					type: 'StudentEnrollment',
					enrollment_state: 'active',
					course_section_id: section.id,
					notify: false,
				},
			});
			await canvas().post(`/api/v1/courses/${originalId}/assignments`, { assignment: { name: 'Will be gone', published: true } });
			await canvas().post(`/api/v1/courses/${originalId}/pages`, { wiki_page: { title: 'Will be gone too', body: '<p>x</p>' } });
			// (Enrolling the student also enrols the observer linked to that student.)
			const people = (await canvas().getAll<Json>(`/api/v1/courses/${originalId}/enrollments`))
				.map((e) => `${String(e.user_id)} ${String(e.type)} section ${String(e.course_section_id)}`)
				.sort();
			expect(people.length).toBeGreaterThanOrEqual(2);

			const [fresh] = await runOk({ resource: 'course', operation: 'resetContent', params: { courseId: originalId } });
			const freshId = String(fresh.id);
			createdCourses.push(freshId);
			expect(freshId).not.toBe(originalId);
			expect(fresh).toMatchObject({ name, course_code: 'RESET-1', account_id: Number(accountId) });

			// The original course is deleted ...
			expect(await stateOf(originalId)).toBe('deleted');
			// ... and the new one has the people and sections, but none of the content.
			const actual = await canvas().get<Json>(`/api/v1/courses/${freshId}`);
			expect(actual).toMatchObject({ name, workflow_state: 'unpublished' });
			const sections = await canvas().getAll<Json>(`/api/v1/courses/${freshId}/sections`);
			expect(sections.map((s) => s.id)).toContain(section.id);
			expect(sections).toHaveLength(2);
			const enrollments = await canvas().getAll<Json>(`/api/v1/courses/${freshId}/enrollments`);
			expect(
				enrollments.map((e) => `${String(e.user_id)} ${String(e.type)} section ${String(e.course_section_id)}`).sort(),
			).toEqual(people);
			expect(enrollments.find((e) => e.type === 'StudentEnrollment')).toMatchObject({
				user_id: Number(fx('studentUserId')),
				course_section_id: section.id,
			});
			expect(enrollments.find((e) => e.type === 'TeacherEnrollment')?.user_id).toBe(Number(fx('teacherUserId')));
			expect(await canvas().getAll<Json>(`/api/v1/courses/${freshId}/assignments`)).toEqual([]);
			expect(await canvas().getAll<Json>(`/api/v1/courses/${freshId}/pages`)).toEqual([]);
		});

		it('errors: a blueprint course cannot be reset; a student may not reset; a missing course is "not found"', async () => {
			const blueprint = await createCourse('Reset blueprint');
			await canvas().put(`/api/v1/courses/${String(blueprint.id)}`, { course: { blueprint: true } });
			const refusedBlueprint = await runNode({
				resource: 'course',
				operation: 'resetContent',
				params: { courseId: String(blueprint.id), errorHandling: { onError: 'continueWithError' } },
			});
			expect(refusedBlueprint.success).toEqual([]);
			expect(refusedBlueprint.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'resetContent' });
			expect(String(refusedBlueprint.error[0].errorMessage)).toContain('cannot reset_content on a blueprint');
			expect(await stateOf(String(blueprint.id))).toBe('unpublished');

			const refused = await runNode({
				resource: 'course',
				operation: 'resetContent',
				persona: 'student',
				params: { courseId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(refused.success).toEqual([]);
			expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'resetContent' });
			expect(await stateOf(courseId)).toBe('available');

			const missing = await runNode({
				resource: 'course',
				operation: 'resetContent',
				params: { courseId: '99999999', errorHandling: { onError: 'continueWithError' } },
			});
			expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		});
	});
});
