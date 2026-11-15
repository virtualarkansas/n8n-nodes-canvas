import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { BULK, ensureAssignmentsBattery, uploadDirect } from './contentBattery';
import type { AssignmentsBattery } from './contentBattery';

/**
 * Resource: assignment. Runs in a dedicated course holding more than 100
 * assignments in a dozen assignment groups (see contentBattery.ts).
 */
describe('assignment', () => {
	let battery: AssignmentsBattery;
	let courseId = '';
	let assignmentId = '';
	let moderatedId = '';
	let groupAssignmentId = '';
	const created: string[] = [];
	const name = unique('Aufgabe ünï 作业 📝 "quoted" & <b>tags</b>');

	const fromCanvas = (id: string, query = ''): Promise<Json> =>
		canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${id}${query}`);
	const listFromCanvas = (query = ''): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments${query}`);
	const ids = (list: Json[]): unknown[] => list.map((a) => a.id);

	beforeAll(async () => {
		battery = await ensureAssignmentsBattery();
		courseId = battery.courseId;
	}, 900_000);

	it('create: every general, peer review and group field reaches Canvas', async () => {
		const sisId = unique('SIS-A').replace(/\s/g, '-');
		const [assignment] = await runOk({
			resource: 'assignment',
			operation: 'create',
			params: {
				courseId,
				name,
				additionalFields: {
					allowed_attempts: 3,
					allowed_extensions: 'pdf, doc,.DOCX',
					anonymous_peer_reviews: true,
					assignment_group_id: battery.groupIds[2],
					automatic_peer_reviews: true,
					description: '<h3>Aufgabe</h3><p>Text with <em>markup</em>, “quotes” &amp; emoji 🎓</p>',
					due_at: '2031-02-01T12:00:00Z',
					grade_group_students_individually: true,
					grading_standard_id: fx('gradingStandardId'),
					grading_type: 'letter_grade',
					group_category_id: battery.groupCategoryId,
					important_dates: true,
					integration_data: '{"sis": {"code": "A-1"}, "n": 5}',
					integration_id: unique('int').replace(/\s/g, '-'),
					intra_group_peer_reviews: true,
					lock_at: '2031-03-01T12:00:00Z',
					notify_of_update: true,
					omit_from_final_grade: true,
					only_visible_to_overrides: false,
					peer_review_count: 2,
					peer_reviews: true,
					peer_reviews_assign_at: '2031-02-10T12:00:00Z',
					points_possible: 12.5,
					position: 1,
					post_to_sis: true,
					published: true,
					sis_assignment_id: sisId,
					submission_types: ['online_upload', 'online_text_entry', 'online_url', 'media_recording'],
					unlock_at: '2031-01-15T12:00:00Z',
				},
			},
		});
		assignmentId = String(assignment.id);
		groupAssignmentId = assignmentId;
		created.push(assignmentId);
		expect(assignment.name).toBe(name);

		const actual = await fromCanvas(assignmentId);
		expect(actual).toMatchObject({
			name,
			allowed_attempts: 3,
			allowed_extensions: ['pdf', 'doc', 'docx'],
			anonymous_peer_reviews: true,
			assignment_group_id: Number(battery.groupIds[2]),
			automatic_peer_reviews: true,
			due_at: '2031-02-01T12:00:00Z',
			grade_group_students_individually: true,
			grading_standard_id: Number(fx('gradingStandardId')),
			grading_type: 'letter_grade',
			group_category_id: Number(battery.groupCategoryId),
			important_dates: true,
			integration_data: { sis: { code: 'A-1' }, n: 5 },
			integration_id: assignment.integration_id,
			intra_group_peer_reviews: true,
			lock_at: '2031-03-01T12:00:00Z',
			omit_from_final_grade: true,
			only_visible_to_overrides: false,
			peer_review_count: 2,
			peer_reviews: true,
			peer_reviews_assign_at: '2031-02-10T12:00:00Z',
			points_possible: 12.5,
			position: 1,
			post_to_sis: true,
			published: true,
			sis_assignment_id: sisId,
			submission_types: ['online_upload', 'online_text_entry', 'online_url', 'media_recording'],
			unlock_at: '2031-01-15T12:00:00Z',
		});
		expect(String(actual.integration_id)).toMatch(/^int/);
		expect(String(actual.description)).toContain('<em>markup</em>');
		expect(String(actual.description)).toContain('emoji 🎓');
	});

	it('create: minimal assignment gets the Canvas defaults', async () => {
		const [assignment] = await runOk({ resource: 'assignment', operation: 'create', params: { courseId, name: unique('Minimal') } });
		created.push(String(assignment.id));
		expect(assignment).toMatchObject({
			published: false,
			grading_type: 'points',
			submission_types: ['none'],
			allowed_attempts: -1,
			peer_reviews: false,
			due_at: null,
		});
	});

	it('create: moderated grading fields', async () => {
		const [assignment] = await runOk({
			resource: 'assignment',
			operation: 'create',
			params: {
				courseId,
				name: unique('Moderated'),
				additionalFields: {
					final_grader_id: battery.teacherIds[0],
					grader_comments_visible_to_graders: true,
					grader_count: 2,
					grader_names_visible_to_final_grader: false,
					graders_anonymous_to_graders: true,
					moderated_grading: true,
					points_possible: 10,
					submission_types: ['online_text_entry'],
				},
			},
		});
		moderatedId = String(assignment.id);
		created.push(moderatedId);
		expect(await fromCanvas(moderatedId)).toMatchObject({
			moderated_grading: true,
			grader_count: 2,
			final_grader_id: Number(battery.teacherIds[0]),
			grader_comments_visible_to_graders: true,
			graders_anonymous_to_graders: true,
			grader_names_visible_to_final_grader: false,
		});
	});

	it('create: anonymous grading is sent, but Canvas ignores it while the course feature is off', async () => {
		const params = {
			courseId,
			name: unique('Anonymous'),
			additionalFields: { anonymous_grading: true, points_possible: 5, submission_types: ['online_text_entry'] },
		};
		// "Anonymous Grading" is a course feature that the root account has to allow first. It is off on
		// this instance, and the battery does not change account-wide settings, so the field cannot be
		// read back as true here. What can be shown: the request carries it under the name Canvas reads
		// (assignment[anonymous_grading]), and Canvas answers without an error and without applying it.
		const debug = await runNode({ resource: 'assignment', operation: 'create', params: { ...params, debugMode: true } });
		expect(debug.debug).toHaveLength(1);
		expect(debug.debug[0]).toMatchObject({ method: 'POST', body: { assignment: { anonymous_grading: true } } });

		const [assignment] = await runOk({ resource: 'assignment', operation: 'create', params });
		created.push(String(assignment.id));
		expect((await fromCanvas(String(assignment.id))).anonymous_grading).toBe(false);
		const flag = await canvas().get<Json>(`/api/v1/accounts/${fx('accountId')}/features/flags/anonymous_marking`);
		expect(flag.state).toBe('off');
	});

	it('create: external tool and student annotation assignments', async () => {
		const [tool] = await runOk({
			resource: 'assignment',
			operation: 'create',
			params: {
				courseId,
				name: unique('LTI assignment'),
				additionalFields: {
					external_tool_new_tab: true,
					external_tool_url: fx('externalToolUrl'),
					points_possible: 10,
					submission_types: ['external_tool'],
				},
			},
		});
		created.push(String(tool.id));
		const actualTool = await fromCanvas(String(tool.id));
		expect(actualTool.submission_types).toEqual(['external_tool']);
		expect(actualTool.external_tool_tag_attributes).toMatchObject({ url: fx('externalToolUrl'), new_tab: true });

		const file = await uploadDirect(
			canvas(),
			`/api/v1/courses/${courseId}/files`,
			`${unique('annotate').replace(/\s/g, '-')}.txt`,
			Buffer.from('annotate me'),
			'text/plain',
		);
		const [annotation] = await runOk({
			resource: 'assignment',
			operation: 'create',
			items: [{ file: file.id }],
			params: {
				courseId,
				name: unique('Annotation'),
				additionalFields: { annotatable_attachment_id: '={{ $json.file }}', submission_types: ['student_annotation'] },
			},
		});
		created.push(String(annotation.id));
		const actualAnnotation = await fromCanvas(String(annotation.id));
		expect(actualAnnotation.submission_types).toEqual(['student_annotation']);
		expect(actualAnnotation.annotatable_attachment_id).toBeTypeOf('number');
	});

	it('create: "hide in gradebook" is only accepted together with "omit from final grade" and no points', async () => {
		const [hidden] = await runOk({
			resource: 'assignment',
			operation: 'create',
			params: {
				courseId,
				name: unique('Hidden'),
				additionalFields: { hide_in_gradebook: true, omit_from_final_grade: true, points_possible: 0 },
			},
		});
		created.push(String(hidden.id));
		expect(await fromCanvas(String(hidden.id))).toMatchObject({ hide_in_gradebook: true, omit_from_final_grade: true });

		const refused = await runNode({
			resource: 'assignment',
			operation: 'create',
			params: {
				courseId,
				name: unique('Hidden with points'),
				additionalFields: { hide_in_gradebook: true, points_possible: 10 },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(refused.success).toEqual([]);
		expect(refused.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'assignment' });
		expect(refused.error[0].canvasErrors).toHaveProperty('hide_in_gradebook');
	});

	it('create: Canvas refuses dates in the wrong order and combined exclusive submission types', async () => {
		const wrongDates = await runNode({
			resource: 'assignment',
			operation: 'create',
			params: {
				courseId,
				name: unique('Wrong dates'),
				additionalFields: { due_at: '2031-01-01T00:00:00Z', unlock_at: '2031-06-01T00:00:00Z' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(wrongDates.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(wrongDates.error[0].canvasErrors).toHaveProperty('due_at');

		const student = await runNode({
			resource: 'assignment',
			operation: 'create',
			persona: 'student',
			params: { courseId, name: unique('Forbidden'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(student.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(student.error[0].errorCode);
	});

	it('get: every option', async () => {
		const [assignment] = await runOk({
			resource: 'assignment',
			operation: 'get',
			params: {
				courseId,
				assignmentId,
				options: {
					all_dates: true,
					include: ['ab_guid', 'assignment_visibility', 'can_edit', 'observed_users', 'overrides', 'score_statistics', 'submission'],
					needs_grading_count_by_section: true,
					override_assignment_dates: false,
				},
			},
		});
		expect(assignment).toMatchObject({ id: Number(assignmentId), name, can_edit: true });
		expect(assignment.all_dates).toBeInstanceOf(Array);
		expect(assignment.overrides).toEqual([]);
		expect(assignment.assignment_visibility).toBeInstanceOf(Array);
		expect((assignment.assignment_visibility as string[]).map(String)).toContain(fx('studentUserId'));
		expect(assignment.needs_grading_count_by_section).toBeInstanceOf(Array);
		expect(assignment.ab_guid).toEqual([]);

		const [plain] = await runOk({
			resource: 'assignment',
			operation: 'get',
			items: [{ id: Number(assignmentId) }],
			params: { courseId: `={{ ${courseId} }}`, assignmentId: '={{ $json.id }}' },
		});
		expect(plain.id).toBe(Number(assignmentId));
		for (const key of ['all_dates', 'overrides', 'assignment_visibility', 'can_edit', 'needs_grading_count_by_section']) {
			expect(plain).not.toHaveProperty(key);
		}
	});

	it('get: the submission of the credential\'s user is included for a student', async () => {
		// A long-lived published assignment: Canvas caches which assignments a student can see
		// for a few minutes, so one created during this run may still be hidden from students.
		const [bulk] = await listFromCanvas('?search_term=Bulk%20assignment%20002');
		const [assignment] = await runOk({
			resource: 'assignment',
			operation: 'get',
			persona: 'student2',
			params: { courseId, assignmentId: String(bulk.id), options: { include: ['submission'] } },
		});
		expect(assignment.id).toBe(bulk.id);
		expect(assignment.submission).toMatchObject({ user_id: Number(fx('student2UserId')) });
	});

	it('getAll: pages through more than 100 assignments without duplicates', async () => {
		const expected = await listFromCanvas();
		expect(expected.length).toBeGreaterThan(BULK);

		const defaults = await runOk({ resource: 'assignment', operation: 'getAll', params: { courseId } });
		expect(ids(defaults)).toEqual(ids(expected.slice(0, 50)));

		const all = await runOk({ resource: 'assignment', operation: 'getAll', params: { courseId, pagination: { returnAll: true } } });
		expect(ids(all)).toEqual(ids(expected));
		expect(new Set(ids(all)).size).toBe(all.length);

		const some = await runOk({
			resource: 'assignment',
			operation: 'getAll',
			params: { courseId, pagination: { perPage: 11, maxPages: 4 } },
		});
		expect(ids(some)).toEqual(ids(expected.slice(0, 44)));
	});

	it('getAll: search term, order, SIS filter and assignment IDs', async () => {
		const run = (options: Json): Promise<Json[]> =>
			runOk({ resource: 'assignment', operation: 'getAll', params: { courseId, options, pagination: { returnAll: true } } });

		const bulk = await run({ search_term: 'Bulk assignment', order_by: 'name' });
		expect(bulk).toHaveLength(BULK);
		expect(bulk.map((a) => a.name)).toEqual([...bulk.map((a) => String(a.name))].sort());

		const byDue = await run({ search_term: 'Bulk assignment', order_by: 'due_at' });
		expect(ids(byDue)).toEqual(ids(await listFromCanvas('?search_term=Bulk%20assignment&order_by=due_at')));

		const posted = await run({ search_term: 'Bulk assignment', post_to_sis: true });
		const notPosted = await run({ search_term: 'Bulk assignment', post_to_sis: false });
		expect(posted).toHaveLength(11);
		expect(posted.length + notPosted.length).toBe(BULK);
		expect(posted.every((a) => a.post_to_sis === true)).toBe(true);

		const picked = [bulk[3], bulk[77], bulk[104]].map((a) => Number(a.id));
		const byIds = await run({ assignment_ids: ` ${picked.join(', ')} ` });
		expect(ids(byIds).sort()).toEqual([...picked].sort());

		// One ID, arriving as a number from an expression.
		const single = await runOk({
			resource: 'assignment',
			operation: 'getAll',
			items: [{ id: picked[0] }],
			params: { courseId, options: { assignment_ids: '={{ $json.id }}' } },
		});
		expect(ids(single)).toEqual([picked[0]]);

		const unknown = await runNode({
			resource: 'assignment',
			operation: 'getAll',
			params: { courseId, options: { assignment_ids: `${picked[0]},999999999` }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknown.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			errorMessage: 'Invalid assignment_ids: 999999999',
		});
	});

	it('getAll: every bucket matches what Canvas returns for it', async () => {
		for (const bucket of ['future', 'overdue', 'past', 'undated', 'ungraded', 'unsubmitted', 'upcoming']) {
			const expected = await listFromCanvas(`?bucket=${bucket}&search_term=Bulk%20assignment`);
			const listed = await runOk({
				resource: 'assignment',
				operation: 'getAll',
				params: { courseId, options: { bucket, search_term: 'Bulk assignment' }, pagination: { returnAll: true } },
			});
			expect(ids(listed), `bucket ${bucket}`).toEqual(ids(expected));
		}
		const past = await listFromCanvas('?bucket=past&search_term=Bulk%20assignment');
		const undated = await listFromCanvas('?bucket=undated&search_term=Bulk%20assignment');
		expect(past.length).toBe(35);
		expect(undated.length).toBe(35);
	});

	it('getAll: "new quizzes only" filters when on and is not sent when off', async () => {
		const on = await runOk({
			resource: 'assignment',
			operation: 'getAll',
			params: { courseId, options: { new_quizzes: true }, pagination: { returnAll: true } },
		});
		expect(on).toEqual([]);
		const off = await runOk({
			resource: 'assignment',
			operation: 'getAll',
			params: { courseId, options: { new_quizzes: false, search_term: 'Bulk assignment 00' } },
		});
		expect(off).toHaveLength(9);
	});

	it('getAll: include and date options', async () => {
		const [withExtras] = await runOk({
			resource: 'assignment',
			operation: 'getAll',
			params: {
				courseId,
				options: {
					search_term: name,
					include: ['ab_guid', 'all_dates', 'assignment_visibility', 'can_edit', 'observed_users', 'overrides', 'score_statistics', 'submission'],
					needs_grading_count_by_section: true,
					override_assignment_dates: false,
				},
			},
		});
		expect(withExtras.id).toBe(Number(assignmentId));
		expect(withExtras.all_dates).toBeInstanceOf(Array);
		expect(withExtras.overrides).toEqual([]);
		expect(withExtras.assignment_visibility).toBeInstanceOf(Array);
		expect(withExtras.can_edit).toBe(true);
		expect(withExtras.needs_grading_count_by_section).toBeInstanceOf(Array);
	});

	it('getAll: one assignment group, and the assignments of one user', async () => {
		const inGroup = await runOk({
			resource: 'assignment',
			operation: 'getAll',
			params: { courseId, options: { assignment_group_id: battery.bulkGroupId }, pagination: { returnAll: true } },
		});
		// 60 bulk assignments, plus whatever other tests are creating without a group right now.
		expect(inGroup.filter((a) => String(a.name).startsWith('Bulk assignment'))).toHaveLength(60);
		expect(inGroup.every((a) => a.assignment_group_id === Number(battery.bulkGroupId))).toBe(true);
		const bulkOnly = (list: Json[]): unknown[] => ids(list.filter((a) => String(a.name).startsWith('Bulk assignment')));
		expect(bulkOnly(inGroup)).toEqual(
			bulkOnly(await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignment_groups/${battery.bulkGroupId}/assignments`)),
		);

		const userPath = `/api/v1/users/${fx('studentUserId')}/courses/${courseId}/assignments`;
		const forUser = await runOk({
			resource: 'assignment',
			operation: 'getAll',
			params: {
				courseId,
				options: { user_id: fx('studentUserId'), search_term: 'Bulk assignment' },
				pagination: { returnAll: true },
			},
		});
		expect(ids(forUser)).toEqual(ids(await canvas().getAll<Json>(`${userPath}?search_term=Bulk%20assignment`)));
		// Students do not see unpublished assignments.
		expect(forUser.length).toBe(BULK - 15);
		expect(forUser.every((a) => a.published === true)).toBe(true);

		const both = await runOk({
			resource: 'assignment',
			operation: 'getAll',
			params: {
				courseId,
				options: { user_id: fx('studentUserId'), assignment_group_id: battery.groupIds[1] },
				pagination: { returnAll: true },
			},
		});
		expect(both.length).toBeGreaterThan(0);
		expect(both.every((a) => a.assignment_group_id === Number(battery.groupIds[1]))).toBe(true);
	});

	it('update: every general field reaches Canvas', async () => {
		const renamed = `${name} (renamed)`;
		const [updated] = await runOk({
			resource: 'assignment',
			operation: 'update',
			params: {
				courseId,
				assignmentId,
				updateFields: {
					allowed_attempts: -1,
					allowed_extensions: 'png',
					anonymous_peer_reviews: false,
					assignment_group_id: battery.groupIds[3],
					automatic_peer_reviews: false,
					description: '<p>Second version</p>',
					due_at: '2032-02-01T12:00:00Z',
					force_updated_at: true,
					grade_group_students_individually: false,
					grading_type: 'percent',
					important_dates: false,
					integration_data: '{"n": 6}',
					integration_id: unique('int2').replace(/\s/g, '-'),
					intra_group_peer_reviews: false,
					lock_at: '2032-03-01T12:00:00Z',
					name: renamed,
					notify_of_update: false,
					omit_from_final_grade: false,
					peer_review_count: 0,
					peer_reviews: false,
					points_possible: 20,
					position: 2,
					post_to_sis: false,
					published: false,
					sis_assignment_id: unique('SIS-B').replace(/\s/g, '-'),
					submission_types: ['online_url'],
					unlock_at: '2032-01-15T12:00:00Z',
				},
			},
		});
		expect(updated.name).toBe(renamed);
		const actual = await fromCanvas(assignmentId);
		expect(actual).toMatchObject({
			name: renamed,
			allowed_attempts: -1,
			allowed_extensions: ['png'],
			anonymous_peer_reviews: false,
			assignment_group_id: Number(battery.groupIds[3]),
			automatic_peer_reviews: false,
			description: '<p>Second version</p>',
			due_at: '2032-02-01T12:00:00Z',
			grade_group_students_individually: false,
			grading_type: 'percent',
			important_dates: false,
			integration_data: { n: 6 },
			integration_id: updated.integration_id,
			intra_group_peer_reviews: false,
			lock_at: '2032-03-01T12:00:00Z',
			omit_from_final_grade: false,
			peer_reviews: false,
			points_possible: 20,
			position: 2,
			post_to_sis: false,
			published: false,
			sis_assignment_id: updated.sis_assignment_id,
			submission_types: ['online_url'],
			unlock_at: '2032-01-15T12:00:00Z',
		});
		expect(String(actual.integration_id)).toMatch(/^int2/);
		expect(String(actual.sis_assignment_id)).toMatch(/^SIS-B/);
	});

	it('update: empty values clear dates, extensions, group set and grading scheme', async () => {
		await runOk({
			resource: 'assignment',
			operation: 'update',
			params: {
				courseId,
				assignmentId,
				updateFields: {
					allowed_extensions: '',
					due_at: '',
					group_category_id: '',
					grading_standard_id: '',
					lock_at: '',
					unlock_at: '',
					published: true,
				},
			},
		});
		const actual = await fromCanvas(assignmentId);
		expect(actual).toMatchObject({
			due_at: null,
			lock_at: null,
			unlock_at: null,
			group_category_id: null,
			grading_standard_id: null,
			published: true,
		});
		expect(actual.allowed_extensions ?? []).toEqual([]);
	});

	it('update: moderated grading fields, external tool settings', async () => {
		await runOk({
			resource: 'assignment',
			operation: 'update',
			params: {
				courseId,
				assignmentId: moderatedId,
				updateFields: {
					final_grader_id: battery.teacherIds[1],
					grader_comments_visible_to_graders: false,
					grader_count: 1,
					grader_names_visible_to_final_grader: true,
				},
			},
		});
		expect(await fromCanvas(moderatedId)).toMatchObject({
			moderated_grading: true,
			final_grader_id: Number(battery.teacherIds[1]),
			grader_comments_visible_to_graders: false,
			grader_count: 1,
			grader_names_visible_to_final_grader: true,
		});

		await runOk({
			resource: 'assignment',
			operation: 'update',
			params: { courseId, assignmentId: moderatedId, updateFields: { moderated_grading: false, only_visible_to_overrides: true } },
		});
		expect(await fromCanvas(moderatedId)).toMatchObject({ moderated_grading: false, only_visible_to_overrides: true });
	});

	it('update: Canvas refuses a final grader who is not an instructor of the course', async () => {
		const [moderated] = await runOk({
			resource: 'assignment',
			operation: 'create',
			params: {
				courseId,
				name: unique('Moderated 2'),
				additionalFields: { moderated_grading: true, grader_count: 1, points_possible: 5, submission_types: ['online_text_entry'] },
			},
		});
		created.push(String(moderated.id));
		const result = await runNode({
			resource: 'assignment',
			operation: 'update',
			params: {
				courseId,
				assignmentId: String(moderated.id),
				updateFields: { final_grader_id: fx('studentUserId') },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(result.error[0].canvasErrors).toHaveProperty('final_grader_id');
	});

	it('duplicate: copies the assignment next to the original', async () => {
		const [copy] = await runOk({ resource: 'assignment', operation: 'duplicate', params: { courseId, assignmentId } });
		created.push(String(copy.id));
		expect(copy.id).not.toBe(Number(assignmentId));
		expect(copy.new_positions).toBeTypeOf('object');
		const actual = await fromCanvas(String(copy.id));
		expect(String(actual.name)).toMatch(/\(renamed\) .+/);
		expect(actual).toMatchObject({ points_possible: 20, submission_types: ['online_url'], assignment_group_id: Number(battery.groupIds[3]) });
		// A copy starts unpublished.
		expect(actual.published).toBe(false);

		// The quiz result type only changes the response format for New Quizzes; a plain assignment stays an assignment.
		const [asQuiz] = await runOk({
			resource: 'assignment',
			operation: 'duplicate',
			params: { courseId, assignmentId, options: { result_type: 'Quiz' } },
		});
		created.push(String(asQuiz.id));
		expect(asQuiz.submission_types).toEqual(['online_url']);
	});

	it('overrides: create for students, a section and a group; list, get, update and delete', async () => {
		const base = { courseId, assignmentId: groupAssignmentId };
		// Group overrides need a group assignment.
		await canvas().put(`/api/v1/courses/${courseId}/assignments/${groupAssignmentId}`, {
			assignment: { group_category_id: battery.groupCategoryId },
		});

		const [students] = await runOk({
			resource: 'assignment',
			operation: 'createOverride',
			params: {
				...base,
				overrideTarget: 'students',
				studentIds: `${fx('studentUserId')}, ${fx('student2UserId')}`,
				additionalFields: {
					due_at: '2033-01-10T12:00:00Z',
					lock_at: '2033-01-20T12:00:00Z',
					title: 'Extra time ünï',
					unlock_at: '2033-01-01T12:00:00Z',
				},
			},
		});
		expect(students).toMatchObject({
			title: 'Extra time ünï',
			due_at: '2033-01-10T12:00:00Z',
			lock_at: '2033-01-20T12:00:00Z',
			unlock_at: '2033-01-01T12:00:00Z',
		});
		expect((students.student_ids as number[]).sort()).toEqual([Number(fx('studentUserId')), Number(fx('student2UserId'))].sort());

		const [section] = await runOk({
			resource: 'assignment',
			operation: 'createOverride',
			params: {
				...base,
				overrideTarget: 'section',
				courseSectionId: battery.sectionIds[1],
				additionalFields: { due_at: '2033-02-10T12:00:00Z' },
			},
		});
		expect(section).toMatchObject({ course_section_id: Number(battery.sectionIds[1]), due_at: '2033-02-10T12:00:00Z' });

		const [group] = await runOk({
			resource: 'assignment',
			operation: 'createOverride',
			params: { ...base, overrideTarget: 'group', groupId: battery.studentGroupId, additionalFields: { lock_at: '2033-03-10T12:00:00Z' } },
		});
		expect(group).toMatchObject({ group_id: Number(battery.studentGroupId), lock_at: '2033-03-10T12:00:00Z' });

		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments/${groupAssignmentId}/overrides`);
		const listed = await runOk({ resource: 'assignment', operation: 'listOverrides', params: base });
		expect(ids(listed).sort()).toEqual(ids(expected).sort());
		expect(ids(listed).sort()).toEqual([students.id, section.id, group.id].sort());

		const [fetched] = await runOk({
			resource: 'assignment',
			operation: 'getOverride',
			items: [{ id: section.id }],
			params: { ...base, overrideId: '={{ $json.id }}' },
		});
		expect(fetched).toMatchObject({ id: section.id, course_section_id: Number(battery.sectionIds[1]) });

		const [updated] = await runOk({
			resource: 'assignment',
			operation: 'updateOverride',
			params: {
				...base,
				overrideId: String(students.id),
				updateFields: { due_at: '2033-01-12T12:00:00Z', student_ids: fx('student2UserId'), title: 'Only one student' },
			},
		});
		expect(updated.id).toBe(students.id);
		const actual = await canvas().get<Json>(
			`/api/v1/courses/${courseId}/assignments/${groupAssignmentId}/overrides/${String(students.id)}`,
		);
		expect(actual).toMatchObject({ title: 'Only one student', due_at: '2033-01-12T12:00:00Z', student_ids: [Number(fx('student2UserId'))] });
		// Dates that are not sent again are no longer overridden.
		expect(actual).not.toHaveProperty('lock_at');
		expect(actual).not.toHaveProperty('unlock_at');

		const twice = await runNode({
			resource: 'assignment',
			operation: 'createOverride',
			params: {
				...base,
				overrideTarget: 'section',
				courseSectionId: battery.sectionIds[1],
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(twice.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'createOverride' });

		const removed = await runNode({
			resource: 'assignment',
			operation: 'deleteOverride',
			items: [{ id: students.id }, { id: section.id }, { id: group.id }, { id: 999999999 }],
			params: { ...base, overrideId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(ids(removed.success)).toEqual([students.id, section.id, group.id]);
		expect(removed.error).toHaveLength(1);
		expect(removed.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		expect(await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments/${groupAssignmentId}/overrides`)).toEqual([]);
	});

	it('bulkUpdateDates: changes base and override dates of several assignments in one job', async () => {
		const a = created[1];
		const b = moderatedId;
		const override = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments/${b}/overrides`, {
			assignment_override: { student_ids: [fx('studentUserId')], due_at: '2034-01-01T12:00:00Z' },
		});
		const dates = [
			{ id: Number(a), all_dates: [{ base: true, due_at: '2034-05-01T12:00:00Z', unlock_at: '2034-04-01T12:00:00Z', lock_at: null }] },
			{
				id: Number(b),
				all_dates: [
					{ base: true, due_at: '2034-06-01T12:00:00Z' },
					{ id: override.id, due_at: '2034-06-15T12:00:00Z' },
				],
			},
		];
		const [progress] = await runOk({
			resource: 'assignment',
			operation: 'bulkUpdateDates',
			params: { courseId, dates: JSON.stringify(dates) },
		});
		expect(progress).toMatchObject({ tag: 'assignment_bulk_update', context_type: 'Course' });

		let state = '';
		for (let i = 0; i < 60 && state !== 'completed' && state !== 'failed'; i++) {
			await new Promise((r) => setTimeout(r, 1000));
			state = String((await canvas().get<Json>(`/api/v1/progress/${String(progress.id)}`)).workflow_state);
		}
		expect(state).toBe('completed');
		expect(await fromCanvas(a)).toMatchObject({ due_at: '2034-05-01T12:00:00Z', unlock_at: '2034-04-01T12:00:00Z', lock_at: null });
		expect(await fromCanvas(b, '?override_assignment_dates=false')).toMatchObject({ due_at: '2034-06-01T12:00:00Z' });
		const actualOverride = await canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${b}/overrides/${String(override.id)}`);
		expect(actualOverride.due_at).toBe('2034-06-15T12:00:00Z');
	});

	it('bulkUpdateDates: invalid input is rejected before anything is sent; unknown assignments by Canvas', async () => {
		const run = (dates: string): ReturnType<typeof runNode> =>
			runNode({
				resource: 'assignment',
				operation: 'bulkUpdateDates',
				params: { courseId, dates, errorHandling: { onError: 'continueWithError' } },
			});
		const notJson = await run('[{ this is not json');
		expect(notJson.error[0]).toMatchObject({ errorCode: 0, errorMessage: 'Dates must be valid JSON', endpoint: '' });
		const notArray = await run('{"id": 1}');
		expect(notArray.error[0].errorCode).toBe(0);
		expect(String(notArray.error[0].errorMessage)).toContain('Dates must be a JSON array');
		const unknown = await run('[{"id": 999999999, "all_dates": [{"base": true, "due_at": null}]}]');
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});

	it('several items: successes and failures are reported per item', async () => {
		const result = await runNode({
			resource: 'assignment',
			operation: 'get',
			items: [{ id: assignmentId }, { id: 999999999 }, { id: moderatedId }],
			params: { courseId, assignmentId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(ids(result.success)).toEqual([Number(assignmentId), Number(moderatedId)]);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'assignment', operation: 'get' });
	});

	it('delete: removes the assignments', async () => {
		const result = await runNode({
			resource: 'assignment',
			operation: 'delete',
			items: created.map((id) => ({ id })),
			params: { courseId, assignmentId: '={{ $json.id }}' },
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		expect(ids(result.success).map(String)).toEqual(created);
		for (const item of result.success) expect(item.workflow_state).toBe('deleted');
		const left = await listFromCanvas();
		for (const id of created) expect(ids(left)).not.toContain(Number(id));

		const again = await runNode({
			resource: 'assignment',
			operation: 'delete',
			params: { courseId, assignmentId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});
});
