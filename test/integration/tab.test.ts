import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';

/**
 * Resource: tab. Navigation changes are made on a course created for this file
 * and verified by reading the course's tabs back from Canvas directly.
 */
describe('tab', () => {
	let courseId = '';
	let groupId = '';
	let k5AccountId = '';
	let k5CourseId = '';

	const tabsOf = (path: string): Promise<Json[]> => canvas().get<Json[]>(`${path}/tabs`);
	const courseTab = async (id: string): Promise<Json> => {
		const tab = (await tabsOf(`/api/v1/courses/${courseId}`)).find((t) => t.id === id);
		if (!tab) throw new Error(`tab ${id} not found`);
		return tab;
	};

	beforeAll(async () => {
		const account = fx('accountId');
		const course = await canvas().post<Json>(`/api/v1/accounts/${account}/courses`, {
			course: { name: unique('Tab battery course') },
			offer: true,
		});
		courseId = String(course.id);
		const category = await canvas().post<Json>(`/api/v1/courses/${courseId}/group_categories`, { name: unique('Tab battery groups') });
		const group = await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, { name: unique('Tab battery group') });
		groupId = String(group.id);

		// A Canvas for Elementary sub-account, the only place where "course_subject_tabs" has an effect.
		const k5 = await canvas().post<Json>(`/api/v1/accounts/${account}/sub_accounts`, { account: { name: unique('Tab battery K5') } });
		k5AccountId = String(k5.id);
		await canvas().put(`/api/v1/accounts/${k5AccountId}`, { account: { settings: { enable_as_k5_account: { value: true } } } });
		const k5Course = await canvas().post<Json>(`/api/v1/accounts/${k5AccountId}/courses`, { course: { name: unique('Tab battery K5 subject') } });
		k5CourseId = String(k5Course.id);
	});

	afterAll(async () => {
		for (const id of [courseId, k5CourseId]) {
			if (id) await canvas().request('DELETE', `/api/v1/courses/${id}?event=delete`);
		}
		if (k5AccountId) await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/sub_accounts/${k5AccountId}`);
	});

	it('getAll: lists the tabs of every context type', async () => {
		const contexts: Array<[string, string, string]> = [
			['course', courseId, `/api/v1/courses/${courseId}`],
			['account', fx('accountId'), `/api/v1/accounts/${fx('accountId')}`],
			['group', groupId, `/api/v1/groups/${groupId}`],
			['user', fx('adminUserId'), `/api/v1/users/${fx('adminUserId')}`],
		];
		for (const [contextType, contextId, path] of contexts) {
			const expected = await tabsOf(path);
			expect(expected.length, `${contextType} should have tabs`).toBeGreaterThan(2);
			const tabs = await runOk({ resource: 'tab', operation: 'getAll', params: { contextType, contextId } });
			expect(tabs.map((t) => t.id), contextType).toEqual(expected.map((t) => t.id));
			for (const tab of tabs) {
				expect(tab.id).toBeTypeOf('string');
				expect(tab.position).toBeTypeOf('number');
			}
		}
	});

	it('getAll: the tab list is never cut off, whatever the pagination settings', async () => {
		// Canvas returns the navigation in one response; more than 10 tabs must survive the default page size.
		const expected = await tabsOf(`/api/v1/courses/${courseId}`);
		expect(expected.length).toBeGreaterThan(10);

		const all = await runOk({ resource: 'tab', operation: 'getAll', params: { contextType: 'course', contextId: courseId, pagination: { returnAll: true } } });
		expect(all.map((t) => t.id)).toEqual(expected.map((t) => t.id));

		const small = await runOk({ resource: 'tab', operation: 'getAll', params: { contextType: 'course', contextId: courseId, pagination: { perPage: 3, maxPages: 1 } } });
		expect(small.map((t) => t.id)).toEqual(expected.map((t) => t.id));
		expect(new Set(small.map((t) => t.id)).size).toBe(small.length);
	});

	it('getAll: "Course Subject Tabs" returns the home page tabs of a Canvas for Elementary course', async () => {
		const sidebar = await runOk({ resource: 'tab', operation: 'getAll', params: { contextType: 'course', contextId: k5CourseId, options: { include: [] } } });
		const subject = await runOk({
			resource: 'tab',
			operation: 'getAll',
			params: { contextType: 'course', contextId: k5CourseId, options: { include: ['course_subject_tabs'] } },
		});
		const expected = await canvas().get<Json[]>(`/api/v1/courses/${k5CourseId}/tabs?include[]=course_subject_tabs`);
		expect(subject.map((t) => t.id)).toEqual(expected.map((t) => t.id));
		expect(subject.map((t) => t.id)).toContain('schedule');
		expect(sidebar.map((t) => t.id)).not.toContain('schedule');
		expect(sidebar.map((t) => t.id)).toContain('settings');
	});

	it('getAll: as a student, hidden tabs are not listed; an unknown context is a clear 404', async () => {
		const large = fx('courseId');
		const asStudent = await runOk({ resource: 'tab', operation: 'getAll', persona: 'student', params: { contextType: 'course', contextId: large } });
		const asAdmin = await tabsOf(`/api/v1/courses/${large}`);
		expect(asStudent.length).toBeGreaterThan(0);
		expect(asStudent.length).toBeLessThan(asAdmin.length);
		expect(asStudent.map((t) => t.id)).not.toContain('settings');

		const missing = await runNode({
			resource: 'tab',
			operation: 'getAll',
			params: { contextType: 'course', contextId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'tab', operation: 'getAll' });
	});

	it('update: hides a tab, then shows it again', async () => {
		const [hidden] = await runOk({
			resource: 'tab',
			operation: 'update',
			params: { contextId: courseId, tabId: 'discussions', updateFields: { hidden: true } },
		});
		expect(hidden).toMatchObject({ id: 'discussions', hidden: true });
		expect((await courseTab('discussions')).hidden).toBe(true);

		const [shown] = await runOk({
			resource: 'tab',
			operation: 'update',
			params: { contextId: courseId, tabId: 'discussions', updateFields: { hidden: false } },
		});
		expect(shown.hidden).toBeUndefined();
		expect((await courseTab('discussions')).hidden).toBeUndefined();
	});

	it('update: moves a tab and hides it in one call', async () => {
		const before = await tabsOf(`/api/v1/courses/${courseId}`);
		expect((await courseTab('people')).position).not.toBe(2);

		const [moved] = await runOk({
			resource: 'tab',
			operation: 'update',
			params: { contextId: courseId, tabId: 'people', updateFields: { position: 2, hidden: true } },
		});
		expect(moved).toMatchObject({ id: 'people', position: 2, hidden: true });

		const after = await tabsOf(`/api/v1/courses/${courseId}`);
		expect(after.find((t) => t.id === 'people')).toMatchObject({ position: 2, hidden: true });
		expect(after.map((t) => t.id).sort()).toEqual(before.map((t) => t.id).sort());
		expect(after[0].id).toBe('home');
		expect(after[1].id).toBe('people');

		// Moving to the end: Settings always stays last, so the tab lands right before it.
		const last = after.length;
		await runOk({ resource: 'tab', operation: 'update', params: { contextId: courseId, tabId: 'people', updateFields: { position: last, hidden: false } } });
		const final = await tabsOf(`/api/v1/courses/${courseId}`);
		expect(final.map((t) => t.id).slice(-2)).toEqual(['people', 'settings']);
		expect(final.find((t) => t.id === 'people')?.hidden).toBeUndefined();
	});

	it('update: several tabs from several input items, IDs coming from expressions', async () => {
		const result = await runNode({
			resource: 'tab',
			operation: 'update',
			items: [
				{ course: Number(courseId), tab: 'files', hide: true },
				{ course: Number(courseId), tab: 'home', hide: true },
				{ course: Number(courseId), tab: 'pages', hide: true },
			],
			params: {
				contextId: '={{ $json.course }}',
				tabId: '={{ $json.tab }}',
				updateFields: { hidden: '={{ $json.hide }}' },
				errorHandling: { onError: 'continueWithError' },
				batchProcessing: { mode: 'individual' },
			},
		});
		expect(result.success.map((t) => t.id)).toEqual(['files', 'pages']);
		expect(result.rawSuccess.map((t) => (t.pairedItem as Json).item)).toEqual([0, 2]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'update' });
		expect((await courseTab('files')).hidden).toBe(true);
		expect((await courseTab('pages')).hidden).toBe(true);
		expect((await courseTab('home')).hidden).toBeUndefined();
	});

	it('update: Canvas refuses Home/Settings and positions outside 2..number of tabs', async () => {
		const count = (await tabsOf(`/api/v1/courses/${courseId}`)).length;
		const attempts: Array<[string, Json]> = [
			['settings', { hidden: true }],
			['assignments', { position: 1 }],
			['assignments', { position: count + 1 }],
		];
		const positionBefore = (await courseTab('assignments')).position;
		for (const [tabId, updateFields] of attempts) {
			const result = await runNode({
				resource: 'tab',
				operation: 'update',
				params: { contextId: courseId, tabId, updateFields, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success, `${tabId} ${JSON.stringify(updateFields)}`).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'tab', operation: 'update' });
			expect(String(result.error[0].errorMessage).length).toBeGreaterThan(5);
		}
		expect((await courseTab('assignments')).position).toBe(positionBefore);
		expect((await courseTab('settings')).hidden).toBeUndefined();
	});

	it('errors: a student may not change the navigation; an unknown tab is reported, not swallowed', async () => {
		const forbidden = await runNode({
			resource: 'tab',
			operation: 'update',
			persona: 'student',
			params: { contextId: fx('courseId'), tabId: 'assignments', updateFields: { hidden: true }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN', resource: 'tab', operation: 'update' });
		expect([401, 403]).toContain(forbidden.error[0].errorCode);

		const unknown = await runNode({
			resource: 'tab',
			operation: 'update',
			params: { contextId: courseId, tabId: 'no_such_tab', updateFields: { hidden: true }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(unknown.success).toEqual([]);
		expect(unknown.error).toHaveLength(1);
		// Canvas itself fails on an unknown tab ID (it answers 500, not 404).
		expect([404, 500]).toContain(unknown.error[0].errorCode);
	});
});
