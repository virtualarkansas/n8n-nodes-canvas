import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import type { CanvasClient } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import type { Sandbox } from './support/commsSandbox';
import { clientFor, commsSandbox, sandboxSections, sandboxSubAccount } from './support/commsSandbox';

/**
 * Resource: appointmentGroup (the Canvas Scheduler). The sandbox teacher
 * offers appointments, sandbox students sign up.
 */
describe('appointmentGroup', () => {
	let sbx: Sandbox;
	let teacher: CanvasClient;
	let s1: CanvasClient;
	let courseCode = '';
	let sectionCodes: string[] = [];
	/** A second course of the sandbox teacher (in the battery's sub-account), for groups spanning courses. */
	let secondCourseCode = '';
	const asTeacher = 'sbxTeacher';

	let groupId = '';
	let slotIds: string[] = [];

	const detail = (id: string | number, client: CanvasClient = teacher): Promise<Json> =>
		client.get<Json>(`/api/v1/appointment_groups/${id}?include[]=appointments&include[]=child_events&include[]=all_context_codes`);
	const slotTimes = (group: Json): unknown[] => (group.appointments as Json[]).map((a) => [a.start_at, a.end_at]);

	beforeAll(async () => {
		sbx = await commsSandbox();
		teacher = clientFor(sbx.teacher);
		s1 = clientFor(sbx.students[0]);
		courseCode = `course_${sbx.courseId}`;
		sectionCodes = (await sandboxSections(sbx)).map((id) => `course_section_${id}`);

		const subAccount = await sandboxSubAccount();
		const name = 'Battery sandbox second course (appointment groups)';
		const courses = await canvas().getAll<Json>(`/api/v1/accounts/${subAccount}/courses`);
		let course = courses.find((c) => c.name === name && c.workflow_state === 'available');
		if (!course) {
			course = await canvas().post<Json>(`/api/v1/accounts/${subAccount}/courses`, { course: { name }, offer: true });
			await canvas().post(`/api/v1/courses/${String(course.id)}/enrollments`, {
				enrollment: { user_id: sbx.teacher.id, type: 'TeacherEnrollment', enrollment_state: 'active', notify: false },
			});
		}
		secondCourseCode = `course_${String(course.id)}`;

		// Enough appointment groups to need several pages (kept from run to run; unpublished and without slots).
		const mine = await teacher.getAll<Json>('/api/v1/appointment_groups?scope=manageable');
		const fixtures = mine.filter((g) => String(g.title).startsWith('Paging fixture'));
		for (let i = fixtures.length; i < 55; i++) {
			await teacher.post('/api/v1/appointment_groups', {
				appointment_group: { context_codes: [courseCode], title: `Paging fixture ${String(i + 1).padStart(2, '0')}` },
			});
		}
	}, 900_000);

	// ---------------------------------------------------------------- create

	it('create: every optional field, limited to two sections, left unpublished', async () => {
		const title = unique('Thesis consultations "Q&A" <b>ünï</b> 面談');
		const [created] = await runOk({
			resource: 'appointmentGroup',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextCodes: ` ${courseCode} `,
				title,
				additionalFields: {
					allow_observer_signup: false,
					description: 'Bring your draft — "printed" & stapled 📎',
					location_address: '12 Faculty Row',
					location_name: 'Office 3.14',
					max_appointments_per_participant: 2,
					min_appointments_per_participant: 1,
					participant_visibility: 'protected',
					participants_per_appointment: 3,
					publish: false,
					sub_context_codes: `${sectionCodes[0]}, ${sectionCodes[1]}`,
					new_appointments: {
						slots: [
							{ start_at: '2029-06-04T09:00:00Z', end_at: '2029-06-04T09:30:00Z' },
							{ start_at: '2029-06-04T09:30:00Z', end_at: '2029-06-04T10:00:00Z' },
							{ start_at: '2029-06-05T13:00:00Z', end_at: '2029-06-05T14:00:00Z' },
							// A row added in the UI but left empty is ignored.
							{ start_at: '', end_at: '' },
						],
					},
				},
			},
		});
		groupId = String(created.id);
		expect((created.new_appointments as Json[]).length).toBe(3);

		const actual = await detail(groupId);
		expect(actual).toMatchObject({
			title,
			description: 'Bring your draft — "printed" & stapled 📎',
			location_address: '12 Faculty Row',
			location_name: 'Office 3.14',
			max_appointments_per_participant: 2,
			min_appointments_per_participant: 1,
			participant_visibility: 'protected',
			participants_per_appointment: 3,
			workflow_state: 'pending',
			context_codes: [courseCode],
			participant_type: 'User',
			start_at: '2029-06-04T09:00:00Z',
			end_at: '2029-06-05T14:00:00Z',
		});
		expect((actual.sub_context_codes as string[]).sort()).toEqual([...sectionCodes].sort());
		expect(slotTimes(actual)).toEqual([
			['2029-06-04T09:00:00Z', '2029-06-04T09:30:00Z'],
			['2029-06-04T09:30:00Z', '2029-06-04T10:00:00Z'],
			['2029-06-05T13:00:00Z', '2029-06-05T14:00:00Z'],
		]);
		slotIds = (actual.appointments as Json[]).map((a) => String(a.id));

		// Unpublished: students cannot see it yet.
		const reservable = await s1.getAll<Json>('/api/v1/appointment_groups?scope=reservable');
		expect(reservable.map((g) => String(g.id))).not.toContain(groupId);
	});

	it('create: "Publish" opens the group for sign-up; several courses at once', async () => {
		const [created] = await runOk({
			resource: 'appointmentGroup',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextCodes: `${courseCode},${secondCourseCode}`,
				title: unique('Open office hour'),
				additionalFields: {
					publish: true,
					new_appointments: { slots: [{ start_at: '2029-06-11T09:00:00Z', end_at: '2029-06-11T10:00:00Z' }] },
				},
			},
		});
		const actual = await detail(String(created.id));
		expect(actual.workflow_state).toBe('active');
		expect((actual.context_codes as string[]).sort()).toEqual([courseCode, secondCourseCode].sort());
		expect((actual.all_context_codes as string[]).sort()).toEqual([courseCode, secondCourseCode].sort());
		// Without limits Canvas stores "no limit".
		expect(actual).toMatchObject({ participants_per_appointment: null, max_appointments_per_participant: null });
		const reservable = await s1.getAll<Json>('/api/v1/appointment_groups?scope=reservable');
		expect(reservable.map((g) => g.id)).toContain(created.id);
		await teacher.delete(`/api/v1/appointment_groups/${String(created.id)}`);
	});

	it('create: a group category as sub context lets students sign up as groups', async () => {
		const category = await canvas().post<Json>(`/api/v1/courses/${sbx.courseId}/group_categories`, { name: unique('Presentation teams') });
		const groups: Json[] = [];
		for (const name of ['Team Red', 'Team Blue']) {
			groups.push(await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, { name }));
		}
		await canvas().post(`/api/v1/groups/${String(groups[0].id)}/memberships`, { user_id: sbx.students[0].id });
		await canvas().post(`/api/v1/groups/${String(groups[1].id)}/memberships`, { user_id: sbx.students[1].id });

		const [created] = await runOk({
			resource: 'appointmentGroup',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextCodes: courseCode,
				title: unique('Team presentations'),
				additionalFields: {
					sub_context_codes: `group_category_${String(category.id)}`,
					publish: true,
					participants_per_appointment: 1,
					new_appointments: {
						slots: [
							{ start_at: '2029-06-18T09:00:00Z', end_at: '2029-06-18T09:20:00Z' },
							{ start_at: '2029-06-18T09:20:00Z', end_at: '2029-06-18T09:40:00Z' },
						],
					},
				},
			},
		});
		const id = String(created.id);
		const actual = await detail(id);
		expect(actual).toMatchObject({ participant_type: 'Group', sub_context_codes: [`group_category_${String(category.id)}`] });

		// listGroupParticipants: all groups of the category may sign up; none has yet.
		const expectedGroups = await teacher.getAll<Json>(`/api/v1/appointment_groups/${id}/groups`);
		const possible = await runOk({ resource: 'appointmentGroup', operation: 'listGroupParticipants', persona: asTeacher, params: { appointmentGroupId: id } });
		expect(possible.map((g) => g.id).sort()).toEqual(expectedGroups.map((g) => g.id).sort());
		expect(possible.map((g) => g.id).sort()).toEqual(groups.map((g) => g.id).sort());
		const noneYet = await runOk({
			resource: 'appointmentGroup',
			operation: 'listGroupParticipants',
			persona: asTeacher,
			params: { appointmentGroupId: id, options: { registration_status: 'registered' } },
		});
		expect(noneYet).toEqual([]);

		// Student 1 reserves for Team Red.
		const firstSlot = String((actual.appointments as Json[])[0].id);
		await s1.post(`/api/v1/calendar_events/${firstSlot}/reservations`);
		const registered = await runOk({
			resource: 'appointmentGroup',
			operation: 'listGroupParticipants',
			persona: asTeacher,
			params: { appointmentGroupId: id, options: { registration_status: 'registered' } },
		});
		expect(registered.map((g) => g.id)).toEqual([groups[0].id]);
		const everyone = await runOk({
			resource: 'appointmentGroup',
			operation: 'listGroupParticipants',
			persona: asTeacher,
			params: { appointmentGroupId: id, options: { registration_status: 'all' } },
		});
		expect(everyone).toHaveLength(2);

		// Users are not participants of a group sign-up.
		const users = await runOk({ resource: 'appointmentGroup', operation: 'listUserParticipants', persona: asTeacher, params: { appointmentGroupId: id } });
		expect(users).toEqual([]);

		await teacher.delete(`/api/v1/appointment_groups/${id}`);
		await canvas().delete(`/api/v1/group_categories/${String(category.id)}`);
	});

	// Canvas only accepts observer sign-up when the account setting AND the Site Admin feature
	// "observer_appointment_groups" are on. That feature is instance-wide and off on the shared
	// test Canvas, so only the refusal can be exercised here; the accepting path is not run.
	it('create / update: "Allow Observer Signup" reaches Canvas, which refuses it on this instance', async () => {
		const before = (await teacher.getAll<Json>('/api/v1/appointment_groups?scope=manageable')).length;
		const refused = await runNode({
			resource: 'appointmentGroup',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextCodes: courseCode,
				title: unique('Parent-teacher talks'),
				additionalFields: { allow_observer_signup: true },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(refused.success).toEqual([]);
		// The 403 is Canvas reacting to exactly this field: without it the same request creates a group.
		expect(refused.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', operation: 'create' });
		expect(String(refused.error[0].errorMessage)).toContain('cannot allow observers');
		expect((await teacher.getAll<Json>('/api/v1/appointment_groups?scope=manageable')).length).toBe(before);

		// Switched off it is stored as such, on create and on update.
		const [plain] = await runOk({
			resource: 'appointmentGroup',
			operation: 'create',
			persona: asTeacher,
			params: { contextCodes: courseCode, title: unique('Parent-teacher talks'), additionalFields: { allow_observer_signup: false } },
		});
		expect((await detail(String(plain.id))).allow_observer_signup).toBe(false);
		await runOk({
			resource: 'appointmentGroup',
			operation: 'update',
			persona: asTeacher,
			params: { appointmentGroupId: String(plain.id), updateFields: { allow_observer_signup: false, title: 'Parent-teacher talks (renamed)' } },
		});
		expect(await detail(String(plain.id))).toMatchObject({ allow_observer_signup: false, title: 'Parent-teacher talks (renamed)' });
		await teacher.delete(`/api/v1/appointment_groups/${String(plain.id)}`);
	});

	// ---------------------------------------------------------------- update

	it('update: every optional field; new time slots are added to the existing ones', async () => {
		const title = unique('Thesis consultations (rescheduled)');
		const [updated] = await runOk({
			resource: 'appointmentGroup',
			operation: 'update',
			persona: asTeacher,
			params: {
				appointmentGroupId: groupId,
				updateFields: {
					context_codes: secondCourseCode,
					description: 'Now also by video call',
					location_address: 'Online',
					location_name: 'Video room',
					max_appointments_per_participant: 1,
					min_appointments_per_participant: 0,
					participant_visibility: 'private',
					participants_per_appointment: 1,
					publish: false,
					title,
					new_appointments: { slots: [{ start_at: '2029-06-06T08:00:00Z', end_at: '2029-06-06T08:30:00Z' }] },
				},
			},
		});
		expect(updated).toMatchObject({ id: Number(groupId), title });

		const actual = await detail(groupId);
		expect(actual).toMatchObject({
			title,
			description: 'Now also by video call',
			location_address: 'Online',
			location_name: 'Video room',
			max_appointments_per_participant: 1,
			min_appointments_per_participant: 0,
			participant_visibility: 'private',
			participants_per_appointment: 1,
			// "Publish: off" leaves the state alone.
			workflow_state: 'pending',
		});
		expect((actual.all_context_codes as string[]).sort()).toEqual([courseCode, secondCourseCode].sort());
		expect(slotTimes(actual)).toHaveLength(4);
		expect(slotTimes(actual)).toContainEqual(['2029-06-06T08:00:00Z', '2029-06-06T08:30:00Z']);
		slotIds = (actual.appointments as Json[]).map((a) => String(a.id));
	});

	it('update: "Publish" makes the group available (and cannot be undone)', async () => {
		const [published] = await runOk({
			resource: 'appointmentGroup',
			operation: 'update',
			persona: asTeacher,
			params: { appointmentGroupId: groupId, updateFields: { publish: true } },
		});
		expect(published.workflow_state).toBe('active');
		expect((await detail(groupId)).workflow_state).toBe('active');

		await runOk({
			resource: 'appointmentGroup',
			operation: 'update',
			persona: asTeacher,
			params: { appointmentGroupId: groupId, updateFields: { publish: false, location_name: 'Video room 2' } },
		});
		expect(await detail(groupId)).toMatchObject({ workflow_state: 'active', location_name: 'Video room 2' });
	});

	// ---------------------------------------------------------------- get

	it('get: time slots are always included; reservations and all context codes on request', async () => {
		// The group is limited to sections B and C; move a student there so they can sign up.
		const student = sbx.students[3];
		const sectionId = sectionCodes[0].replace('course_section_', '');
		const enrollments = await canvas().getAll<Json>(`/api/v1/courses/${sbx.courseId}/enrollments?user_id=${student.id}`);
		if (!enrollments.some((e) => String(e.course_section_id) === sectionId)) {
			await canvas().post(`/api/v1/sections/${sectionId}/enrollments`, {
				enrollment: { user_id: student.id, type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
			});
		}
		await teacher.post(`/api/v1/calendar_events/${slotIds[0]}/reservations`, { participant_id: student.id });

		const [plain] = await runOk({ resource: 'appointmentGroup', operation: 'get', persona: asTeacher, params: { appointmentGroupId: groupId } });
		expect(plain.id).toBe(Number(groupId));
		expect((plain.appointments as Json[]).map((a) => String(a.id))).toEqual(slotIds);
		expect(plain).not.toHaveProperty('all_context_codes');
		expect((plain.appointments as Json[])[0]).not.toHaveProperty('child_events');

		const [rich] = await runOk({
			resource: 'appointmentGroup',
			operation: 'get',
			persona: asTeacher,
			params: { appointmentGroupId: groupId, options: { include: ['all_context_codes', 'appointments', 'child_events'] } },
		});
		expect((rich.all_context_codes as string[]).sort()).toEqual([courseCode, secondCourseCode].sort());
		const reservations = (rich.appointments as Json[])[0].child_events as Json[];
		expect(reservations.map((r) => String((r.user as Json).id))).toEqual([student.id]);

		// listUserParticipants: who may sign up (the members of the two sections) and who did.
		const expectedUsers = await teacher.getAll<Json>(`/api/v1/appointment_groups/${groupId}/users`);
		const possible = await runOk({
			resource: 'appointmentGroup',
			operation: 'listUserParticipants',
			persona: asTeacher,
			params: { appointmentGroupId: groupId, pagination: { returnAll: true } },
		});
		expect(possible.map((u) => u.id).sort()).toEqual(expectedUsers.map((u) => u.id).sort());
		expect(possible.map((u) => String(u.id))).toContain(student.id);
		const registered = await runOk({
			resource: 'appointmentGroup',
			operation: 'listUserParticipants',
			persona: asTeacher,
			params: { appointmentGroupId: groupId, options: { registration_status: 'registered' } },
		});
		expect(registered.map((u) => String(u.id))).toEqual([student.id]);
		const groups = await runOk({ resource: 'appointmentGroup', operation: 'listGroupParticipants', persona: asTeacher, params: { appointmentGroupId: groupId } });
		expect(groups).toEqual([]);
	});

	it('listUserParticipants: a whole course, more participants than a page', async () => {
		const open = await teacher.post<Json>('/api/v1/appointment_groups', {
			appointment_group: {
				context_codes: [courseCode],
				title: unique('Whole class sign-up'),
				publish: true,
				new_appointments: [['2029-07-02T09:00:00Z', '2029-07-02T10:00:00Z']],
			},
		});
		const id = String(open.id);
		const expected = await teacher.getAll<Json>(`/api/v1/appointment_groups/${id}/users`);
		expect(expected.length).toBeGreaterThanOrEqual(sbx.students.length);

		const all = await runOk({
			resource: 'appointmentGroup',
			operation: 'listUserParticipants',
			persona: asTeacher,
			params: { appointmentGroupId: id, pagination: { returnAll: true } },
		});
		expect(all.map((u) => u.id)).toEqual(expected.map((u) => u.id));
		expect(new Set(all.map((u) => u.id)).size).toBe(all.length);

		const byDefault = await runOk({ resource: 'appointmentGroup', operation: 'listUserParticipants', persona: asTeacher, params: { appointmentGroupId: id } });
		expect(byDefault.map((u) => u.id)).toEqual(expected.slice(0, 50).map((u) => u.id));

		const twoPages = await runOk({
			resource: 'appointmentGroup',
			operation: 'listUserParticipants',
			persona: asTeacher,
			params: { appointmentGroupId: id, pagination: { perPage: 8, maxPages: 2 } },
		});
		expect(twoPages.map((u) => u.id)).toEqual(expected.slice(0, 16).map((u) => u.id));
		await teacher.delete(`/api/v1/appointment_groups/${id}`);
	});

	// ---------------------------------------------------------------- getAll

	it('getAll: manageable groups, more than a page', async () => {
		const expected = await teacher.getAll<Json>('/api/v1/appointment_groups?scope=manageable');
		expect(expected.length).toBeGreaterThan(50);

		const all = await runOk({
			resource: 'appointmentGroup',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { scope: 'manageable' }, pagination: { returnAll: true } },
		});
		expect(all.map((g) => g.id)).toEqual(expected.map((g) => g.id));
		expect(new Set(all.map((g) => g.id)).size).toBe(all.length);
		expect(all.map((g) => String(g.id))).toContain(groupId);

		const byDefault = await runOk({ resource: 'appointmentGroup', operation: 'getAll', persona: asTeacher, params: { options: { scope: 'manageable' } } });
		expect(byDefault.map((g) => g.id)).toEqual(expected.slice(0, 50).map((g) => g.id));

		const twoPages = await runOk({
			resource: 'appointmentGroup',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { scope: 'manageable' }, pagination: { perPage: 7, maxPages: 2 } },
		});
		expect(twoPages.map((g) => g.id)).toEqual(expected.slice(0, 14).map((g) => g.id));
	});

	it('getAll: reservable is the default scope; context codes and past appointments filter', async () => {
		const expected = await s1.getAll<Json>('/api/v1/appointment_groups');
		const byDefault = await runOk({
			resource: 'appointmentGroup',
			operation: 'getAll',
			persona: 'sbxStudent1',
			params: { pagination: { returnAll: true } },
		});
		expect(byDefault.map((g) => g.id)).toEqual(expected.map((g) => g.id));
		const explicit = await runOk({
			resource: 'appointmentGroup',
			operation: 'getAll',
			persona: 'sbxStudent1',
			params: { options: { scope: 'reservable' }, pagination: { returnAll: true } },
		});
		expect(explicit.map((g) => g.id)).toEqual(expected.map((g) => g.id));
		// The teacher's unpublished fixtures are not reservable.
		expect(byDefault.some((g) => String(g.title).startsWith('Paging fixture'))).toBe(false);

		// Context codes: only the groups of the second course (the thesis consultations were linked to it).
		const inOther = await runOk({
			resource: 'appointmentGroup',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { scope: 'manageable', context_codes: ` ${secondCourseCode} ,` }, pagination: { returnAll: true } },
		});
		expect(inOther.map((g) => String(g.id))).toEqual([groupId]);

		// A group whose only slot is over is hidden unless past appointments are included.
		const past = await teacher.post<Json>('/api/v1/appointment_groups', {
			appointment_group: {
				context_codes: [courseCode],
				title: unique('Last year'),
				new_appointments: [['2021-03-01T09:00:00Z', '2021-03-01T10:00:00Z']],
			},
		});
		const current = await runOk({
			resource: 'appointmentGroup',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { scope: 'manageable', include_past_appointments: false }, pagination: { returnAll: true } },
		});
		expect(current.map((g) => g.id)).not.toContain(past.id);
		const withPast = await runOk({
			resource: 'appointmentGroup',
			operation: 'getAll',
			persona: asTeacher,
			params: { options: { scope: 'manageable', include_past_appointments: true }, pagination: { returnAll: true } },
		});
		expect(withPast.map((g) => g.id)).toContain(past.id);
		await teacher.delete(`/api/v1/appointment_groups/${String(past.id)}`);
	});

	it('getAll: includes', async () => {
		const options = { scope: 'manageable', context_codes: secondCourseCode };
		const [plain] = await runOk({ resource: 'appointmentGroup', operation: 'getAll', persona: asTeacher, params: { options } });
		for (const key of ['appointments', 'participant_count', 'reserved_times', 'all_context_codes']) {
			expect(plain, key).not.toHaveProperty(key);
		}

		const [rich] = await runOk({
			resource: 'appointmentGroup',
			operation: 'getAll',
			persona: asTeacher,
			params: {
				options: { ...options, include: ['all_context_codes', 'appointments', 'child_events', 'participant_count', 'reserved_times'] },
			},
		});
		expect(rich.id).toBe(Number(groupId));
		expect(rich.participant_count).toBe(1);
		expect(rich.reserved_times).toEqual([]);
		expect((rich.all_context_codes as string[]).sort()).toEqual([courseCode, secondCourseCode].sort());
		expect((rich.appointments as Json[]).map((a) => String(a.id))).toEqual(slotIds);
		expect(((rich.appointments as Json[])[0].child_events as Json[]).length).toBe(1);
	});

	// ---------------------------------------------------------------- getNextAppointment

	it('getNextAppointment: the earliest free slot, optionally of selected groups', async () => {
		const student = sbx.students[3];
		void student;
		const later = await teacher.post<Json>('/api/v1/appointment_groups', {
			appointment_group: {
				context_codes: [courseCode],
				title: unique('Later appointments'),
				publish: true,
				new_appointments: [
					['2031-01-06T09:00:00Z', '2031-01-06T09:30:00Z'],
					['2031-01-07T09:00:00Z', '2031-01-07T09:30:00Z'],
				],
			},
		});
		const laterSlots = ((await detail(String(later.id))).appointments as Json[]).map((a) => a.id);

		const expected = await s1.get<Json[]>('/api/v1/appointment_groups/next_appointment');
		const next = await runOk({ resource: 'appointmentGroup', operation: 'getNextAppointment', persona: 'sbxStudent1' });
		expect(next.map((e) => e.id)).toEqual(expected.map((e) => e.id));
		expect(next).toHaveLength(1);

		const ofGroup = await runOk({
			resource: 'appointmentGroup',
			operation: 'getNextAppointment',
			persona: 'sbxStudent1',
			params: { options: { appointment_group_ids: ` ${String(later.id)} ` } },
		});
		expect(ofGroup.map((e) => e.id)).toEqual([laterSlots[0]]);
		expect(ofGroup[0]).toMatchObject({ appointment_group_id: later.id, start_at: '2031-01-06T09:00:00Z' });

		// Once the first slot is taken by the student, the next free one is offered.
		const reservation = await s1.post<Json>(`/api/v1/calendar_events/${String(laterSlots[0])}/reservations`);
		const afterwards = await runOk({
			resource: 'appointmentGroup',
			operation: 'getNextAppointment',
			persona: 'sbxStudent1',
			params: { options: { appointment_group_ids: `${String(later.id)},99999999` } },
		});
		expect(afterwards.map((e) => e.id)).toEqual([laterSlots[1]]);

		// The thesis consultations are limited to two sections student 1 is not in: nothing to offer.
		const none = await runOk({
			resource: 'appointmentGroup',
			operation: 'getNextAppointment',
			persona: 'sbxStudent1',
			params: { options: { appointment_group_ids: groupId } },
		});
		expect(none).toEqual([]);

		await s1.delete(`/api/v1/calendar_events/${String(reservation.id)}`);
		await teacher.delete(`/api/v1/appointment_groups/${String(later.id)}`);
	});

	// ---------------------------------------------------------------- delete

	it('delete: removes the group, its time slots and reservations', async () => {
		const [deleted] = await runOk({
			resource: 'appointmentGroup',
			operation: 'delete',
			persona: asTeacher,
			params: { appointmentGroupId: groupId, options: { cancel_reason: 'The lecturer is on leave — "sorry" & thanks' } },
		});
		expect(deleted).toMatchObject({ id: Number(groupId), workflow_state: 'deleted' });
		// A deleted appointment group can no longer be read (Canvas answers 403, not 404).
		expect((await teacher.request('GET', `/api/v1/appointment_groups/${groupId}`)).status).toBe(403);
		// The time slots went with it: Canvas no longer lets anyone read them, not even an admin.
		for (const slot of slotIds) {
			expect((await teacher.request('GET', `/api/v1/calendar_events/${slot}`)).status).toBe(403);
			expect((await canvas().request('GET', `/api/v1/calendar_events/${slot}`)).status).toBe(403);
		}
		const manageable = await teacher.getAll<Json>('/api/v1/appointment_groups?scope=manageable');
		expect(manageable.map((g) => String(g.id))).not.toContain(groupId);
	});

	// ---------------------------------------------------------------- errors

	it('errors: overlapping slots, concluded courses, students, unknown IDs', async () => {
		const overlapping = await runNode({
			resource: 'appointmentGroup',
			operation: 'create',
			persona: asTeacher,
			params: {
				contextCodes: courseCode,
				title: unique('Overlap'),
				additionalFields: {
					new_appointments: {
						slots: [
							{ start_at: '2029-08-01T09:00:00Z', end_at: '2029-08-01T10:00:00Z' },
							{ start_at: '2029-08-01T09:30:00Z', end_at: '2029-08-01T10:30:00Z' },
						],
					},
				},
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(overlapping.success).toEqual([]);
		expect(overlapping.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'appointmentGroup', operation: 'create' });
		expect(overlapping.error[0].canvasErrors).toHaveProperty('appointments');

		const concluded = await runNode({
			resource: 'appointmentGroup',
			operation: 'create',
			params: {
				contextCodes: `course_${fx('concludedCourseId')}`,
				title: unique('Too late'),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(concluded.success).toEqual([]);
		expect(concluded.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		// Canvas' own explanation is passed on (in the language of the course, so not matched literally).
		expect(String(concluded.error[0].errorMessage)).not.toMatch(/^Bad request/);
		expect(String(concluded.error[0].errorMessage).length).toBeGreaterThan(10);

		const student = await runNode({
			resource: 'appointmentGroup',
			operation: 'create',
			persona: 'sbxStudent1',
			params: { contextCodes: courseCode, title: unique('Not allowed'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(student.success).toEqual([]);
		expect(student.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });

		const missing = await runNode({
			resource: 'appointmentGroup',
			operation: 'get',
			persona: asTeacher,
			items: [{ id: 99999999 }],
			params: { appointmentGroupId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'get' });

		const noContext = await runNode({
			resource: 'appointmentGroup',
			operation: 'create',
			persona: asTeacher,
			params: { contextCodes: 'course_99999999', title: unique('Nowhere'), errorHandling: { onError: 'continueWithError' } },
		});
		// Canvas itself fails on a context code it cannot resolve (500 instead of a "not found").
		expect(noContext.success).toEqual([]);
		expect(noContext.error[0]).toMatchObject({ errorCode: 500, errorType: 'SERVER_ERROR', operation: 'create' });
	});
});
