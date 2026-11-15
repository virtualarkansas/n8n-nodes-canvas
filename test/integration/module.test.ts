import { beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { BULK, ensureModulesBattery } from './contentBattery';
import type { ModulesBattery } from './contentBattery';

/**
 * Resource: module. Runs in a dedicated course that holds more than 100
 * modules and one module with more than 100 items (see contentBattery.ts).
 */
describe('module', () => {
	let battery: ModulesBattery;
	let courseId = '';
	let moduleId = '';
	let prereqA = '';
	let prereqB = '';
	const name = unique('Módulo ünïcode 模块 🚀 "quoted" & <b>tags</b>');

	const moduleFromCanvas = (id: string, query = ''): Promise<Json> =>
		canvas().get<Json>(`/api/v1/courses/${courseId}/modules/${id}${query}`);

	beforeAll(async () => {
		battery = await ensureModulesBattery();
		courseId = battery.courseId;
	}, 900_000);

	it('create: minimal module is created unpublished; "position" inserts it at that place', async () => {
		const [created] = await runOk({ resource: 'module', operation: 'create', params: { courseId, name: unique('Prereq A') } });
		prereqA = String(created.id);
		expect(created).toMatchObject({ published: false, prerequisite_module_ids: [], require_sequential_progress: false });
		expect(created.position).toBeTypeOf('number');

		// Canvas only accepts prerequisites that come earlier in the course, and modules created
		// through the API without a position can end up sharing one. Place them explicitly.
		await canvas().put(`/api/v1/courses/${courseId}/modules/${prereqA}`, { module: { position: 1 } });
		const [second] = await runOk({
			resource: 'module',
			operation: 'create',
			params: { courseId, name: unique('Prereq B'), additionalFields: { position: 2 } },
		});
		prereqB = String(second.id);
		expect((await moduleFromCanvas(prereqB)).position).toBe(2);
		expect((await moduleFromCanvas(prereqA)).position).toBe(1);
	});

	it('create: every optional field reaches Canvas', async () => {
		const [created] = await runOk({
			resource: 'module',
			operation: 'create',
			params: {
				courseId,
				name,
				additionalFields: {
					position: 3,
					prerequisite_module_ids: ` ${prereqA}, ${prereqB} `,
					publish_final_grade: true,
					require_sequential_progress: true,
					unlock_at: '2031-02-03T04:05:00Z',
				},
			},
		});
		moduleId = String(created.id);
		expect(created.name).toBe(name);

		const actual = await moduleFromCanvas(moduleId);
		expect(actual).toMatchObject({
			name,
			unlock_at: '2031-02-03T04:05:00Z',
			require_sequential_progress: true,
			publish_final_grade: true,
			prerequisite_module_ids: [Number(prereqA), Number(prereqB)],
			published: false,
			position: 3,
		});
	});

	it('create: a single prerequisite arriving as a number from an expression works', async () => {
		const result = await runNode({
			resource: 'module',
			operation: 'create',
			items: [{ prereq: Number(prereqA), title: unique('Expr prereq') }],
			params: {
				courseId: `={{ ${courseId} }}`,
				name: '={{ $json.title }}',
				additionalFields: { position: 4, prerequisite_module_ids: '={{ $json.prereq }}' },
			},
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		const created = result.success[0];
		expect((await moduleFromCanvas(String(created.id))).prerequisite_module_ids).toEqual([Number(prereqA)]);
		await canvas().delete(`/api/v1/courses/${courseId}/modules/${String(created.id)}`);
	});

	it('get: returns the module, with items and content details', async () => {
		const page = await canvas().post<Json>(`/api/v1/courses/${courseId}/pages`, {
			wiki_page: { title: unique('Module get page'), published: true },
		});
		await canvas().post(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, {
			module_item: { type: 'Page', page_url: page.url },
		});
		const [module] = await runOk({
			resource: 'module',
			operation: 'get',
			params: { courseId, moduleId, options: { include: ['items', 'content_details'] } },
		});
		expect(module).toMatchObject({ id: Number(moduleId), name, items_count: 1 });
		const items = module.items as Json[];
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({ type: 'Page', page_url: page.url });
		expect(items[0].content_details).toBeTypeOf('object');
	});

	it('get: "student ID" adds that student\'s progress (modules the student can see only)', async () => {
		const params = { courseId, moduleId: '={{ $json.id }}', options: { student_id: fx('studentUserId') } };
		// An unpublished module does not exist from the student's point of view.
		const hidden = await runNode({
			resource: 'module',
			operation: 'get',
			items: [{ id: Number(moduleId) }],
			params: { ...params, errorHandling: { onError: 'continueWithError' } },
		});
		expect(hidden.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const [module] = await runOk({
			resource: 'module',
			operation: 'get',
			items: [{ id: Number(battery.progress.moduleId) }],
			params: { ...params, options: { student_id: fx('studentUserId'), include: ['items'] } },
		});
		expect(['unlocked', 'started', 'completed']).toContain(module.state);
		expect(module).toHaveProperty('completed_at');
		expect((module.items as Json[])[0].completion_requirement).toHaveProperty('completed');
		const [plain] = await runOk({ resource: 'module', operation: 'get', params: { courseId, moduleId: battery.progress.moduleId } });
		expect(plain).not.toHaveProperty('state');
	});

	it('getAll: pages through more than 100 modules without duplicates', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/modules`);
		expect(expected.length).toBeGreaterThan(BULK);

		const defaults = await runOk({ resource: 'module', operation: 'getAll', params: { courseId } });
		expect(defaults).toHaveLength(50);
		expect(defaults.map((m) => m.id)).toEqual(expected.slice(0, 50).map((m) => m.id));

		const all = await runOk({ resource: 'module', operation: 'getAll', params: { courseId, pagination: { returnAll: true } } });
		expect(all.map((m) => m.id)).toEqual(expected.map((m) => m.id));
		expect(new Set(all.map((m) => m.id)).size).toBe(all.length);

		const some = await runOk({
			resource: 'module',
			operation: 'getAll',
			params: { courseId, pagination: { perPage: 7, maxPages: 3 } },
		});
		expect(some.map((m) => m.id)).toEqual(expected.slice(0, 21).map((m) => m.id));
	});

	it('getAll: search term filters, include adds the items', async () => {
		const expected = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/modules?search_term=Bulk%20module%2001`);
		expect(expected.length).toBeGreaterThanOrEqual(10);
		const found = await runOk({
			resource: 'module',
			operation: 'getAll',
			params: { courseId, options: { search_term: 'Bulk module 01' }, pagination: { returnAll: true } },
		});
		expect(found.map((m) => m.id).sort()).toEqual(expected.map((m) => m.id).sort());
		for (const module of found) expect(String(module.name)).toContain('Bulk module 01');

		// Names with quotes, ampersands and non-ASCII characters survive the query string.
		const byName = await runOk({ resource: 'module', operation: 'getAll', params: { courseId, options: { search_term: name } } });
		expect(byName.map((m) => m.id)).toEqual([Number(moduleId)]);

		const withItems = await runOk({
			resource: 'module',
			operation: 'getAll',
			params: {
				courseId,
				options: { search_term: 'Student progress', include: ['items', 'content_details'], student_id: fx('student2UserId') },
			},
		});
		expect(withItems).toHaveLength(1);
		expect(withItems[0].id).toBe(Number(battery.progress.moduleId));
		expect((withItems[0].items as Json[]).length).toBe(battery.progress.itemCount);
		expect((withItems[0].items as Json[])[0].content_details).toBeTypeOf('object');
		expect(withItems[0]).toHaveProperty('state');

		const none = await runOk({
			resource: 'module',
			operation: 'getAll',
			params: { courseId, options: { search_term: 'no module is called like this zzz' } },
		});
		expect(none).toEqual([]);
	});

	it('update: every optional field reaches Canvas', async () => {
		const renamed = `${name} (renamed)`;
		const [updated] = await runOk({
			resource: 'module',
			operation: 'update',
			params: {
				courseId,
				moduleId,
				updateFields: {
					name: renamed,
					prerequisite_module_ids: prereqB,
					publish_final_grade: false,
					published: false,
					require_sequential_progress: false,
					unlock_at: '2032-01-01T00:00:00Z',
				},
			},
		});
		expect(updated.name).toBe(renamed);
		const actual = await moduleFromCanvas(moduleId, '?include[]=items');
		expect(actual).toMatchObject({
			name: renamed,
			unlock_at: '2032-01-01T00:00:00Z',
			require_sequential_progress: false,
			publish_final_grade: false,
			prerequisite_module_ids: [Number(prereqB)],
			published: false,
		});
		// Unpublishing a module unpublishes its items too.
		expect((actual.items as Json[])[0].published).toBe(false);
	});

	it('update: an empty prerequisite list removes all prerequisites, an empty date clears the date', async () => {
		await runOk({
			resource: 'module',
			operation: 'update',
			params: { courseId, moduleId, updateFields: { prerequisite_module_ids: '', unlock_at: '', published: true } },
		});
		const actual = await moduleFromCanvas(moduleId, '?include[]=items');
		expect(actual).toMatchObject({ prerequisite_module_ids: [], unlock_at: null, published: true });
		expect((actual.items as Json[])[0].published).toBe(true);
	});

	it('update: "position" moves the module', async () => {
		await runOk({ resource: 'module', operation: 'update', params: { courseId, moduleId, updateFields: { position: 1 } } });
		expect((await moduleFromCanvas(moduleId)).position).toBe(1);
		const first = await canvas().get<Json[]>(`/api/v1/courses/${courseId}/modules?per_page=1`);
		expect(first[0].id).toBe(Number(moduleId));
		expect((await moduleFromCanvas(prereqA)).position).toBe(2);
	});

	it('listItems: pages through more than 100 items in order', async () => {
		const path = `/api/v1/courses/${courseId}/modules/${battery.bigModuleId}/items`;
		const expected = await canvas().getAll<Json>(path);
		expect(expected.length).toBeGreaterThanOrEqual(BULK);

		const params = { courseId, moduleId: battery.bigModuleId };
		const defaults = await runOk({ resource: 'module', operation: 'listItems', params });
		expect(defaults.map((i) => i.id)).toEqual(expected.slice(0, 50).map((i) => i.id));

		const all = await runOk({ resource: 'module', operation: 'listItems', params: { ...params, pagination: { returnAll: true } } });
		expect(all.map((i) => i.id)).toEqual(expected.map((i) => i.id));

		const some = await runOk({
			resource: 'module',
			operation: 'listItems',
			params: { ...params, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(some.map((i) => i.id)).toEqual(expected.slice(0, 8).map((i) => i.id));
	});

	it('listItems: options filter and enrich the items', async () => {
		const filtered = await runOk({
			resource: 'module',
			operation: 'listItems',
			params: { courseId, moduleId: battery.bigModuleId, options: { search_term: 'Bulk item 10' } },
		});
		expect(filtered.map((i) => i.title).sort()).toEqual(
			['Bulk item 100', 'Bulk item 101', 'Bulk item 102', 'Bulk item 103', 'Bulk item 104', 'Bulk item 105'],
		);
		const detailed = await runOk({
			resource: 'module',
			operation: 'listItems',
			params: {
				courseId,
				moduleId: battery.progress.moduleId,
				options: { include: ['content_details'], student_id: fx('studentUserId') },
			},
		});
		expect(detailed).toHaveLength(battery.progress.itemCount);
		for (const item of detailed) {
			expect(item.content_details).toBeTypeOf('object');
		}
		expect(detailed[0].completion_requirement).toHaveProperty('completed');
		const plain = await runOk({ resource: 'module', operation: 'listItems', params: { courseId, moduleId: battery.progress.moduleId } });
		expect(plain[0].completion_requirement).not.toHaveProperty('completed');
		expect(plain[0]).not.toHaveProperty('content_details');
	});

	it('listItems: an empty module yields no items', async () => {
		const items = await runOk({ resource: 'module', operation: 'listItems', params: { courseId, moduleId: prereqA } });
		expect(items).toEqual([]);
	});

	it('relock: resets progressions and returns the module', async () => {
		const [module] = await runOk({ resource: 'module', operation: 'relock', params: { courseId, moduleId } });
		expect(module).toMatchObject({ id: Number(moduleId) });
	});

	it('several items: successes and failures are reported per item', async () => {
		const result = await runNode({
			resource: 'module',
			operation: 'get',
			items: [{ id: moduleId }, { id: 999999999 }, { id: prereqA }],
			params: { courseId, moduleId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success.map((m) => m.id)).toEqual([Number(moduleId), Number(prereqA)]);
		expect(result.rawSuccess.map((i) => i.pairedItem)).toEqual([{ item: 0 }, { item: 2 }]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'module', operation: 'get' });
		expect((result.error[0].originalItem as Json).id).toBe(999999999);
	});

	it('errors: a student may not create or delete modules', async () => {
		const result = await runNode({
			resource: 'module',
			operation: 'create',
			persona: 'student',
			params: { courseId, name: unique('Forbidden'), errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(result.error[0].errorCode);
	});

	it('errors: a prerequisite that does not exist is ignored by Canvas, a missing name is refused', async () => {
		const [created] = await runOk({
			resource: 'module',
			operation: 'create',
			params: { courseId, name: unique('Bad prereq'), additionalFields: { prerequisite_module_ids: '999999999' } },
		});
		expect((await moduleFromCanvas(String(created.id))).prerequisite_module_ids).toEqual([]);
		await canvas().delete(`/api/v1/courses/${courseId}/modules/${String(created.id)}`);

		const result = await runNode({
			resource: 'module',
			operation: 'create',
			items: [{ other: 1 }],
			params: { courseId, name: '={{ $json.title }}', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			errorMessage: 'missing module name',
		});
	});

	it('delete: removes the modules', async () => {
		const result = await runNode({
			resource: 'module',
			operation: 'delete',
			items: [{ id: moduleId }, { id: prereqA }, { id: prereqB }],
			params: { courseId, moduleId: '={{ $json.id }}' },
		});
		expect(result.success.map((m) => m.id)).toEqual([Number(moduleId), Number(prereqA), Number(prereqB)]);
		for (const id of [moduleId, prereqA, prereqB]) {
			expect((await canvas().request('GET', `/api/v1/courses/${courseId}/modules/${id}`)).status).toBe(404);
		}
	});

	it('errors: deleting a module twice reports not found', async () => {
		const result = await runNode({
			resource: 'module',
			operation: 'delete',
			params: { courseId, moduleId, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });
	});
});
