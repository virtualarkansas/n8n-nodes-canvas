import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import {
	createSandboxAccount,
	createSandboxCourse,
	deleteSandboxAccount,
	deleteSandboxCourse,
	waitForProgress,
} from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: outcomeGroup. Uses a sub-account of its own with a course in it,
 * so account-level groups can be imported and linked into the course. Global
 * groups this file creates are removed again.
 */
describe('outcomeGroup', () => {
	let accountId = '';
	let course: SandboxCourse;
	let courseId = '';
	let courseRootId = '';
	let accountRootId = '';
	let globalRootId = '';
	let groupId = '';
	let targetGroupId = '';
	let accountGroupId = '';
	let globalGroupId = '';
	const outcomeIds: number[] = [];
	const title = unique('Gröup "quoted" & <b>tags</b> 成果 🎯');

	const group = (id: string): Promise<Json> => canvas().get<Json>(`/api/v1/courses/${courseId}/outcome_groups/${id}`);
	const subgroups = (id: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/courses/${courseId}/outcome_groups/${id}/subgroups`);
	const linked = (id: string): Promise<Json[]> => canvas().getAll<Json>(`/api/v1/courses/${courseId}/outcome_groups/${id}/outcomes`);
	const linkedIds = async (id: string): Promise<number[]> => (await linked(id)).map((l) => Number((l.outcome as Json).id));
	const createOutcome = async (path: string, name: string): Promise<number> => {
		const link = await canvas().post<Json>(`${path}/outcomes`, { title: name, description: `<p>${name} description</p>` });
		return Number((link.outcome as Json).id);
	};

	beforeAll(async () => {
		accountId = await createSandboxAccount('outcome-groups');
		course = await createSandboxCourse('outcome-groups', { accountId, personas: ['teacher', 'student'] });
		courseId = course.id;
		courseRootId = String((await canvas().get<Json>(`/api/v1/courses/${courseId}/root_outcome_group`)).id);
		accountRootId = String((await canvas().get<Json>(`/api/v1/accounts/${accountId}/root_outcome_group`)).id);
		globalRootId = String((await canvas().get<Json>('/api/v1/global/root_outcome_group')).id);
	});

	afterAll(async () => {
		if (globalGroupId) await canvas().request('DELETE', `/api/v1/global/outcome_groups/${globalGroupId}`);
		await deleteSandboxCourse(course);
		if (accountGroupId) await canvas().request('DELETE', `/api/v1/accounts/${accountId}/outcome_groups/${accountGroupId}`);
		await deleteSandboxAccount(accountId);
	});

	it('getRoot: follows Canvas\' redirect to the root group in every context', async () => {
		const [fromCourse] = await runOk({ resource: 'outcomeGroup', operation: 'getRoot', params: { context: 'course', courseId } });
		expect(fromCourse).toMatchObject({ id: Number(courseRootId), context_type: 'Course', context_id: Number(courseId) });

		const [fromAccount] = await runOk({ resource: 'outcomeGroup', operation: 'getRoot', params: { context: 'account', accountId } });
		expect(fromAccount).toMatchObject({ id: Number(accountRootId), context_type: 'Account', context_id: Number(accountId) });

		const [global] = await runOk({ resource: 'outcomeGroup', operation: 'getRoot', persona: 'teacher', params: { context: 'global' } });
		expect(global).toMatchObject({ id: Number(globalRootId), context_type: null, context_id: null });
	});

	it('create: a subgroup with every optional field, in every context', async () => {
		const [created] = await runOk({
			resource: 'outcomeGroup',
			operation: 'create',
			params: {
				context: 'course',
				courseId,
				outcomeGroupId: courseRootId,
				title,
				additionalFields: { description: '<p>Group <strong>description</strong> & more</p>', vendor_guid: 'VG-"1"/α' },
			},
		});
		groupId = String(created.id);
		expect(created).toMatchObject({ title, vendor_guid: 'VG-"1"/α', context_type: 'Course', context_id: Number(courseId) });
		expect(await group(groupId)).toMatchObject({
			title,
			vendor_guid: 'VG-"1"/α',
			description: '<p>Group <strong>description</strong> &amp; more</p>',
			parent_outcome_group: { id: Number(courseRootId) },
		});

		const [inAccount] = await runOk({
			resource: 'outcomeGroup',
			operation: 'create',
			params: { context: 'account', accountId: Number(accountId), outcomeGroupId: Number(accountRootId), title: unique('Account standards') },
		});
		accountGroupId = String(inAccount.id);
		expect(inAccount).toMatchObject({ context_type: 'Account', context_id: Number(accountId), parent_outcome_group: { id: Number(accountRootId) } });

		const [inGlobal] = await runOk({
			resource: 'outcomeGroup',
			operation: 'create',
			params: { context: 'global', outcomeGroupId: globalRootId, title: unique('Battery global group') },
		});
		globalGroupId = String(inGlobal.id);
		expect(inGlobal).toMatchObject({ context_type: null, parent_outcome_group: { id: Number(globalRootId) } });
		expect((await canvas().get<Json>(`/api/v1/global/outcome_groups/${globalGroupId}`)).title).toBe(inGlobal.title);
	});

	it('create: one subgroup per input item', async () => {
		const titles = Array.from({ length: 12 }, (_, i) => unique(`Unit ${String(i + 1).padStart(2, '0')}`));
		const result = await runNode({
			resource: 'outcomeGroup',
			operation: 'create',
			persona: 'teacher',
			items: titles.map((t) => ({ title: t, parent: Number(groupId) })),
			params: { courseId: `sis_course_id:${course.sisId}`, outcomeGroupId: '={{ $json.parent }}', title: '={{ $json.title }}' },
		});
		expect(result.error).toEqual([]);
		expect(result.success.map((g) => g.title)).toEqual(titles);
		targetGroupId = String(result.success[0].id);
		expect((await subgroups(groupId)).map((g) => g.title).sort()).toEqual([...titles].sort());
	});

	it('get: in every context, with a mix of found and missing', async () => {
		const result = await runNode({
			resource: 'outcomeGroup',
			operation: 'get',
			items: [{ id: Number(groupId) }, { id: 99999999 }, { id: accountGroupId }],
			params: { context: 'course', courseId, outcomeGroupId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toHaveLength(1);
		expect(result.success[0]).toMatchObject({ id: Number(groupId), title, description: expect.stringContaining('<strong>description</strong>') });
		// A group of another context is "not found" too.
		expect(result.error).toHaveLength(2);
		for (const error of result.error) {
			expect(error).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'outcomeGroup', operation: 'get' });
		}

		const [fromAccount] = await runOk({ resource: 'outcomeGroup', operation: 'get', params: { context: 'account', accountId, outcomeGroupId: accountGroupId } });
		expect(fromAccount).toMatchObject({ id: Number(accountGroupId), context_type: 'Account' });
		const [fromGlobal] = await runOk({ resource: 'outcomeGroup', operation: 'get', params: { context: 'global', outcomeGroupId: globalGroupId } });
		expect(fromGlobal).toMatchObject({ id: Number(globalGroupId), context_type: null });
	});

	it('getAll: every group of a course exactly once, across pages', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/outcome_groups`);
		expect(expected.length).toBeGreaterThan(13);

		const defaults = await runOk({ resource: 'outcomeGroup', operation: 'getAll', params: { context: 'course', courseId } });
		expect(defaults.map((g) => g.id).sort()).toEqual(expected.map((g) => g.id).sort());
		expect(new Set(defaults.map((g) => g.id)).size).toBe(defaults.length);

		const twoPages = await runOk({
			resource: 'outcomeGroup',
			operation: 'getAll',
			persona: 'teacher',
			params: { courseId, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(twoPages).toHaveLength(8);
		expect(new Set(twoPages.map((g) => g.id)).size).toBe(8);

		const all = await runOk({ resource: 'outcomeGroup', operation: 'getAll', params: { context: 'course', courseId, pagination: { returnAll: true } } });
		expect(all.map((g) => g.id).sort()).toEqual(expected.map((g) => g.id).sort());
	});

	it('getAll: account context', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/accounts/${accountId}/outcome_groups`);
		const listed = await runOk({ resource: 'outcomeGroup', operation: 'getAll', params: { context: 'account', accountId, pagination: { returnAll: true } } });
		expect(listed.map((g) => g.id).sort()).toEqual(expected.map((g) => g.id).sort());
		expect(listed.map((g) => String(g.id))).toEqual(expect.arrayContaining([accountRootId, accountGroupId]));
	});

	it('listSubgroups: pages through the immediate subgroups, in every context', async () => {
		const expected = await subgroups(groupId);
		expect(expected).toHaveLength(12);

		const defaults = await runOk({ resource: 'outcomeGroup', operation: 'listSubgroups', params: { context: 'course', courseId, outcomeGroupId: groupId } });
		expect(defaults.map((g) => g.id)).toEqual(expected.map((g) => g.id));

		const twoPages = await runOk({
			resource: 'outcomeGroup',
			operation: 'listSubgroups',
			params: { context: 'course', courseId, outcomeGroupId: groupId, pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(twoPages.map((g) => g.id)).toEqual(expected.slice(0, 10).map((g) => g.id));

		// Only immediate children: the root lists the first group, not the 12 units below it.
		const ofRoot = await runOk({ resource: 'outcomeGroup', operation: 'listSubgroups', params: { context: 'course', courseId, outcomeGroupId: courseRootId } });
		expect(ofRoot.map((g) => String(g.id))).toEqual([groupId]);

		const ofAccount = await runOk({ resource: 'outcomeGroup', operation: 'listSubgroups', params: { context: 'account', accountId, outcomeGroupId: accountRootId } });
		expect(ofAccount.map((g) => String(g.id))).toEqual([accountGroupId]);
		const ofGlobal = await runOk({
			resource: 'outcomeGroup',
			operation: 'listSubgroups',
			params: { context: 'global', outcomeGroupId: globalRootId, pagination: { returnAll: true } },
		});
		expect(ofGlobal.map((g) => String(g.id))).toContain(globalGroupId);

		// A leaf group has no subgroups: no items, no error.
		const leaf = await runNode({ resource: 'outcomeGroup', operation: 'listSubgroups', params: { context: 'course', courseId, outcomeGroupId: targetGroupId } });
		expect(leaf.ok).toBe(true);
		expect(leaf.success).toEqual([]);
		expect(leaf.error).toEqual([]);
	});

	it('update: every field, including a move to another parent group', async () => {
		const moved = String((await subgroups(groupId))[1].id);
		const renamed = unique('Moved & renamed');
		const [updated] = await runOk({
			resource: 'outcomeGroup',
			operation: 'update',
			params: {
				context: 'course',
				courseId,
				outcomeGroupId: moved,
				updateFields: { title: renamed, description: '<em>New</em> description', vendor_guid: 'VG-2', parent_outcome_group_id: targetGroupId },
			},
		});
		expect(updated).toMatchObject({ id: Number(moved), title: renamed });
		expect(await group(moved)).toMatchObject({
			title: renamed,
			description: '<em>New</em> description',
			vendor_guid: 'VG-2',
			parent_outcome_group: { id: Number(targetGroupId) },
		});
		expect((await subgroups(targetGroupId)).map((g) => String(g.id))).toEqual([moved]);
		expect(await subgroups(groupId)).toHaveLength(11);
	});

	it('update: account and global context; a root group cannot be changed', async () => {
		await runOk({
			resource: 'outcomeGroup',
			operation: 'update',
			params: { context: 'account', accountId, outcomeGroupId: accountGroupId, updateFields: { description: 'Account group description' } },
		});
		expect((await canvas().get<Json>(`/api/v1/accounts/${accountId}/outcome_groups/${accountGroupId}`)).description).toBe('Account group description');

		await runOk({
			resource: 'outcomeGroup',
			operation: 'update',
			params: { context: 'global', outcomeGroupId: globalGroupId, updateFields: { vendor_guid: 'GLOBAL-VG' } },
		});
		expect((await canvas().get<Json>(`/api/v1/global/outcome_groups/${globalGroupId}`)).vendor_guid).toBe('GLOBAL-VG');

		const root = await runNode({
			resource: 'outcomeGroup',
			operation: 'update',
			params: { context: 'course', courseId, outcomeGroupId: courseRootId, updateFields: { title: 'Root renamed' }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(root.success).toEqual([]);
		expect(root.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'update' });
		expect((await group(courseRootId)).title).not.toBe('Root renamed');
	});

	it('listOutcomes: abbreviated by default, full on request, across pages', async () => {
		for (let i = 1; i <= 12; i++) {
			outcomeIds.push(await createOutcome(`/api/v1/courses/${courseId}/outcome_groups/${groupId}`, `Outcome ${String(i).padStart(2, '0')}`));
		}
		const expected = await linkedIds(groupId);
		expect(expected).toHaveLength(12);

		const defaults = await runOk({ resource: 'outcomeGroup', operation: 'listOutcomes', params: { context: 'course', courseId, outcomeGroupId: groupId } });
		expect(defaults.map((l) => (l.outcome as Json).id)).toEqual(expected);
		expect(defaults[0]).toMatchObject({ context_type: 'Course', outcome_group: { id: Number(groupId) }, outcome: { title: 'Outcome 01' } });
		expect(defaults[0].outcome).not.toHaveProperty('description');

		const full = await runOk({
			resource: 'outcomeGroup',
			operation: 'listOutcomes',
			params: { context: 'course', courseId, outcomeGroupId: groupId, options: { outcome_style: 'full' }, pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(full.map((l) => (l.outcome as Json).id)).toEqual(expected.slice(0, 10));
		expect(full[0].outcome).toMatchObject({ title: 'Outcome 01', description: '<p>Outcome 01 description</p>' });

		// Canvas itself answers the full form when it is sent outcome_style=abbrev; the node does not.
		const abbreviated = await runOk({
			resource: 'outcomeGroup',
			operation: 'listOutcomes',
			persona: 'teacher',
			params: { context: 'course', courseId, outcomeGroupId: groupId, options: { outcome_style: 'abbrev' }, pagination: { returnAll: true } },
		});
		expect(abbreviated).toHaveLength(12);
		expect(abbreviated[0].outcome).not.toHaveProperty('description');
	});

	it('linkOutcome: links an existing outcome into a second group, then moves a link', async () => {
		const [link] = await runOk({
			resource: 'outcomeGroup',
			operation: 'linkOutcome',
			params: { context: 'course', courseId, outcomeGroupId: targetGroupId, outcomeId: outcomeIds[0] },
		});
		expect(link).toMatchObject({ outcome_group: { id: Number(targetGroupId) }, outcome: { id: outcomeIds[0] } });
		expect(await linkedIds(targetGroupId)).toEqual([outcomeIds[0]]);
		// Still linked into the first group as well.
		expect(await linkedIds(groupId)).toContain(outcomeIds[0]);

		const [moved] = await runOk({
			resource: 'outcomeGroup',
			operation: 'linkOutcome',
			params: { context: 'course', courseId, outcomeGroupId: Number(targetGroupId), outcomeId: String(outcomeIds[1]), options: { move_from: Number(groupId) } },
		});
		expect(moved).toMatchObject({ outcome_group: { id: Number(targetGroupId) }, outcome: { id: outcomeIds[1] } });
		expect((await linkedIds(targetGroupId)).sort()).toEqual([outcomeIds[0], outcomeIds[1]].sort());
		expect(await linkedIds(groupId)).not.toContain(outcomeIds[1]);
	});

	it('linkOutcome: an outcome of the account can be linked into a course of that account, a foreign one cannot', async () => {
		const accountOutcome = await createOutcome(`/api/v1/accounts/${accountId}/outcome_groups/${accountGroupId}`, 'Account outcome');
		const [link] = await runOk({
			resource: 'outcomeGroup',
			operation: 'linkOutcome',
			persona: 'teacher',
			params: { context: 'course', courseId, outcomeGroupId: targetGroupId, outcomeId: accountOutcome },
		});
		expect(link).toMatchObject({ context_type: 'Course', outcome: { id: accountOutcome, context_type: 'Account' } });

		const result = await runNode({
			resource: 'outcomeGroup',
			operation: 'linkOutcome',
			params: { context: 'course', courseId, outcomeGroupId: targetGroupId, outcomeId: '99999999', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'outcomeGroup', operation: 'linkOutcome' });
	});

	it('getAllLinks: every outcome link of a context, with the styles asked for', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/outcome_group_links`);
		expect(expected.length).toBeGreaterThan(12);
		const key = (l: Json): string => `${String((l.outcome_group as Json).id)}:${String((l.outcome as Json).id)}`;

		const defaults = await runOk({ resource: 'outcomeGroup', operation: 'getAllLinks', params: { context: 'course', courseId } });
		expect(defaults.map(key).sort()).toEqual(expected.map(key).sort());
		expect(new Set(defaults.map(key)).size).toBe(defaults.length);
		expect(defaults[0].outcome).not.toHaveProperty('description');
		expect(defaults[0].outcome_group).not.toHaveProperty('description');

		const full = await runOk({
			resource: 'outcomeGroup',
			operation: 'getAllLinks',
			persona: 'teacher',
			params: { context: 'course', courseId, options: { outcome_style: 'full', outcome_group_style: 'full' }, pagination: { perPage: 5, maxPages: 2 } },
		});
		expect(full).toHaveLength(10);
		expect(full[0].outcome).toHaveProperty('description');
		expect(full[0].outcome_group).toHaveProperty('description');

		const accountLinks = await canvas().getAll<Json>(`/api/v1/accounts/${accountId}/outcome_group_links`);
		const fromAccount = await runOk({
			resource: 'outcomeGroup',
			operation: 'getAllLinks',
			params: { context: 'account', accountId, options: { outcome_style: 'abbrev' }, pagination: { returnAll: true } },
		});
		expect(fromAccount.map(key)).toEqual(accountLinks.map(key));
		expect(fromAccount).toHaveLength(1);
	});

	it('unlinkOutcome: removes a link; the outcome itself goes with its last link', async () => {
		const [unlinked] = await runOk({
			resource: 'outcomeGroup',
			operation: 'unlinkOutcome',
			params: { context: 'course', courseId, outcomeGroupId: targetGroupId, outcomeId: outcomeIds[0] },
		});
		expect(unlinked).toMatchObject({ outcome: { id: outcomeIds[0] } });
		expect(await linkedIds(targetGroupId)).not.toContain(outcomeIds[0]);
		expect((await canvas().request('GET', `/api/v1/outcomes/${outcomeIds[0]}`)).status).toBe(200);

		await runOk({
			resource: 'outcomeGroup',
			operation: 'unlinkOutcome',
			params: { context: 'course', courseId, outcomeGroupId: Number(groupId), outcomeId: String(outcomeIds[0]) },
		});
		expect((await canvas().request('GET', `/api/v1/outcomes/${outcomeIds[0]}`)).status).toBe(404);

		const again = await runNode({
			resource: 'outcomeGroup',
			operation: 'unlinkOutcome',
			params: { context: 'course', courseId, outcomeGroupId: groupId, outcomeId: outcomeIds[0], errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'unlinkOutcome' });
	});

	it('import: copies an account group with its outcomes into a course group', async () => {
		const [copy] = await runOk({
			resource: 'outcomeGroup',
			operation: 'import',
			params: { context: 'course', courseId, outcomeGroupId: targetGroupId, sourceOutcomeGroupId: accountGroupId },
		});
		expect(copy).toMatchObject({ context_type: 'Course', context_id: Number(courseId), parent_outcome_group: { id: Number(targetGroupId) } });
		const accountGroup = await canvas().get<Json>(`/api/v1/accounts/${accountId}/outcome_groups/${accountGroupId}`);
		expect(copy.title).toBe(accountGroup.title);
		const copied = await linked(String(copy.id));
		expect(copied.map((l) => (l.outcome as Json).title)).toEqual(['Account outcome']);
	});

	it('import: asynchronously, Canvas returns a Progress that leads to the new group', async () => {
		const [progress] = await runOk({
			resource: 'outcomeGroup',
			operation: 'import',
			params: { context: 'course', courseId, outcomeGroupId: groupId, sourceOutcomeGroupId: Number(globalGroupId), options: { async: true } },
		});
		expect(progress).toMatchObject({ tag: 'import_outcome_group', context_type: 'Course', context_id: Number(courseId) });
		const finished = await waitForProgress(progress.id as number);
		expect(finished.workflow_state).toBe('completed');
		const newGroupId = String((finished.results as Json).outcome_group_id);
		expect((await group(newGroupId)).parent_outcome_group).toMatchObject({ id: Number(groupId) });
	});

	it('import: a root group or a group of an unrelated context is refused', async () => {
		for (const source of [accountRootId, '99999999']) {
			const result = await runNode({
				resource: 'outcomeGroup',
				operation: 'import',
				params: { context: 'course', courseId, outcomeGroupId: groupId, sourceOutcomeGroupId: source, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'import' });
		}
	});

	it('delete: removes a group with its subgroups and links; a root group cannot be deleted', async () => {
		const [deleted] = await runOk({ resource: 'outcomeGroup', operation: 'delete', params: { context: 'course', courseId, outcomeGroupId: targetGroupId } });
		expect(deleted).toMatchObject({ id: Number(targetGroupId) });
		expect((await canvas().request('GET', `/api/v1/courses/${courseId}/outcome_groups/${targetGroupId}`)).status).toBe(404);
		// The outcome that was only linked there is gone with it.
		expect((await canvas().request('GET', `/api/v1/outcomes/${outcomeIds[1]}`)).status).toBe(404);

		const root = await runNode({
			resource: 'outcomeGroup',
			operation: 'delete',
			params: { context: 'course', courseId, outcomeGroupId: courseRootId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(root.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'delete' });

		const [globalDeleted] = await runOk({ resource: 'outcomeGroup', operation: 'delete', params: { context: 'global', outcomeGroupId: globalGroupId } });
		expect(globalDeleted).toMatchObject({ id: Number(globalGroupId) });
		globalGroupId = '';
		const [accountDeleted] = await runOk({ resource: 'outcomeGroup', operation: 'delete', params: { context: 'account', accountId, outcomeGroupId: accountGroupId } });
		expect(accountDeleted).toMatchObject({ id: Number(accountGroupId) });
		accountGroupId = '';
	});

	it('errors: a student can read the groups of the course but not change them; global groups need a site admin', async () => {
		const read = await runOk({ resource: 'outcomeGroup', operation: 'get', persona: 'student', params: { context: 'course', courseId, outcomeGroupId: groupId } });
		expect(read[0]).toMatchObject({ id: Number(groupId), can_edit: false });

		for (const [persona, params] of [
			['student', { context: 'course', courseId, outcomeGroupId: groupId }],
			['teacher', { context: 'global', outcomeGroupId: globalRootId }],
			['teacher', { context: 'account', accountId, outcomeGroupId: accountRootId }],
		] as const) {
			const result = await runNode({
				resource: 'outcomeGroup',
				operation: 'create',
				persona,
				params: { ...params, title: unique('Forbidden'), errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect([401, 403]).toContain(result.error[0].errorCode);
			expect(result.error[0]).toMatchObject({ resource: 'outcomeGroup', operation: 'create' });
		}
	});
});
