import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { BULK, ensureAssignmentsBattery, ensureSubmissionsBattery, uploadDirect } from './contentBattery';
import type { AssignmentsBattery, SubmissionsBattery } from './contentBattery';

/**
 * Resource: assignment. Runs in a dedicated course holding more than 100
 * assignments in a dozen assignment groups (see contentBattery.ts). The group
 * members of a student are read from the submissions battery course, whose
 * group assignment has groups of several students.
 */
describe('assignment', () => {
	let battery: AssignmentsBattery;
	let submissions: SubmissionsBattery;
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
		submissions = await ensureSubmissionsBattery();
		courseId = battery.courseId;
	}, 1_200_000);

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

	it('update: external tool, annotation file, hide in gradebook, anonymous graders, peer review date', async () => {
		const api = `/api/v1/courses/${courseId}/assignments`;
		const make = async (assignment: Json): Promise<string> => {
			const record = await canvas().post<Json>(api, { assignment: { name: unique('Update target'), ...assignment } });
			created.push(String(record.id));
			return String(record.id);
		};
		const update = (id: string, updateFields: Json): Promise<Json[]> =>
			runOk({ resource: 'assignment', operation: 'update', params: { courseId, assignmentId: id, updateFields } });

		const toolId = await make({
			submission_types: ['external_tool'],
			points_possible: 5,
			external_tool_tag_attributes: { url: fx('externalToolUrl'), new_tab: false },
		});
		const newUrl = `${fx('externalToolUrl')}${fx('externalToolUrl').includes('?') ? '&' : '?'}unit=2`;
		await update(toolId, { external_tool_url: newUrl, external_tool_new_tab: true });
		expect((await fromCanvas(toolId)).external_tool_tag_attributes).toMatchObject({ url: newUrl, new_tab: true });

		const upload = (label: string): Promise<Json> =>
			uploadDirect(canvas(), `/api/v1/courses/${courseId}/files`, `${unique(label).replace(/\s/g, '-')}.txt`, Buffer.from(label), 'text/plain');
		const [first, second] = [await upload('annotate first'), await upload('annotate second')];
		const annotationId = await make({ submission_types: ['student_annotation'], annotatable_attachment_id: first.id });
		// Canvas ignores the file unless the submission types come with it: the node refuses that.
		const alone = await runNode({
			resource: 'assignment',
			operation: 'update',
			params: { courseId, assignmentId: annotationId, updateFields: { annotatable_attachment_id: String(second.id) }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(alone.error[0]).toMatchObject({ errorType: 'INVALID_PARAMETERS' });
		expect(String(alone.error[0].errorMessage)).toContain('needs Submission Types with "Student Annotation"');
		const before = (await fromCanvas(annotationId)).annotatable_attachment_id;
		await update(annotationId, { annotatable_attachment_id: String(second.id), submission_types: ['student_annotation'] });
		const annotation = await fromCanvas(annotationId);
		expect(annotation.annotatable_attachment_id).not.toBe(before);
		// Canvas keeps its own copy of the file for the assignment: it is a copy of the second one.
		const copy = await canvas().get<Json>(`/api/v1/files/${String(annotation.annotatable_attachment_id)}`);
		expect(copy.display_name).toBe(second.display_name);

		const hiddenId = await make({ omit_from_final_grade: true, points_possible: 0 });
		await update(hiddenId, { hide_in_gradebook: true });
		expect(await fromCanvas(hiddenId)).toMatchObject({ hide_in_gradebook: true });
		await update(hiddenId, { hide_in_gradebook: false });
		expect(await fromCanvas(hiddenId)).toMatchObject({ hide_in_gradebook: false });

		const moderated = await make({ moderated_grading: true, grader_count: 2, points_possible: 10 });
		await update(moderated, { graders_anonymous_to_graders: true, grader_comments_visible_to_graders: true });
		expect(await fromCanvas(moderated)).toMatchObject({ graders_anonymous_to_graders: true });

		const reviewed = await make({
			peer_reviews: true,
			automatic_peer_reviews: true,
			due_at: '2031-03-01T12:00:00Z',
			submission_types: ['online_text_entry'],
		});
		await update(reviewed, { peer_reviews_assign_at: '2031-03-05T12:00:00Z' });
		expect(Date.parse(String((await fromCanvas(reviewed)).peer_reviews_assign_at))).toBe(Date.parse('2031-03-05T12:00:00Z'));

		// Anonymous grading: as for create, the course feature is off on this instance and Canvas
		// ignores the field without an error; the request carries it under Canvas' name.
		const debug = await runNode({
			resource: 'assignment',
			operation: 'update',
			params: { courseId, assignmentId: reviewed, updateFields: { anonymous_grading: true }, debugMode: true },
		});
		expect(debug.debug[0]).toMatchObject({ method: 'PUT', body: { assignment: { anonymous_grading: true } } });
		await update(reviewed, { anonymous_grading: true });
		expect((await fromCanvas(reviewed)).anonymous_grading).toBe(false);
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

		// Availability dates through Update, then the due date alone again.
		await runOk({
			resource: 'assignment',
			operation: 'updateOverride',
			params: {
				...base,
				overrideId: String(students.id),
				updateFields: { due_at: '2033-01-12T12:00:00Z', unlock_at: '2033-01-01T08:00:00Z', lock_at: '2033-01-20T20:00:00Z' },
			},
		});
		expect(
			await canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${groupAssignmentId}/overrides/${String(students.id)}`),
		).toMatchObject({ due_at: '2033-01-12T12:00:00Z', unlock_at: '2033-01-01T08:00:00Z', lock_at: '2033-01-20T20:00:00Z' });

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

		const [first] = await runOk({ resource: 'assignment', operation: 'deleteOverride', params: { ...base, overrideId: String(students.id) } });
		expect(first.id).toBe(students.id);
		const removed = await runNode({
			resource: 'assignment',
			operation: 'deleteOverride',
			items: [{ id: section.id }, { id: group.id }, { id: 999999999 }],
			params: { ...base, overrideId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(ids(removed.success)).toEqual([section.id, group.id]);
		expect(removed.error).toHaveLength(1);
		expect(removed.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		expect(await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments/${groupAssignmentId}/overrides`)).toEqual([]);
	});

	// --------------------------------------------------------- batch overrides

	const overridesOf = (id: string): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments/${id}/overrides`);
	const overrideFromCanvas = (assignment: string, id: unknown): Promise<Json> =>
		canvas().get<Json>(`/api/v1/courses/${courseId}/assignments/${assignment}/overrides/${String(id)}`);
	/** Overrides created by the batch tests: [assignment ID, override]. */
	const batch: Record<string, Json> = {};

	it('batchCreateOverrides: overrides for students, a section and a group of several assignments in one request', async () => {
		const a = groupAssignmentId;
		const b = created[1];
		const student = fx('studentUserId');
		const student2 = fx('student2UserId');
		const overrides = [
			{
				assignment_id: Number(a),
				student_ids: [Number(student)],
				title: 'Batch ünï "one"',
				due_at: '2035-01-10T12:00:00Z',
				unlock_at: '2035-01-01T12:00:00Z',
				lock_at: '2035-01-20T12:00:00Z',
			},
			{ assignment_id: a, course_section_id: battery.sectionIds[1], due_at: '2035-02-10T12:00:00Z' },
			{ assignment_id: a, group_id: Number(battery.studentGroupId), lock_at: '2035-03-10T12:00:00Z' },
			// A comma-separated list of students works as well as a list.
			{ assignment_id: Number(b), student_ids: `${student}, ${student2}`, title: 'Two students', unlock_at: '2035-04-01T12:00:00Z' },
		];
		const result = await runOk({
			resource: 'assignment',
			operation: 'batchCreateOverrides',
			params: { courseId, overrides: JSON.stringify(overrides) },
		});
		expect(result).toHaveLength(4);
		[batch.students, batch.section, batch.group, batch.other] = result;
		expect(batch.students).toMatchObject({ assignment_id: Number(a), student_ids: [Number(student)], title: 'Batch ünï "one"' });

		expect(await overrideFromCanvas(a, batch.students.id)).toMatchObject({
			student_ids: [Number(student)],
			title: 'Batch ünï "one"',
			due_at: '2035-01-10T12:00:00Z',
			unlock_at: '2035-01-01T12:00:00Z',
			lock_at: '2035-01-20T12:00:00Z',
		});
		const section = await overrideFromCanvas(a, batch.section.id);
		expect(section).toMatchObject({ course_section_id: Number(battery.sectionIds[1]), due_at: '2035-02-10T12:00:00Z' });
		expect(section).not.toHaveProperty('lock_at');
		expect(await overrideFromCanvas(a, batch.group.id)).toMatchObject({
			group_id: Number(battery.studentGroupId),
			lock_at: '2035-03-10T12:00:00Z',
		});
		const other = await overrideFromCanvas(b, batch.other.id);
		expect(other).toMatchObject({ title: 'Two students', unlock_at: '2035-04-01T12:00:00Z' });
		expect([...(other.student_ids as number[])].sort()).toEqual([Number(student), Number(student2)].sort());
		expect(await overridesOf(a)).toHaveLength(3);
		expect(await overridesOf(b)).toHaveLength(1);
	});

	it('batchCreateOverrides: when one entry is refused nothing is created, and Canvas says which entry it was', async () => {
		const a = groupAssignmentId;
		const b = created[1];
		const result = await runNode({
			resource: 'assignment',
			operation: 'batchCreateOverrides',
			// As a list of objects from an expression.
			items: [
				{
					wanted: [
						{ assignment_id: Number(b), course_section_id: Number(battery.sectionIds[0]), due_at: '2035-05-01T12:00:00Z' },
						// This section already has an override on this assignment.
						{ assignment_id: Number(a), course_section_id: Number(battery.sectionIds[1]) },
					],
				},
			],
			params: { courseId, overrides: '={{ $json.wanted }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'assignment', operation: 'batchCreateOverrides' });
		// One entry per override asked for: nothing for the first, the reason for the second.
		const errors = result.error[0].canvasErrors as unknown[];
		expect(errors).toHaveLength(2);
		expect(errors[0]).toBeNull();
		expect(JSON.stringify(errors[1])).toContain('taken');
		expect(await overridesOf(b)).toHaveLength(1);
		expect(await overridesOf(a)).toHaveLength(3);
	});

	it('batchGetOverrides: returns the overrides in the order asked for and marks the ones Canvas does not find', async () => {
		const a = groupAssignmentId;
		const b = created[1];
		const wanted = [
			{ id: batch.other.id, assignment_id: Number(b) },
			{ id: 999999999, assignment_id: Number(a) },
			{ id: batch.group.id, assignment_id: a },
			// An override of another assignment is not found either.
			{ id: batch.section.id, assignment_id: b },
			{ id: String(batch.students.id), assignment_id: a },
		];
		const query = wanted
			.map((entry) => `assignment_overrides[][id]=${String(entry.id)}&assignment_overrides[][assignment_id]=${String(entry.assignment_id)}`)
			.join('&');
		const expected = await canvas().get<Array<Json | null>>(`/api/v1/courses/${courseId}/assignments/overrides?${query}`);
		expect(expected.map((entry) => entry?.id ?? null)).toEqual([batch.other.id, null, batch.group.id, null, batch.students.id]);

		const listed = await runOk({
			resource: 'assignment',
			operation: 'batchGetOverrides',
			params: { courseId, overrides: JSON.stringify(wanted) },
		});
		expect(listed).toHaveLength(5);
		expect(listed[0]).toEqual(expected[0]);
		expect(listed[1]).toEqual({ id: '999999999', assignment_id: a, not_found: true });
		expect(listed[2]).toEqual(expected[2]);
		expect(listed[3]).toEqual({ id: String(batch.section.id), assignment_id: b, not_found: true });
		expect(listed[4]).toEqual(expected[4]);

		// From an expression, and whatever the node's pagination options say (the endpoint has no pages).
		const viaExpression = await runOk({
			resource: 'assignment',
			operation: 'batchGetOverrides',
			items: [{ wanted }],
			params: { courseId, overrides: '={{ $json.wanted }}', pagination: { perPage: 2, maxPages: 1 } },
		});
		expect(viaExpression.map((entry) => String(entry.id))).toEqual(wanted.map((entry) => String(entry.id)));
	});

	it('batchUpdateOverrides: changes several overrides at once; dates that are left out are no longer overridden', async () => {
		const a = groupAssignmentId;
		const b = created[1];
		const student2 = fx('student2UserId');
		const updated = await runOk({
			resource: 'assignment',
			operation: 'batchUpdateOverrides',
			params: {
				courseId,
				overrides: JSON.stringify([
					{ id: batch.students.id, assignment_id: Number(a), student_ids: [Number(student2)], title: 'Batch renamed', due_at: '2035-01-12T12:00:00Z' },
					{ id: batch.section.id, assignment_id: a, lock_at: '2035-02-20T12:00:00Z' },
					{ id: batch.other.id, assignment_id: Number(b), unlock_at: null, due_at: '2035-04-15T12:00:00Z' },
				]),
			},
		});
		expect(updated.map((override) => override.id)).toEqual([batch.students.id, batch.section.id, batch.other.id]);

		const students = await overrideFromCanvas(a, batch.students.id);
		expect(students).toMatchObject({ title: 'Batch renamed', due_at: '2035-01-12T12:00:00Z', student_ids: [Number(student2)] });
		expect(students).not.toHaveProperty('unlock_at');
		expect(students).not.toHaveProperty('lock_at');
		const section = await overrideFromCanvas(a, batch.section.id);
		expect(section).toMatchObject({ course_section_id: Number(battery.sectionIds[1]), lock_at: '2035-02-20T12:00:00Z' });
		expect(section).not.toHaveProperty('due_at');
		const other = await overrideFromCanvas(b, batch.other.id);
		// A date sent as null is overridden with "no date"; the students stay as they were.
		expect(other).toMatchObject({ due_at: '2035-04-15T12:00:00Z', unlock_at: null, title: 'Two students' });
		expect(other.student_ids as number[]).toHaveLength(2);
	});

	it('batchUpdateOverrides: an unknown override refuses the whole request', async () => {
		const a = groupAssignmentId;
		const result = await runNode({
			resource: 'assignment',
			operation: 'batchUpdateOverrides',
			params: {
				courseId,
				overrides: JSON.stringify([
					{ id: batch.group.id, assignment_id: Number(a), lock_at: '2036-01-01T12:00:00Z' },
					{ id: 999999999, assignment_id: Number(a), due_at: '2036-01-01T12:00:00Z' },
				]),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'batchUpdateOverrides' });
		expect(JSON.stringify(result.error[0].canvasErrors)).toContain('override not found');
		expect((await overrideFromCanvas(a, batch.group.id)).lock_at).toBe('2035-03-10T12:00:00Z');
	});

	it('batch writes run unedited send nothing: their JSON field is empty, not a sample', async () => {
		const before = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments/${groupAssignmentId}/overrides`);
		for (const operation of ['bulkUpdateDates', 'batchCreateOverrides', 'batchUpdateOverrides']) {
			const result = await runNode({
				resource: 'assignment',
				operation,
				params: { courseId, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, operation).toEqual([]);
			expect(result.error[0], operation).toMatchObject({ errorType: 'INVALID_PARAMETERS' });
			expect(String(result.error[0].errorMessage), operation).toMatch(/at least one entry/);
		}
		expect(await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments/${groupAssignmentId}/overrides`)).toEqual(before);
	});

	it('batch overrides: input that is not a list is rejected by the node; incomplete entries and students by Canvas', async () => {
		const run = (operation: string, overrides: string, persona = 'admin'): ReturnType<typeof runNode> =>
			runNode({
				resource: 'assignment',
				operation,
				persona,
				params: { courseId, overrides, errorHandling: { onError: 'continueWithError' } },
			});

		for (const operation of ['batchCreateOverrides', 'batchGetOverrides', 'batchUpdateOverrides']) {
			const notJson = await run(operation, '[{ not json');
			expect(notJson.error[0], operation).toMatchObject({ errorCode: 0, errorMessage: 'Overrides must be valid JSON', endpoint: '' });
			const notList = await run(operation, '{"assignment_id": 1}');
			expect(String(notList.error[0].errorMessage), operation).toContain('Overrides must be a JSON array with at least one entry');
			const empty = await run(operation, '[]');
			expect(String(empty.error[0].errorMessage), operation).toContain('Overrides must be a JSON array with at least one entry');
			const notObjects = await run(operation, '[12, 13]');
			expect(String(notObjects.error[0].errorMessage), operation).toContain('Overrides: entry 1 must be an object');
		}

		// Canvas' own checks.
		const noAssignment = await run('batchCreateOverrides', JSON.stringify([{ course_section_id: battery.sectionIds[0] }]));
		expect(noAssignment.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(JSON.stringify(noAssignment.error[0].canvasErrors)).toContain('must specify an assignment id');
		const noTarget = await run('batchCreateOverrides', JSON.stringify([{ assignment_id: created[1], due_at: '2035-06-01T12:00:00Z' }]));
		expect(noTarget.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		const noId = await run('batchGetOverrides', JSON.stringify([{ assignment_id: created[1] }]));
		expect(noId.success).toEqual([{ id: '', assignment_id: created[1], not_found: true }]);

		const asStudent = await run(
			'batchUpdateOverrides',
			JSON.stringify([{ id: batch.group.id, assignment_id: groupAssignmentId, lock_at: '2036-01-01T12:00:00Z' }]),
			'student',
		);
		expect(asStudent.success).toEqual([]);
		expect(asStudent.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(asStudent.error[0].errorCode);
	});

	it('getOverride: by the group or the section the override applies to', async () => {
		const a = groupAssignmentId;
		const [byGroup] = await runOk({
			resource: 'assignment',
			operation: 'getOverride',
			params: { overrideBy: 'group', groupId: battery.studentGroupId, assignmentId: a },
		});
		expect(byGroup).toEqual(await overrideFromCanvas(a, batch.group.id));
		expect(byGroup).toMatchObject({ id: batch.group.id, group_id: Number(battery.studentGroupId) });

		const [bySection] = await runOk({
			resource: 'assignment',
			operation: 'getOverride',
			items: [{ section: Number(battery.sectionIds[1]), assignment: Number(a) }],
			params: { overrideBy: 'section', courseSectionId: '={{ $json.section }}', assignmentId: '={{ $json.assignment }}' },
		});
		expect(bySection).toEqual(await overrideFromCanvas(a, batch.section.id));
		expect(bySection).toMatchObject({ id: batch.section.id, course_section_id: Number(battery.sectionIds[1]) });

		// By ID it still works as before, also when the selector is given.
		const [byId] = await runOk({
			resource: 'assignment',
			operation: 'getOverride',
			params: { overrideBy: 'id', courseId, assignmentId: a, overrideId: String(batch.students.id) },
		});
		expect(byId.id).toBe(batch.students.id);

		// A section without an override of its own, and an assignment of another course.
		const none = await runNode({
			resource: 'assignment',
			operation: 'getOverride',
			params: { overrideBy: 'section', courseSectionId: battery.sectionIds[0], assignmentId: a, errorHandling: { onError: 'continueWithError' } },
		});
		expect(none.success).toEqual([]);
		expect(none.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'assignment', operation: 'getOverride' });
		expect(String(none.error[0].endpoint)).toBe(`/api/v1/sections/${battery.sectionIds[0]}/assignments/${a}/override`);
		const elsewhere = await runNode({
			resource: 'assignment',
			operation: 'getOverride',
			params: {
				overrideBy: 'group',
				groupId: battery.studentGroupId,
				assignmentId: submissions.group.assignmentId,
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(elsewhere.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		// Clean up: the remaining tests expect these assignments without overrides.
		for (const [assignment, override] of [
			[a, batch.students],
			[a, batch.section],
			[a, batch.group],
			[created[1], batch.other],
		] as Array<[string, Json]>) {
			await canvas().delete(`/api/v1/courses/${courseId}/assignments/${assignment}/overrides/${String(override.id)}`);
		}
	});

	// -------------------------------------------------------- listGroupMembers

	it('listGroupMembers: the students who share a group assignment with a student', async () => {
		const course = submissions.courseId;
		const [first, second] = submissions.group.groups;
		const path = (assignment: string, user: string): string =>
			`/api/v1/courses/${course}/assignments/${assignment}/users/${user}/group_members`;

		const members = await runOk({
			resource: 'assignment',
			operation: 'listGroupMembers',
			params: { courseId: course, assignmentId: submissions.group.assignmentId, userId: first.memberIds[1] },
		});
		expect(members).toEqual(await canvas().get<Json[]>(path(submissions.group.assignmentId, first.memberIds[1])));
		// Canvas returns the IDs as text.
		expect(members.map((m) => m.id).sort()).toEqual([...first.memberIds].sort());
		expect(members[0].name).toBeTypeOf('string');

		// Several students in one run, IDs as numbers; a student may ask for classmates.
		const result = await runNode({
			resource: 'assignment',
			operation: 'listGroupMembers',
			persona: 'student',
			items: [{ user: Number(second.memberIds[0]) }, { user: Number(fx('studentUserId')) }, { user: 999999999 }],
			params: {
				courseId: course,
				assignmentId: submissions.group.assignmentId,
				userId: '={{ $json.user }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		const paired = (index: number): unknown[] =>
			result.rawSuccess.filter((item) => (item.pairedItem as Json).item === index).map((item) => item.json.id);
		expect(paired(0).sort()).toEqual([...second.memberIds].sort());
		// The student persona is in none of the groups: alone.
		expect(paired(1)).toEqual([fx('studentUserId')]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'assignment', operation: 'listGroupMembers' });

		// An assignment that is not a group assignment: the student alone.
		const alone = await runOk({
			resource: 'assignment',
			operation: 'listGroupMembers',
			params: { courseId: course, assignmentId: submissions.bulkAssignmentId, userId: first.memberIds[0] },
		});
		expect(alone.map((m) => m.id)).toEqual([first.memberIds[0]]);

		// The student is looked up by numeric ID only.
		const bySisId = await runNode({
			resource: 'assignment',
			operation: 'listGroupMembers',
			params: {
				courseId: course,
				assignmentId: submissions.group.assignmentId,
				userId: 'sis_user_id:W5682-S-031',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(bySisId.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
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
