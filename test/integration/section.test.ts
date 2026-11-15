import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resource: section. Runs against two courses created for this file (never the
 * seeded ones, except for read-only checks) and verifies every write by reading
 * the section back from Canvas directly.
 */
describe('section', () => {
	let courseId = '';
	let targetCourseId = '';
	let userId = '';
	let sectionId = '';
	const sisId = unique('SEC-SIS').replace(/\s/g, '_');
	const bulkNames: string[] = [];
	const name = unique('Battery Section Ünïcødé 分科 "quoted" & <b>tags</b> 🧪');

	const getSection = (id: string, query = ''): Promise<Json> => canvas().get<Json>(`/api/v1/sections/${id}${query}`);

	beforeAll(async () => {
		const account = fx('accountId');
		const course = await canvas().post<Json>(`/api/v1/accounts/${account}/courses`, {
			course: { name: unique('Section battery course') },
			offer: true,
		});
		courseId = String(course.id);
		const target = await canvas().post<Json>(`/api/v1/accounts/${account}/courses`, {
			course: { name: unique('Section battery cross-list target') },
		});
		targetCourseId = String(target.id);
		const user = await canvas().post<Json>(`/api/v1/accounts/${account}/users`, {
			user: { name: unique('Section Battery Student'), skip_registration: true },
			pseudonym: { unique_id: `${unique('sec-student').replace(/\s/g, '.')}@example.edu`, send_confirmation: false },
		});
		userId = String(user.id);
		// Enough sections for more than two default pages (10 per page).
		for (let i = 1; i <= 23; i++) {
			const sectionName = `Bulk ${String(i).padStart(2, '0')} ${unique('sec')}`;
			bulkNames.push(sectionName);
			await canvas().post(`/api/v1/courses/${courseId}/sections`, { course_section: { name: sectionName } });
		}
	});

	afterAll(async () => {
		for (const id of [courseId, targetCourseId]) {
			if (id) await canvas().request('DELETE', `/api/v1/courses/${id}?event=delete`);
		}
		if (userId) await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${userId}`);
	});

	it('create: every optional field reaches Canvas', async () => {
		const integrationId = unique('SEC-INT').replace(/\s/g, '_');
		const [created] = await runOk({
			resource: 'section',
			operation: 'create',
			params: {
				courseId,
				name,
				additionalFields: {
					end_at: '2031-06-30T23:59:00Z',
					integration_id: integrationId,
					restrict_enrollments_to_section_dates: true,
					sis_section_id: sisId,
					start_at: '2030-01-15T08:00:00Z',
				},
			},
		});
		sectionId = String(created.id);
		expect(created.name).toBe(name);

		expect(await getSection(sectionId)).toMatchObject({
			name,
			course_id: Number(courseId),
			start_at: '2030-01-15T08:00:00Z',
			end_at: '2031-06-30T23:59:00Z',
			restrict_enrollments_to_section_dates: true,
			sis_section_id: sisId,
			integration_id: integrationId,
		});
	});

	it('create: a second section with the same SIS ID is rejected with Canvas\' validation message', async () => {
		const result = await runNode({
			resource: 'section',
			operation: 'create',
			params: {
				courseId,
				name: unique('Duplicate SIS'),
				additionalFields: { sis_section_id: sisId },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'section', operation: 'create' });
		expect(JSON.stringify(result.error[0])).toMatch(/sis_source_id|already in use|taken/i);
	});

	it('create: "Enable SIS Reactivation" revives a deleted section instead of failing on its SIS ID', async () => {
		const reviveSis = unique('SEC-REVIVE').replace(/\s/g, '_');
		const original = await canvas().post<Json>(`/api/v1/courses/${courseId}/sections`, {
			course_section: { name: 'To be revived', sis_section_id: reviveSis },
		});
		await canvas().delete(`/api/v1/sections/${String(original.id)}`);
		expect((await canvas().request('GET', `/api/v1/sections/${String(original.id)}`)).status).toBe(404);

		const [revived] = await runOk({
			resource: 'section',
			operation: 'create',
			params: {
				courseId,
				name: 'Ignored for a revived section',
				additionalFields: { sis_section_id: reviveSis, enable_sis_reactivation: true },
			},
		});
		expect(revived.id).toBe(original.id);
		expect(await getSection(String(original.id))).toMatchObject({ id: original.id, sis_section_id: reviveSis });
		await canvas().delete(`/api/v1/sections/${String(original.id)}`);
	});

	it('get: returns the section with every include', async () => {
		const seeded = fx('sectionId');
		const [section] = await runOk({
			resource: 'section',
			operation: 'get',
			params: {
				sectionId: seeded,
				options: { include: ['avatar_url', 'enrollments', 'passback_status', 'permissions', 'students', 'total_students'] },
			},
		});
		const expected = await getSection(seeded, '?include[]=students&include[]=total_students');
		expect(section).toMatchObject({ id: Number(seeded), total_students: expected.total_students });
		expect(section).toHaveProperty('passback_status');
		expect(section.permissions).toBeTypeOf('object');
		const students = section.students as Json[];
		expect(students.map((s) => s.id).sort()).toEqual((expected.students as Json[]).map((s) => s.id).sort());
		expect(students.length).toBeGreaterThan(0);
		expect(students[0]).toHaveProperty('avatar_url');
		expect(students[0].enrollments).toBeInstanceOf(Array);
	});

	it('get: accepts SIS IDs, and numeric IDs arriving from expressions for several items', async () => {
		const [bySis] = await runOk({ resource: 'section', operation: 'get', params: { sectionId: `sis_section_id:${fx('sectionSisId')}` } });
		expect(bySis.id).toBe(Number(fx('sectionId')));

		const result = await runNode({
			resource: 'section',
			operation: 'get',
			items: [{ id: Number(sectionId) }, { id: 99999999 }, { id: Number(fx('sectionId2')) }, { id: Number(fx('deletedSectionId')) }],
			params: { sectionId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((s) => s.id)).toEqual([Number(sectionId), Number(fx('sectionId2'))]);
		expect(result.rawSuccess.map((s) => (s.pairedItem as Json).item)).toEqual([0, 2]);
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'section', operation: 'get' });
		}
	});

	it('update: every optional field reaches Canvas', async () => {
		const renamed = `${name} (renamed)`;
		const newSis = `${sisId}_v2`;
		const newIntegration = unique('SEC-INT2').replace(/\s/g, '_');
		const [updated] = await runOk({
			resource: 'section',
			operation: 'update',
			params: {
				sectionId,
				updateFields: {
					end_at: '2032-07-31T23:59:00Z',
					integration_id: newIntegration,
					name: renamed,
					override_sis_stickiness: true,
					restrict_enrollments_to_section_dates: false,
					sis_section_id: newSis,
					start_at: '2030-02-01T08:00:00Z',
				},
			},
		});
		expect(updated.name).toBe(renamed);
		expect(await getSection(sectionId)).toMatchObject({
			name: renamed,
			start_at: '2030-02-01T08:00:00Z',
			end_at: '2032-07-31T23:59:00Z',
			restrict_enrollments_to_section_dates: false,
			sis_section_id: newSis,
			integration_id: newIntegration,
		});
	});

	it('update: with "Override SIS Stickiness" off, Canvas only changes the date restriction', async () => {
		const before = await getSection(sectionId);
		await runOk({
			resource: 'section',
			operation: 'update',
			params: {
				sectionId,
				updateFields: {
					name: 'Must not be applied',
					start_at: '2035-01-01T00:00:00Z',
					restrict_enrollments_to_section_dates: true,
					override_sis_stickiness: false,
				},
			},
		});
		expect(await getSection(sectionId)).toMatchObject({
			name: before.name,
			start_at: before.start_at,
			restrict_enrollments_to_section_dates: true,
		});
	});

	it('update: empty values clear dates and SIS IDs', async () => {
		await runOk({
			resource: 'section',
			operation: 'update',
			params: { sectionId, updateFields: { start_at: '', end_at: '', sis_section_id: '', integration_id: '' } },
		});
		expect(await getSection(sectionId)).toMatchObject({ start_at: null, end_at: null, sis_section_id: null, integration_id: null });
	});

	it('getAll: pages through a course with more sections than one page holds', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/sections`);
		expect(expected.length).toBeGreaterThanOrEqual(24);

		const defaults = await runOk({ resource: 'section', operation: 'getAll', params: { courseId } });
		expect(defaults.map((s) => s.id).sort()).toEqual(expected.map((s) => s.id).sort());

		const all = await runOk({ resource: 'section', operation: 'getAll', params: { courseId, pagination: { returnAll: true } } });
		expect(all.map((s) => s.id)).toEqual(expected.map((s) => s.id));

		const twoPages = await runOk({ resource: 'section', operation: 'getAll', params: { courseId, pagination: { perPage: 5, maxPages: 2 } } });
		expect(twoPages).toHaveLength(10);
		expect(new Set(twoPages.map((s) => s.id)).size).toBe(10);
		expect(twoPages.map((s) => s.id)).toEqual(expected.slice(0, 10).map((s) => s.id));
	});

	it('getAll: search term and includes are applied', async () => {
		const wanted = bulkNames[6];
		const found = await runOk({
			resource: 'section',
			operation: 'getAll',
			params: { courseId, options: { search_term: wanted.slice(0, 7), include: ['total_students', 'permissions'] } },
		});
		expect(found.map((s) => s.name)).toEqual([wanted]);
		expect(found[0]).toMatchObject({ total_students: 0 });
		expect(found[0].permissions).toBeTypeOf('object');

		const none = await runNode({
			resource: 'section',
			operation: 'getAll',
			params: { courseId, options: { search_term: 'zz-no-such-section-zz' } },
		});
		expect(none.ok).toBe(true);
		expect(none.success).toEqual([]);
		expect(none.error).toEqual([]);

		// An option that was added but left empty must not turn into a blank filter.
		const blank = await runOk({ resource: 'section', operation: 'getAll', params: { courseId, options: { search_term: '', include: [] }, pagination: { returnAll: true } } });
		expect(blank.length).toBeGreaterThanOrEqual(24);
	});

	it('getAll: student totals of the large seeded course match Canvas', async () => {
		const large = fx('largeCourseId');
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${large}/sections?include[]=total_students`);
		const listed = await runOk({
			resource: 'section',
			operation: 'getAll',
			params: { courseId: `sis_course_id:${fx('largeCourseSisId')}`, options: { include: ['total_students'] }, pagination: { returnAll: true } },
		});
		expect(listed.map((s) => [s.id, s.total_students])).toEqual(expected.map((s) => [s.id, s.total_students]));
		expect(listed.some((s) => Number(s.total_students) > 30)).toBe(true);
	});

	it('listUsers: returns every user of a section exactly once, honouring filters', async () => {
		const seeded = fx('sectionId');
		const expected = await canvas().getAll<Json>(`/api/v1/sections/${seeded}/users`);
		expect(expected.length).toBeGreaterThan(10);

		const all = await runOk({
			resource: 'section',
			operation: 'listUsers',
			params: { sectionId: seeded, options: { include: ['avatar_url', 'uuid'] }, pagination: { returnAll: true } },
		});
		expect(all.map((u) => u.id).sort()).toEqual(expected.map((u) => u.id).sort());
		expect(new Set(all.map((u) => u.id)).size).toBe(all.length);
		expect(all[0]).toHaveProperty('avatar_url');
		expect(all[0].uuid).toBeTypeOf('string');

		const paged = await runOk({ resource: 'section', operation: 'listUsers', params: { sectionId: seeded, pagination: { perPage: 4, maxPages: 3 } } });
		expect(paged).toHaveLength(12);
		expect(new Set(paged.map((u) => u.id)).size).toBe(12);

		const teachersExpected = await canvas().getAll<Json>(`/api/v1/sections/${seeded}/users?enrollment_type=teacher`);
		const teachers = await runOk({ resource: 'section', operation: 'listUsers', params: { sectionId: seeded, options: { enrollment_type: 'teacher' } } });
		expect(teachers.map((u) => u.id).sort()).toEqual(teachersExpected.map((u) => u.id).sort());
		expect(teachers.length).toBeGreaterThan(0);
		expect(teachers.length).toBeLessThan(expected.length);

		const someone = expected[3];
		const searched = await runOk({
			resource: 'section',
			operation: 'listUsers',
			params: { sectionId: seeded, options: { search_term: String(someone.name), exclude_inactive: true } },
		});
		expect(searched.map((u) => u.id)).toContain(someone.id);
		expect(searched.length).toBeLessThan(expected.length);
	});

	it('listUsers: an empty section yields no items and no error', async () => {
		// (Seeded "empty" sections still hold the course's Test Student, so use a fresh one.)
		const fresh = await canvas().post<Json>(`/api/v1/courses/${courseId}/sections`, { course_section: { name: unique('Empty section') } });
		const result = await runNode({ resource: 'section', operation: 'listUsers', params: { sectionId: String(fresh.id) } });
		expect(result.ok).toBe(true);
		expect(result.success).toEqual([]);
		expect(result.error).toEqual([]);
	});

	it('crosslist: moves the section to another course', async () => {
		const [moved] = await runOk({
			resource: 'section',
			operation: 'crosslist',
			params: { sectionId, newCourseId: targetCourseId, options: { override_sis_stickiness: true } },
		});
		expect(moved).toMatchObject({ id: Number(sectionId), course_id: Number(targetCourseId), nonxlist_course_id: Number(courseId) });
		expect(await getSection(sectionId)).toMatchObject({ course_id: Number(targetCourseId), nonxlist_course_id: Number(courseId) });
	});

	it('decrosslist: with "Override SIS Stickiness" off Canvas leaves the section where it is', async () => {
		const [unchanged] = await runOk({
			resource: 'section',
			operation: 'decrosslist',
			params: { sectionId, options: { override_sis_stickiness: false } },
		});
		expect(unchanged.course_id).toBe(Number(targetCourseId));
		expect((await getSection(sectionId)).course_id).toBe(Number(targetCourseId));
	});

	it('decrosslist: returns the section to its original course', async () => {
		const [back] = await runOk({ resource: 'section', operation: 'decrosslist', params: { sectionId } });
		expect(back).toMatchObject({ id: Number(sectionId), course_id: Number(courseId), nonxlist_course_id: null });
		expect(await getSection(sectionId)).toMatchObject({ course_id: Number(courseId), nonxlist_course_id: null });
	});

	it('decrosslist: a section that is not cross-listed is refused with Canvas\' message', async () => {
		const result = await runNode({
			resource: 'section',
			operation: 'decrosslist',
			params: { sectionId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'decrosslist' });
		expect(String(result.error[0].errorMessage)).toContain('not cross-listed');
	});

	it('crosslist: with "Override SIS Stickiness" off nothing moves; blueprint courses and unknown courses are refused', async () => {
		const [unchanged] = await runOk({
			resource: 'section',
			operation: 'crosslist',
			params: { sectionId, newCourseId: targetCourseId, options: { override_sis_stickiness: false } },
		});
		expect(unchanged.course_id).toBe(Number(courseId));
		expect((await getSection(sectionId)).course_id).toBe(Number(courseId));

		const blueprint = await runNode({
			resource: 'section',
			operation: 'crosslist',
			params: { sectionId, newCourseId: fx('blueprintCourseId'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(blueprint.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN' });
		expect(String(blueprint.error[0].errorMessage)).toContain('blueprint');

		const missing = await runNode({
			resource: 'section',
			operation: 'crosslist',
			params: { sectionId, newCourseId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
		expect((await getSection(sectionId)).course_id).toBe(Number(courseId));
	});

	it('delete: Canvas refuses a section that still has enrollments', async () => {
		await canvas().post(`/api/v1/sections/${sectionId}/enrollments`, {
			enrollment: { user_id: userId, type: 'StudentEnrollment', enrollment_state: 'active' },
		});
		const result = await runNode({
			resource: 'section',
			operation: 'delete',
			params: { sectionId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'delete' });
		expect(String(result.error[0].errorMessage)).toContain("can't delete a section that has enrollments");
		expect((await getSection(sectionId)).id).toBe(Number(sectionId));
	});

	it('delete: removes a section once its enrollments are gone', async () => {
		const enrollments = await canvas().getAll<Json>(`/api/v1/sections/${sectionId}/enrollments`);
		for (const enrollment of enrollments) {
			await canvas().request('DELETE', `/api/v1/courses/${courseId}/enrollments/${String(enrollment.id)}?task=delete`);
		}
		const [deleted] = await runOk({ resource: 'section', operation: 'delete', params: { sectionId } });
		expect(deleted.id).toBe(Number(sectionId));
		expect((await canvas().request('GET', `/api/v1/sections/${sectionId}`)).status).toBe(404);
		const remaining = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/sections`);
		expect(remaining.map((s) => s.id)).not.toContain(Number(sectionId));
	});

	it('errors: a teacher of another course may not create or rename sections here', async () => {
		const created = await runNode({
			resource: 'section',
			operation: 'create',
			persona: 'teacher',
			params: { courseId, name: unique('Forbidden'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(created.success).toEqual([]);
		expect(created.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'section', operation: 'create' });
		expect([401, 403]).toContain(created.error[0].errorCode);

		const others = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/sections`);
		const renamed = await runNode({
			resource: 'section',
			operation: 'update',
			persona: 'student',
			params: { sectionId: String(others[0].id), updateFields: { name: 'Hacked' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(renamed.success).toEqual([]);
		expect([401, 403, 404]).toContain(renamed.error[0].errorCode);
		expect((await getSection(String(others[0].id))).name).toBe(others[0].name);
	});
});
