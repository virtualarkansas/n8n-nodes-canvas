import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { BULK, ensureModulesBattery, uploadDirect } from './contentBattery';
import type { ModulesBattery } from './contentBattery';

/**
 * Resource: moduleItem. Items are created in two modules of the battery
 * course that this file creates for itself; student progress operations use
 * the long-lived "Student progress module" (see contentBattery.ts).
 */
describe('moduleItem', () => {
	let battery: ModulesBattery;
	let courseId = '';
	let moduleId = '';
	let otherModuleId = '';
	let pageUrl = '';
	let assignmentId = '';
	let discussionId = '';
	let quizId = '';
	let fileId = '';
	const items: Record<string, string> = {};

	const itemFromCanvas = (id: string, module = moduleId, query = ''): Promise<Json> =>
		canvas().get<Json>(`/api/v1/courses/${courseId}/modules/${module}/items/${id}${query}`);

	beforeAll(async () => {
		battery = await ensureModulesBattery();
		courseId = battery.courseId;
		const base = `/api/v1/courses/${courseId}`;
		const [mod, other, page, assignment, discussion, quiz, file] = await Promise.all([
			canvas().post<Json>(`${base}/modules`, { module: { name: unique('Items module') } }),
			canvas().post<Json>(`${base}/modules`, { module: { name: unique('Items target module') } }),
			canvas().post<Json>(`${base}/pages`, { wiki_page: { title: unique('Item page'), body: '<p>x</p>', published: true } }),
			canvas().post<Json>(`${base}/assignments`, {
				assignment: { name: unique('Item assignment'), submission_types: ['online_text_entry'], points_possible: 10, published: true },
			}),
			canvas().post<Json>(`${base}/discussion_topics`, { title: unique('Item discussion'), message: 'talk', published: true }),
			canvas().post<Json>(`${base}/quizzes`, { quiz: { title: unique('Item quiz'), published: true } }),
			uploadDirect(canvas(), `${base}/files`, `${unique('item-file').replace(/\s/g, '-')}.txt`, Buffer.from('module item file'), 'text/plain'),
		]);
		moduleId = String(mod.id);
		otherModuleId = String(other.id);
		pageUrl = String(page.url);
		assignmentId = String(assignment.id);
		discussionId = String(discussion.id);
		quizId = String(quiz.id);
		fileId = String(file.id);
	}, 900_000);

	it('create: a page item with every optional field', async () => {
		const [created] = await runOk({
			resource: 'moduleItem',
			operation: 'create',
			params: {
				courseId,
				moduleId,
				type: 'Page',
				pageUrl,
				additionalFields: {
					completion_requirement_type: 'must_mark_done',
					indent: 2,
					position: 1,
					title: 'Página ünïcode 页面 "quoted" & <b>tags</b>',
				},
			},
		});
		items.page = String(created.id);
		expect(await itemFromCanvas(items.page)).toMatchObject({
			type: 'Page',
			page_url: pageUrl,
			title: 'Página ünïcode 页面 "quoted" & <b>tags</b>',
			indent: 2,
			position: 1,
			completion_requirement: { type: 'must_mark_done' },
		});
	});

	it('create: an assignment item with a minimum score requirement', async () => {
		const [created] = await runOk({
			resource: 'moduleItem',
			operation: 'create',
			items: [{ assignment: Number(assignmentId), module: Number(moduleId) }],
			params: {
				courseId,
				moduleId: '={{ $json.module }}',
				type: 'Assignment',
				contentId: '={{ $json.assignment }}',
				additionalFields: { completion_requirement_type: 'min_score', completion_requirement_min_score: 7.5, position: 2 },
			},
		});
		items.assignment = String(created.id);
		expect(await itemFromCanvas(items.assignment)).toMatchObject({
			type: 'Assignment',
			content_id: Number(assignmentId),
			position: 2,
			completion_requirement: { type: 'min_score', min_score: 7.5 },
		});
	});

	it('create: a minimum score given without a requirement type implies "min score"', async () => {
		const [created] = await runOk({
			resource: 'moduleItem',
			operation: 'create',
			params: { courseId, moduleId, type: 'Quiz', contentId: quizId, additionalFields: { completion_requirement_min_score: 3 } },
		});
		items.quiz = String(created.id);
		expect(await itemFromCanvas(items.quiz)).toMatchObject({
			type: 'Quiz',
			content_id: Number(quizId),
			completion_requirement: { type: 'min_score', min_score: 3 },
		});
	});

	it('create: discussion and file items', async () => {
		const [discussion] = await runOk({
			resource: 'moduleItem',
			operation: 'create',
			params: {
				courseId,
				moduleId,
				type: 'Discussion',
				contentId: discussionId,
				additionalFields: { completion_requirement_type: 'must_contribute' },
			},
		});
		items.discussion = String(discussion.id);
		expect(await itemFromCanvas(items.discussion)).toMatchObject({
			type: 'Discussion',
			content_id: Number(discussionId),
			completion_requirement: { type: 'must_contribute' },
		});

		const [file] = await runOk({
			resource: 'moduleItem',
			operation: 'create',
			params: {
				courseId,
				moduleId,
				type: 'File',
				contentId: fileId,
				additionalFields: { completion_requirement_type: 'must_view', title: 'Renamed through the item' },
			},
		});
		items.file = String(file.id);
		expect(await itemFromCanvas(items.file)).toMatchObject({
			type: 'File',
			content_id: Number(fileId),
			completion_requirement: { type: 'must_view' },
		});
	});

	it('create: external URL, external tool and sub header items', async () => {
		const [url] = await runOk({
			resource: 'moduleItem',
			operation: 'create',
			params: {
				courseId,
				moduleId,
				type: 'ExternalUrl',
				externalUrl: 'https://example.com/path?q=1&r=two%20words#frag',
				title: 'External & "quoted" URL',
				additionalFields: { new_tab: true, indent: 1, completion_requirement_type: 'must_view' },
			},
		});
		items.url = String(url.id);
		expect(await itemFromCanvas(items.url)).toMatchObject({
			type: 'ExternalUrl',
			external_url: 'https://example.com/path?q=1&r=two%20words#frag',
			title: 'External & "quoted" URL',
			new_tab: true,
			indent: 1,
			completion_requirement: { type: 'must_view' },
		});

		const [tool] = await runOk({
			resource: 'moduleItem',
			operation: 'create',
			params: {
				courseId,
				moduleId,
				type: 'ExternalTool',
				externalUrl: 'https://lti.example.com/launch?placement=module',
				title: 'LTI tool item',
				additionalFields: { new_tab: true },
			},
		});
		items.tool = String(tool.id);
		expect(await itemFromCanvas(items.tool)).toMatchObject({
			type: 'ExternalTool',
			external_url: 'https://lti.example.com/launch?placement=module',
			title: 'LTI tool item',
			new_tab: true,
		});

		const [header] = await runOk({
			resource: 'moduleItem',
			operation: 'create',
			params: { courseId, moduleId, type: 'SubHeader', title: 'Section header 🚩' },
		});
		items.header = String(header.id);
		expect(await itemFromCanvas(items.header)).toMatchObject({ type: 'SubHeader', title: 'Section header 🚩' });
		expect(await itemFromCanvas(items.header)).not.toHaveProperty('completion_requirement');
	});

	it('create: Canvas refuses a page that does not exist and an invalid external URL', async () => {
		const result = await runNode({
			resource: 'moduleItem',
			operation: 'create',
			items: [{ slug: 'this-page-does-not-exist' }],
			params: { courseId, moduleId, type: 'Page', pageUrl: '={{ $json.slug }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			errorMessage: 'invalid page_url parameter',
		});

		const badUrl = await runNode({
			resource: 'moduleItem',
			operation: 'create',
			params: {
				courseId,
				moduleId,
				type: 'ExternalUrl',
				externalUrl: 'https://example.com/a b',
				title: 'Bad URL',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(badUrl.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(badUrl.error[0].errorMessage)).toContain('is not a valid URL');
	});

	it('get: returns the item, with content details', async () => {
		const [item] = await runOk({
			resource: 'moduleItem',
			operation: 'get',
			params: { courseId, moduleId, itemId: items.assignment, options: { include: ['content_details'] } },
		});
		expect(item).toMatchObject({ id: Number(items.assignment), type: 'Assignment', content_id: Number(assignmentId) });
		expect(item.content_details).toMatchObject({ points_possible: 10 });

		const [plain] = await runOk({ resource: 'moduleItem', operation: 'get', params: { courseId, moduleId, itemId: items.assignment } });
		expect(plain).not.toHaveProperty('content_details');
	});

	it('get: "student ID" adds the completion state of that student', async () => {
		const [item] = await runOk({
			resource: 'moduleItem',
			operation: 'get',
			params: {
				courseId,
				moduleId: battery.progress.moduleId,
				itemId: battery.progress.assignmentItemId,
				options: { student_id: fx('student2UserId'), include: ['content_details'] },
			},
		});
		expect(item.completion_requirement).toMatchObject({ type: 'must_submit' });
		expect(item.completion_requirement).toHaveProperty('completed');
	});

	it('getAll: pages through more than 100 items in order', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/modules/${battery.bigModuleId}/items`);
		expect(expected.length).toBeGreaterThanOrEqual(BULK);
		const params = { courseId, moduleId: battery.bigModuleId };

		const defaults = await runOk({ resource: 'moduleItem', operation: 'getAll', params });
		expect(defaults.map((i) => i.id)).toEqual(expected.slice(0, 50).map((i) => i.id));

		const all = await runOk({ resource: 'moduleItem', operation: 'getAll', params: { ...params, pagination: { returnAll: true } } });
		expect(all.map((i) => i.id)).toEqual(expected.map((i) => i.id));
		expect(new Set(all.map((i) => i.id)).size).toBe(all.length);

		const some = await runOk({
			resource: 'moduleItem',
			operation: 'getAll',
			params: { ...params, pagination: { perPage: 30, maxPages: 2 } },
		});
		expect(some.map((i) => i.id)).toEqual(expected.slice(0, 60).map((i) => i.id));
	});

	it('getAll: every option', async () => {
		const found = await runOk({
			resource: 'moduleItem',
			operation: 'getAll',
			params: { courseId, moduleId, options: { search_term: 'quoted', include: ['content_details'] } },
		});
		expect(found.map((i) => String(i.id)).sort()).toEqual([items.page, items.url].sort());
		expect(found.find((i) => String(i.id) === items.page)?.content_details).toBeTypeOf('object');

		const progress = await runOk({
			resource: 'moduleItem',
			operation: 'getAll',
			params: { courseId, moduleId: battery.progress.moduleId, options: { student_id: fx('studentUserId') } },
		});
		expect(progress).toHaveLength(battery.progress.itemCount);
		expect(progress[0].completion_requirement).toHaveProperty('completed');

		const everything = await runOk({ resource: 'moduleItem', operation: 'getAll', params: { courseId, moduleId } });
		expect(everything.map((i) => String(i.id)).sort()).toEqual(Object.values(items).sort());
	});

	it('update: every optional field reaches Canvas', async () => {
		const [updated] = await runOk({
			resource: 'moduleItem',
			operation: 'update',
			params: {
				courseId,
				moduleId,
				itemId: items.url,
				updateFields: {
					completion_requirement_type: 'must_view',
					external_url: 'https://example.org/changed?x=1',
					indent: 3,
					new_tab: false,
					position: 1,
					published: true,
					title: 'Changed title ✓',
				},
			},
		});
		expect(updated.id).toBe(Number(items.url));
		expect(await itemFromCanvas(items.url)).toMatchObject({
			external_url: 'https://example.org/changed?x=1',
			indent: 3,
			new_tab: false,
			position: 1,
			published: true,
			title: 'Changed title ✓',
			completion_requirement: { type: 'must_view' },
		});
	});

	it('update: requirement type, minimum score and removal of the requirement', async () => {
		const run = (updateFields: Json): Promise<Json[]> =>
			runOk({ resource: 'moduleItem', operation: 'update', params: { courseId, moduleId, itemId: items.assignment, updateFields } });

		await run({ completion_requirement_type: 'must_submit' });
		expect((await itemFromCanvas(items.assignment)).completion_requirement).toEqual({ type: 'must_submit' });

		await run({ completion_requirement_type: 'min_score', completion_requirement_min_score: 9 });
		expect((await itemFromCanvas(items.assignment)).completion_requirement).toEqual({ type: 'min_score', min_score: 9 });

		await run({ completion_requirement_type: 'none' });
		expect(await itemFromCanvas(items.assignment)).not.toHaveProperty('completion_requirement');
	});

	it('update: renaming an item renames the content; unpublishing unpublishes it', async () => {
		await runOk({
			resource: 'moduleItem',
			operation: 'update',
			params: { courseId, moduleId, itemId: items.page, updateFields: { title: 'Renamed from the module', published: false } },
		});
		const page = await canvas().get<Json>(`/api/v1/courses/${courseId}/pages/${pageUrl}`);
		expect(page).toMatchObject({ title: 'Renamed from the module', published: false });
		pageUrl = String(page.url);
	});

	it('update: "move to module" moves the item and keeps its requirement', async () => {
		const [moved] = await runOk({
			resource: 'moduleItem',
			operation: 'update',
			params: { courseId, moduleId, itemId: items.discussion, updateFields: { module_id: otherModuleId } },
		});
		expect(moved.module_id).toBe(Number(otherModuleId));
		expect(await itemFromCanvas(items.discussion, otherModuleId)).toMatchObject({
			module_id: Number(otherModuleId),
			completion_requirement: { type: 'must_contribute' },
		});
		const left = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/modules/${moduleId}/items`);
		expect(left.map((i) => String(i.id))).not.toContain(items.discussion);
	});

	it('update: turning "new tab" off and back on', async () => {
		const run = (value: boolean): Promise<Json[]> =>
			runOk({ resource: 'moduleItem', operation: 'update', params: { courseId, moduleId, itemId: items.tool, updateFields: { new_tab: value } } });
		await run(false);
		expect((await itemFromCanvas(items.tool)).new_tab).toBe(false);
		await run(true);
		expect((await itemFromCanvas(items.tool)).new_tab).toBe(true);
	});

	it('update: Canvas refuses an unknown target module', async () => {
		const unknownModule = await runNode({
			resource: 'moduleItem',
			operation: 'update',
			params: {
				courseId,
				moduleId,
				itemId: items.header,
				updateFields: { module_id: '999999999' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(unknownModule.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', errorMessage: 'invalid module_id' });
	});

	it('duplicate: copies a page item and its page', async () => {
		const [copy] = await runOk({ resource: 'moduleItem', operation: 'duplicate', params: { courseId, itemId: items.page } });
		const tag = copy.content_tag as Json;
		expect(tag).toMatchObject({ context_module_id: Number(moduleId), content_type: 'WikiPage' });
		items.pageCopy = String(tag.id);
		const actual = await itemFromCanvas(items.pageCopy);
		expect(actual).toMatchObject({ type: 'Page', indent: 2 });
		// "<title> Copy", in the language of the user of the credential.
		expect(String(actual.title)).toMatch(/^Renamed from the module .+/);
		expect(actual.page_url).not.toBe(pageUrl);
		const original = await itemFromCanvas(items.page);
		expect(actual.position).toBe(Number(original.position) + 1);
	});

	it('duplicate: Canvas refuses items that cannot be duplicated', async () => {
		const result = await runNode({
			resource: 'moduleItem',
			operation: 'duplicate',
			items: [{ id: items.header }, { id: items.file }],
			params: { courseId, itemId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error).toHaveLength(2);
		// The message is localized ("Item cannot be duplicated" for an English-speaking user).
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'duplicate' });
		expect(String(result.error[0].errorMessage).length).toBeGreaterThan(3);
	});

	it('getSequence: finds the item an asset belongs to, with its neighbours', async () => {
		const progress = battery.progress;
		const expectCurrent = (result: Json, itemId: string): void => {
			const entries = result.items as Json[];
			expect(entries).toHaveLength(1);
			expect((entries[0].current as Json).id).toBe(Number(itemId));
			expect((result.modules as Json[]).map((m) => String(m.id))).toContain(progress.moduleId);
		};

		const [byItem] = await runOk({
			resource: 'moduleItem',
			operation: 'getSequence',
			params: { courseId, assetType: 'ModuleItem', assetId: progress.viewItemId },
		});
		expectCurrent(byItem, progress.viewItemId);
		expect(((byItem.items as Json[])[0].prev as Json).id).toBe(Number(progress.markDoneItemId));
		expect(((byItem.items as Json[])[0].next as Json).id).toBe(Number(progress.assignmentItemId));

		const [byAssignment] = await runOk({
			resource: 'moduleItem',
			operation: 'getSequence',
			items: [{ id: Number(progress.assignmentId) }],
			params: { courseId, assetType: 'Assignment', assetId: '={{ $json.id }}' },
		});
		expectCurrent(byAssignment, progress.assignmentItemId);

		const [byPage] = await runOk({
			resource: 'moduleItem',
			operation: 'getSequence',
			params: { courseId, assetType: 'Page', assetId: progress.markDonePageUrl },
		});
		expectCurrent(byPage, progress.markDoneItemId);
		// It is the first item of its module: nothing before it, or the last item of an earlier module.
		const previous = (byPage.items as Json[])[0].prev as Json | null;
		expect(previous === null || String(previous.module_id) !== progress.moduleId).toBe(true);
	});

	it('getSequence: the other asset types, and an asset that is in no module', async () => {
		const run = (assetType: string, assetId: string): Promise<Json[]> =>
			runOk({ resource: 'moduleItem', operation: 'getSequence', params: { courseId, assetType, assetId } });

		expect((((await run('Quiz', quizId))[0].items as Json[])[0].current as Json).id).toBe(Number(items.quiz));
		expect((((await run('File', fileId))[0].items as Json[])[0].current as Json).id).toBe(Number(items.file));
		expect((((await run('Discussion', discussionId))[0].items as Json[])[0].current as Json).id).toBe(Number(items.discussion));
		// External tool items are found by the ID of the tool they launch (the seeded account-level tool).
		const tool = await itemFromCanvas(items.tool);
		const byTool = await run('ExternalTool', String(tool.content_id));
		expect((byTool[0].items as Json[]).map((entry) => (entry.current as Json).id)).toContain(Number(items.tool));

		const [none] = await run('Assignment', '999999999');
		expect(none).toEqual({ items: [], modules: [] });
	});

	it('markDone / markNotDone: fulfil and withdraw a "must mark done" requirement as the student', async () => {
		const progress = battery.progress;
		const params = { courseId, moduleId: progress.moduleId, itemId: progress.markDoneItemId };
		const completed = async (): Promise<unknown> =>
			(
				(await itemFromCanvas(progress.markDoneItemId, progress.moduleId, `?student_id=${fx('studentUserId')}`))
					.completion_requirement as Json
			).completed;

		// Canvas answers { message: "OK" } in the student's language.
		const [done] = await runOk({ resource: 'moduleItem', operation: 'markDone', persona: 'student', params });
		expect(done.message).toBeTypeOf('string');
		expect(await completed()).toBe(true);

		const [undone] = await runOk({ resource: 'moduleItem', operation: 'markNotDone', persona: 'student', params });
		expect(undone.message).toBeTypeOf('string');
		expect(await completed()).toBe(false);
	});

	it('markRead: fulfils a "must view" requirement as the student', async () => {
		const progress = battery.progress;
		const [read] = await runOk({
			resource: 'moduleItem',
			operation: 'markRead',
			persona: 'student2',
			params: { courseId, moduleId: progress.moduleId, itemId: progress.viewItemId },
		});
		expect(read.message).toBeTypeOf('string');
		const item = await itemFromCanvas(progress.viewItemId, progress.moduleId, `?student_id=${fx('student2UserId')}`);
		expect((item.completion_requirement as Json).completed).toBe(true);
	});

	it('markDone: an item the student cannot see is "not found"', async () => {
		// The module of this file is unpublished: it does not exist for students.
		const result = await runNode({
			resource: 'moduleItem',
			operation: 'markDone',
			persona: 'student',
			params: { courseId, moduleId, itemId: items.page, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', operation: 'markDone' });
	});

	it('selectMasteryPath: picks an assignment set for a student', async () => {
		const mastery = battery.mastery;
		const overridesOf = async (assignment: string): Promise<string[]> => {
			const overrides = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments/${assignment}/overrides`);
			return overrides.flatMap((o) => ((o.student_ids ?? []) as number[]).map(String));
		};
		// Alternate between the two sets so every run really changes something.
		const before = await overridesOf(mastery.sets[0].assignmentId);
		const [chosen, other] = before.includes(fx('student2UserId')) ? [mastery.sets[1], mastery.sets[0]] : [mastery.sets[0], mastery.sets[1]];

		const [result] = await runOk({
			resource: 'moduleItem',
			operation: 'selectMasteryPath',
			params: {
				courseId,
				moduleId: battery.progress.moduleId,
				itemId: mastery.triggerItemId,
				assignmentSetId: chosen.setId,
				options: { student_id: fx('student2UserId') },
			},
		});
		expect(result.meta).toEqual({ primaryCollection: 'assignments' });
		expect((result.assignments as Json[]).map((a) => String(a.id))).toEqual([chosen.assignmentId]);
		expect(await overridesOf(chosen.assignmentId)).toContain(fx('student2UserId'));
		expect(await overridesOf(other.assignmentId)).not.toContain(fx('student2UserId'));
	});

	it('selectMasteryPath: an item without a mastery path is refused', async () => {
		const result = await runNode({
			resource: 'moduleItem',
			operation: 'selectMasteryPath',
			params: {
				courseId,
				moduleId: battery.progress.moduleId,
				itemId: battery.progress.markDoneItemId,
				assignmentSetId: battery.mastery.sets[0].setId,
				options: { student_id: fx('student2UserId') },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			errorMessage: 'requested item is not an assignment',
		});
	});

	it('errors: a student may not change items; a missing item is not found', async () => {
		const forbidden = await runNode({
			resource: 'moduleItem',
			operation: 'update',
			persona: 'student',
			params: {
				courseId,
				moduleId: battery.progress.moduleId,
				itemId: battery.progress.viewItemId,
				updateFields: { title: 'Hacked' },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(forbidden.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(forbidden.error[0].errorCode);

		const missing = await runNode({
			resource: 'moduleItem',
			operation: 'get',
			items: [{ id: items.header }, { id: 999999999 }],
			params: { courseId, moduleId, itemId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success.map((i) => i.id)).toEqual([Number(items.header)]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'moduleItem' });
	});

	it('delete: removes the items (several input items)', async () => {
		const ids = [items.header, items.tool, items.pageCopy];
		const result = await runNode({
			resource: 'moduleItem',
			operation: 'delete',
			items: ids.map((id) => ({ id })),
			params: { courseId, moduleId, itemId: '={{ $json.id }}' },
		});
		expect(result.success.map((i) => String(i.id))).toEqual(ids);
		const left = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/modules/${moduleId}/items`);
		for (const id of ids) expect(left.map((i) => String(i.id))).not.toContain(id);

		const again = await runNode({
			resource: 'moduleItem',
			operation: 'delete',
			params: { courseId, moduleId, itemId: items.header, errorHandling: { onError: 'continueWithError' } },
		});
		expect(again.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		await canvas().delete(`/api/v1/courses/${courseId}/modules/${moduleId}`);
		await canvas().delete(`/api/v1/courses/${courseId}/modules/${otherModuleId}`);
	});
});
