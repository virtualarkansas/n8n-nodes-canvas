import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { createSandboxCourse, deleteSandboxCourse, waitForProgress } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: customGradebookColumn. Runs in a course of its own with 25 students,
 * so column data is larger than one page and nothing seeded is touched.
 */
describe('customGradebookColumn', () => {
	let course: SandboxCourse;
	let courseId = '';
	let columnId = '';
	const title = unique('Nøtes "quoted" & <b>tags</b> 备注 🗒️');

	const columns = (includeHidden = true): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/courses/${courseId}/custom_gradebook_columns${includeHidden ? '?include_hidden=true' : ''}`);
	const columnData = (id: string | number): Promise<Json[]> =>
		canvas().getAll<Json>(`/api/v1/courses/${courseId}/custom_gradebook_columns/${id}/data?include_hidden=true`);

	beforeAll(async () => {
		course = await createSandboxCourse('columns', { students: 25, personas: ['teacher', 'student'] });
		courseId = course.id;
	});

	afterAll(async () => {
		await deleteSandboxCourse(course);
	});

	it('create: every optional field reaches Canvas', async () => {
		const [created] = await runOk({
			resource: 'customGradebookColumn',
			operation: 'create',
			params: {
				courseId,
				title,
				additionalFields: { hidden: true, position: 3, read_only: true, teacher_notes: true },
			},
		});
		columnId = String(created.id);
		expect(created).toMatchObject({ title, hidden: true, position: 3, read_only: true, teacher_notes: true });

		const actual = (await columns()).find((c) => String(c.id) === columnId);
		expect(actual).toMatchObject({ title, hidden: true, position: 3, read_only: true, teacher_notes: true });
		// Hidden columns are left out unless asked for.
		expect((await columns(false)).map((c) => String(c.id))).not.toContain(columnId);
	});

	it('create: one column per input item, titles from an expression, as a teacher', async () => {
		const titles = Array.from({ length: 12 }, (_, i) => unique(`Column ${i + 1}`));
		const result = await runNode({
			resource: 'customGradebookColumn',
			operation: 'create',
			persona: 'teacher',
			items: titles.map((t) => ({ title: t, course: Number(courseId) })),
			// The course ID arrives as a number from the expression.
			params: { courseId: '={{ $json.course }}', title: '={{ $json.title }}' },
		});
		expect(result.error).toEqual([]);
		expect(result.success.map((c) => c.title)).toEqual(titles);
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual(titles.map((_, i) => i));
		for (const column of result.success) {
			expect(column).toMatchObject({ hidden: false, read_only: false, teacher_notes: false });
		}
		const actual = (await columns()).map((c) => c.title);
		for (const t of titles) expect(actual).toContain(t);
	});

	it('create: Canvas rejects a title the gradebook importer reserves, and says which field', async () => {
		const result = await runNode({
			resource: 'customGradebookColumn',
			operation: 'create',
			params: { courseId, title: 'Student', errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({
			errorCode: 400,
			errorType: 'VALIDATION_ERROR',
			resource: 'customGradebookColumn',
			operation: 'create',
		});
		expect(JSON.stringify(result.error[0].canvasErrors ?? result.error[0].errorMessage)).toContain('title');
	});

	it('update: every optional field reaches Canvas', async () => {
		const renamed = `${title} (renamed)`;
		const [updated] = await runOk({
			resource: 'customGradebookColumn',
			operation: 'update',
			params: {
				courseId,
				columnId,
				updateFields: { title: renamed, hidden: false, position: 1, read_only: false, teacher_notes: false },
			},
		});
		expect(updated).toMatchObject({ id: Number(columnId), title: renamed });

		const actual = (await columns(false)).find((c) => String(c.id) === columnId);
		expect(actual).toMatchObject({ title: renamed, hidden: false, position: 1, read_only: false, teacher_notes: false });
	});

	it('update: an update without fields is refused by Canvas and reported as such', async () => {
		const result = await runNode({
			resource: 'customGradebookColumn',
			operation: 'update',
			params: { courseId, columnId, updateFields: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', operation: 'update' });
	});

	it('getAll: pages through all columns, hidden ones only on request', async () => {
		const hidden = await canvas().post<Json>(`/api/v1/courses/${courseId}/custom_gradebook_columns`, {
			column: { title: unique('Hidden column'), hidden: true },
		});
		const visible = await columns(false);
		const everything = await columns(true);
		expect(visible.length, 'the sandbox course should hold more columns than one page').toBeGreaterThan(10);
		expect(everything.length).toBe(visible.length + 1);

		const defaults = await runOk({ resource: 'customGradebookColumn', operation: 'getAll', params: { courseId } });
		expect(defaults.map((c) => c.id)).toEqual(visible.map((c) => c.id));

		const withHidden = await runOk({
			resource: 'customGradebookColumn',
			operation: 'getAll',
			params: { courseId, options: { include_hidden: true }, pagination: { returnAll: true } },
		});
		expect(withHidden.map((c) => c.id).sort()).toEqual(everything.map((c) => c.id).sort());
		expect(withHidden.map((c) => c.id)).toContain(hidden.id);

		const twoPages = await runOk({
			resource: 'customGradebookColumn',
			operation: 'getAll',
			params: { courseId, pagination: { perPage: 3, maxPages: 2 } },
		});
		expect(twoPages.map((c) => c.id)).toEqual(visible.slice(0, 6).map((c) => c.id));
	});

	it('getAll: accepts a SIS course ID', async () => {
		const listed = await runOk({
			resource: 'customGradebookColumn',
			operation: 'getAll',
			params: { courseId: `sis_course_id:${course.sisId}`, pagination: { returnAll: true } },
		});
		expect(listed.map((c) => c.id)).toEqual((await columns(false)).map((c) => c.id));
	});

	it('reorder: puts the columns in the given order', async () => {
		const before = (await columns(false)).map((c) => Number(c.id));
		const reversed = [...before].reverse();
		const [result] = await runOk({
			resource: 'customGradebookColumn',
			operation: 'reorder',
			// Spaces after the commas, as people type lists.
			params: { courseId, order: reversed.join(', ') },
		});
		expect(result).toEqual({});
		expect((await columns(false)).map((c) => Number(c.id))).toEqual(reversed);
	});

	it('updateColumnData: sets, overwrites and (with empty content) deletes a student\'s entry', async () => {
		const [student, other] = course.studentIds;
		const text = 'Nut allergy — "EpiPen" in bag & <office>; عربى 🥜';
		const [datum] = await runOk({
			resource: 'customGradebookColumn',
			operation: 'updateColumnData',
			params: { courseId, columnId, userId: String(student), content: text },
		});
		expect(datum).toMatchObject({ user_id: student, content: text });
		expect(await columnData(columnId)).toEqual([{ user_id: student, content: text }]);

		// IDs as numbers from an expression, two items, one of them not a student of the course.
		const result = await runNode({
			resource: 'customGradebookColumn',
			operation: 'updateColumnData',
			items: [
				{ user: student, note: 'Second version' },
				{ user: Number(fx('adminUserId')), note: 'not a student' },
				{ user: other, note: 'x'.repeat(255) },
			],
			params: {
				courseId: Number(courseId),
				columnId: Number(columnId),
				userId: '={{ $json.user }}',
				content: '={{ $json.note }}',
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([
			{ user_id: student, content: 'Second version' },
			{ user_id: other, content: 'x'.repeat(255) },
		]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', originalItem: { note: 'not a student' } });

		// Empty content removes the entry.
		await runOk({
			resource: 'customGradebookColumn',
			operation: 'updateColumnData',
			params: { courseId, columnId, userId: String(other), content: '' },
		});
		expect(await columnData(columnId)).toEqual([{ user_id: student, content: 'Second version' }]);
	});

	it('updateColumnData: content longer than Canvas stores is rejected', async () => {
		const result = await runNode({
			resource: 'customGradebookColumn',
			operation: 'updateColumnData',
			params: {
				courseId,
				columnId,
				userId: String(course.studentIds[2]),
				content: 'y'.repeat(256),
				errorHandling: { onError: 'continueWithError' },
			},
		});
		// Canvas answers 200 with the validation errors as the body instead of a datum.
		const stored = (await columnData(columnId)).find((d) => d.user_id === course.studentIds[2]);
		expect(stored).toBeUndefined();
		expect(result.success.length + result.error.length).toBe(1);
		if (result.success.length === 1) {
			expect(result.success[0]).not.toHaveProperty('user_id');
			expect(JSON.stringify(result.success[0])).toContain('content');
		}
	});

	it('bulkUpdateData: writes entries for many students and columns through a background job', async () => {
		const second = await canvas().post<Json>(`/api/v1/courses/${courseId}/custom_gradebook_columns`, {
			column: { title: unique('Bulk target') },
		});
		const entries = [
			...course.studentIds.map((userId, i) => ({ column_id: columnId, user_id: String(userId), content: `Seat ${i + 1} — row "A" & more` })),
			// IDs as numbers, the way they arrive from earlier nodes.
			{ column_id: second.id, user_id: course.studentIds[0], content: 'Other column' },
		];
		const [progress] = await runOk({
			resource: 'customGradebookColumn',
			operation: 'bulkUpdateData',
			params: { courseId, columnData: { dataEntry: entries } },
		});
		expect(progress).toMatchObject({ context_type: 'Course', context_id: Number(courseId), tag: 'custom_columns_submissions_update' });
		expect((await waitForProgress(progress.id as number)).workflow_state).toBe('completed');

		const stored = await columnData(columnId);
		expect(stored).toHaveLength(course.studentIds.length);
		expect(stored.find((d) => d.user_id === course.studentIds[4])).toEqual({ user_id: course.studentIds[4], content: 'Seat 5 — row "A" & more' });
		expect(await columnData(second.id as number)).toEqual([{ user_id: course.studentIds[0], content: 'Other column' }]);
	});

	it('bulkUpdateData: an empty content deletes the entry', async () => {
		const [progress] = await runOk({
			resource: 'customGradebookColumn',
			operation: 'bulkUpdateData',
			params: {
				courseId,
				columnData: { dataEntry: [{ column_id: columnId, user_id: String(course.studentIds[24]), content: '' }] },
			},
		});
		await waitForProgress(progress.id as number);
		const stored = await columnData(columnId);
		expect(stored).toHaveLength(24);
		expect(stored.map((d) => d.user_id)).not.toContain(course.studentIds[24]);
	});

	it('bulkUpdateData: a user who is not a student of the course is refused before anything is written', async () => {
		const result = await runNode({
			resource: 'customGradebookColumn',
			operation: 'bulkUpdateData',
			params: {
				courseId,
				columnData: {
					dataEntry: [
						{ column_id: columnId, user_id: String(course.studentIds[0]), content: 'must not be written' },
						{ column_id: columnId, user_id: fx('adminUserId'), content: 'nope' },
					],
				},
				errorHandling: { onError: 'continueWithError' },
			},
		});
		expect(result.success).toEqual([]);
		expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation: 'bulkUpdateData' });
		expect([401, 403]).toContain(result.error[0].errorCode);
		expect((await columnData(columnId)).find((d) => d.user_id === course.studentIds[0])?.content).not.toBe('must not be written');
	});

	it('bulkUpdateData: at least one entry is required', async () => {
		const result = await runNode({
			resource: 'customGradebookColumn',
			operation: 'bulkUpdateData',
			params: { courseId, columnData: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(result.success).toEqual([]);
		expect(String(result.error[0].errorMessage)).toMatch(/at least one data entry/i);
	});

	it('getColumnData: returns every entry exactly once, across pages', async () => {
		const expected = await columnData(columnId);
		expect(expected.length).toBeGreaterThan(20);

		const defaults = await runOk({ resource: 'customGradebookColumn', operation: 'getColumnData', params: { courseId, columnId } });
		expect(defaults).toHaveLength(expected.length);
		expect(defaults.map((d) => d.user_id).sort()).toEqual(expected.map((d) => d.user_id).sort());
		expect(new Set(defaults.map((d) => d.user_id)).size).toBe(defaults.length);

		const twoPages = await runOk({
			resource: 'customGradebookColumn',
			operation: 'getColumnData',
			params: { courseId, columnId, pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(twoPages).toHaveLength(8);
		expect(new Set(twoPages.map((d) => d.user_id)).size).toBe(8);

		const all = await runOk({
			resource: 'customGradebookColumn',
			operation: 'getColumnData',
			params: { courseId, columnId, pagination: { returnAll: true } },
		});
		expect(all).toEqual(expect.arrayContaining(expected));
		expect(all).toHaveLength(expected.length);
	});

	it('getColumnData: a column without entries yields no items; a hidden column needs "Include Hidden"', async () => {
		const hidden = await canvas().post<Json>(`/api/v1/courses/${courseId}/custom_gradebook_columns`, {
			column: { title: unique('Hidden with data'), hidden: true },
		});
		const empty = await runNode({
			resource: 'customGradebookColumn',
			operation: 'getColumnData',
			params: { courseId, columnId: String(hidden.id), options: { include_hidden: true } },
		});
		expect(empty.ok).toBe(true);
		expect(empty.success).toEqual([]);
		expect(empty.error).toEqual([]);

		await canvas().put(`/api/v1/courses/${courseId}/custom_gradebook_columns/${String(hidden.id)}/data/${course.studentIds[0]}`, {
			column_data: { content: 'in a hidden column' },
		});
		const refused = await runNode({
			resource: 'customGradebookColumn',
			operation: 'getColumnData',
			params: { courseId, columnId: String(hidden.id), errorHandling: { onError: 'continueWithError' } },
		});
		expect(refused.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const shown = await runOk({
			resource: 'customGradebookColumn',
			operation: 'getColumnData',
			params: { courseId, columnId: String(hidden.id), options: { include_hidden: true } },
		});
		expect(shown).toEqual([{ user_id: course.studentIds[0], content: 'in a hidden column' }]);
	});

	it('delete: removes the column and its data', async () => {
		const [deleted] = await runOk({ resource: 'customGradebookColumn', operation: 'delete', params: { courseId, columnId } });
		expect(deleted).toMatchObject({ id: Number(columnId) });
		expect((await columns()).map((c) => String(c.id))).not.toContain(columnId);
	});

	it('errors: a deleted column is "not found" for update and delete', async () => {
		for (const operation of ['update', 'delete']) {
			const result = await runNode({
				resource: 'customGradebookColumn',
				operation,
				params: { courseId, columnId, updateFields: { title: 'gone' }, errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'customGradebookColumn', operation });
		}
	});

	it('errors: a student may neither read nor create columns', async () => {
		for (const operation of ['getAll', 'create']) {
			const result = await runNode({
				resource: 'customGradebookColumn',
				operation,
				persona: 'student',
				params: { courseId, title: unique('Forbidden'), errorHandling: { onError: 'continueWithError' } },
			});
			expect(result.success).toEqual([]);
			expect(result.error[0]).toMatchObject({ errorType: 'FORBIDDEN', operation });
			expect([401, 403]).toContain(result.error[0].errorCode);
		}
	});
});
