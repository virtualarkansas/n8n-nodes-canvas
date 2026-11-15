import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, rmdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { canvas, CanvasClient, fx } from '../lib/canvas';
import { canvasNode, n8n } from '../lib/harness';
import type { RunNodeOptions } from '../lib/harness';
import type { Json, N8nNode, N8nWorkflow } from '../lib/n8n';

/**
 * Shared set-up for the content resources (modules, pages, assignments,
 * submissions, files, folders, media objects).
 *
 * The seeded fixtures must not be modified, and these resources need large
 * collections of their own (more than 100 modules, items, pages, assignments,
 * folders, files, submissions) to exercise pagination. Building those takes a
 * few hundred API calls, so each group of resources gets one persistent course,
 * found again by SIS ID on later runs and topped up when something is missing.
 * Tests only read the bulk records; anything they change they create themselves.
 */

const PREFIX = 'W5682';

/** Run `fn` over `items` with at most `size` requests in flight. */
export async function pool<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
	const results: R[] = new Array<R>(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await fn(items[index], index);
		}
	});
	await Promise.all(workers);
	return results;
}

const LOCK_DIR = resolve(__dirname, '..', '.results', 'locks');

/** Cross-process lock (test files run in parallel workers): only one of them builds a course. */
async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
	mkdirSync(LOCK_DIR, { recursive: true });
	const lock = resolve(LOCK_DIR, name);
	for (;;) {
		try {
			mkdirSync(lock);
			break;
		} catch {
			// Held by another worker; a lock older than 15 minutes is left over from a crash.
			if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs > 15 * 60_000) {
				try {
					rmdirSync(lock);
				} catch {
					// someone else removed it
				}
				continue;
			}
			await new Promise((r) => setTimeout(r, 500));
		}
	}
	try {
		return await fn();
	} finally {
		try {
			rmdirSync(lock);
		} catch {
			// already gone
		}
	}
}

const pad = (n: number): string => String(n).padStart(3, '0');

async function ensureCourse(key: string, name: string): Promise<string> {
	const sisId = `${PREFIX}-${key}`;
	const found = await canvas().request('GET', `/api/v1/courses/sis_course_id:${sisId}`);
	if (found.status === 200) {
		return String((found.data as Json).id);
	}
	const created = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/courses`, {
		course: { name, course_code: sisId, sis_course_id: sisId },
		offer: true,
	});
	return String(created.id);
}

/** Enrol users as active students unless they already are. */
async function ensureStudents(courseId: string, userIds: string[]): Promise<void> {
	const enrolled = await canvas().getAll<Json>(
		`/api/v1/courses/${courseId}/enrollments?type[]=StudentEnrollment&state[]=active&state[]=invited`,
	);
	const have = new Set(enrolled.map((e) => String(e.user_id)));
	await pool(
		userIds.filter((id) => !have.has(id)),
		6,
		(userId) =>
			canvas().post(`/api/v1/courses/${courseId}/enrollments`, {
				enrollment: { user_id: userId, type: 'StudentEnrollment', enrollment_state: 'active', notify: false },
			}),
	);
}

async function ensureGroup(courseId: string, name: string, memberIds: string[] = []): Promise<string> {
	const categories = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/group_categories`);
	let category = categories.find((c) => c.name === `${name} set`);
	category ??= await canvas().post<Json>(`/api/v1/courses/${courseId}/group_categories`, { name: `${name} set` });
	const groups = await canvas().getAll<Json>(`/api/v1/group_categories/${String(category.id)}/groups`);
	let group = groups.find((g) => g.name === name);
	group ??= await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, { name });
	const members = await canvas().getAll<Json>(`/api/v1/groups/${String(group.id)}/memberships`);
	const have = new Set(members.map((m) => String(m.user_id)));
	for (const userId of memberIds.filter((id) => !have.has(id))) {
		await canvas().post(`/api/v1/groups/${String(group.id)}/memberships`, { user_id: userId });
	}
	return String(group.id);
}

// ---------------------------------------------------------------------------
// Modules, module items, pages
// ---------------------------------------------------------------------------

export interface ModulesBattery {
	courseId: string;
	/** Module holding more than 100 items. */
	bigModuleId: string;
	/** Group inside the course (group wiki). */
	groupId: string;
	/**
	 * Published module the student personas can see, for progress operations.
	 * (Canvas caches which modules a student may see for five minutes, so a module
	 * created during a test run is invisible to students for a while.)
	 */
	progress: {
		moduleId: string;
		/** Page item with a "must mark done" requirement. */
		markDoneItemId: string;
		/** Page item with a "must view" requirement. */
		viewItemId: string;
		/** Assignment item with a "must submit" requirement. */
		assignmentItemId: string;
		assignmentId: string;
		markDonePageUrl: string;
		/** Number of items in the module. */
		itemCount: number;
	};
	/**
	 * Mastery path: a trigger assignment (an item of the progress module) whose rule offers
	 * two assignment sets for every score, with the student2 persona graded on the trigger.
	 */
	mastery: {
		triggerItemId: string;
		triggerAssignmentId: string;
		/** [assignment set ID, the assignment it releases] */
		sets: Array<{ setId: string; assignmentId: string }>;
	};
}

export const BULK = 105;

export function ensureModulesBattery(): Promise<ModulesBattery> {
	return withLock('modules', async () => {
		const courseId = await ensureCourse('A', 'W5682 modules and pages battery');
		await ensureStudents(courseId, [fx('studentUserId'), fx('student2UserId')]);

		const modules = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/modules`);
		const haveModules = new Set(modules.map((m) => String(m.name)));
		const wantedModules = Array.from({ length: BULK }, (_, i) => `Bulk module ${pad(i + 1)}`).filter(
			(name) => !haveModules.has(name),
		);
		await pool(wantedModules, 6, (name) => canvas().post(`/api/v1/courses/${courseId}/modules`, { module: { name } }));

		let big = modules.find((m) => m.name === 'Bulk items module');
		big ??= await canvas().post<Json>(`/api/v1/courses/${courseId}/modules`, { module: { name: 'Bulk items module' } });
		const bigModuleId = String(big.id);
		const items = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/modules/${bigModuleId}/items`);
		const haveItems = new Set(items.map((i) => String(i.title)));
		const wantedItems = Array.from({ length: BULK }, (_, i) => `Bulk item ${pad(i + 1)}`).filter(
			(title) => !haveItems.has(title),
		);
		// Positions are assigned on insert; keep these sequential so the order is stable.
		for (const title of wantedItems) {
			await canvas().post(`/api/v1/courses/${courseId}/modules/${bigModuleId}/items`, {
				module_item: { type: 'SubHeader', title },
			});
		}

		const pages = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/pages`);
		const havePages = new Set(pages.map((p) => String(p.title)));
		const wantedPages = Array.from({ length: BULK }, (_, i) => `Bulk page ${pad(i + 1)}`).filter(
			(title) => !havePages.has(title),
		);
		await pool(wantedPages, 6, (title, index) =>
			canvas().post(`/api/v1/courses/${courseId}/pages`, {
				wiki_page: { title, body: `<p>${title}</p>`, published: index % 5 !== 0 },
			}),
		);

		const groupId = await ensureGroup(courseId, 'W5682 wiki group', [fx('studentUserId')]);
		const mastery = await ensureMasteryPath(courseId, modules);
		const progress = await ensureProgressModule(courseId, modules);
		return { courseId, bigModuleId, groupId, progress, mastery };
	});
}

async function ensureMasteryPath(courseId: string, modules: Json[]): Promise<ModulesBattery['mastery']> {
	const settings = await canvas().get<Json>(`/api/v1/courses/${courseId}/settings`);
	if (settings.conditional_release !== true) {
		await canvas().put(`/api/v1/courses/${courseId}/settings`, { conditional_release: true });
	}
	const existing = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments?search_term=MP%20`);
	const assignmentNamed = async (name: string): Promise<string> => {
		const found = existing.find((a) => a.name === name);
		if (found) return String(found.id);
		const created = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: { name, submission_types: ['online_text_entry'], points_possible: 10, published: true },
		});
		return String(created.id);
	};
	const triggerAssignmentId = await assignmentNamed('MP trigger');
	const pathA = await assignmentNamed('MP path A');
	const pathB = await assignmentNamed('MP path B');

	const rules = await canvas().get<Json[]>(`/api/v1/courses/${courseId}/mastery_paths/rules?include[]=all`);
	let rule = rules.find((r) => String(r.trigger_assignment_id) === triggerAssignmentId);
	rule ??= await canvas().post<Json>(`/api/v1/courses/${courseId}/mastery_paths/rules`, {
		trigger_assignment_id: Number(triggerAssignmentId),
		scoring_ranges: [
			{
				lower_bound: 0.0,
				upper_bound: 1.0,
				assignment_sets: [
					{ assignment_set_associations: [{ assignment_id: Number(pathA) }] },
					{ assignment_set_associations: [{ assignment_id: Number(pathB) }] },
				],
			},
		],
	});
	const sets = (((rule.scoring_ranges as Json[])[0].assignment_sets ?? []) as Json[]).map((set) => ({
		setId: String(set.id),
		assignmentId: String(((set.assignment_set_associations as Json[])[0] ?? {}).assignment_id),
	}));

	// The trigger must be an item of the progress module.
	let module = modules.find((m) => m.name === 'Student progress module');
	if (!module) {
		module = await createProgressModule(courseId);
		modules.unshift(module);
	}
	const moduleId = String(module.id);
	const items = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/modules/${moduleId}/items`);
	let trigger = items.find((i) => String(i.content_id) === triggerAssignmentId && i.type === 'Assignment');
	trigger ??= await canvas().post<Json>(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, {
		module_item: { type: 'Assignment', content_id: Number(triggerAssignmentId) },
	});

	const submission = await canvas().get<Json>(
		`/api/v1/courses/${courseId}/assignments/${triggerAssignmentId}/submissions/${fx('student2UserId')}`,
	);
	if (submission.workflow_state !== 'graded') {
		await canvas().put(
			`/api/v1/courses/${courseId}/assignments/${triggerAssignmentId}/submissions/${fx('student2UserId')}`,
			{ submission: { posted_grade: '5' } },
		);
	}
	return { triggerItemId: String(trigger.id), triggerAssignmentId, sets };
}

async function createProgressModule(courseId: string): Promise<Json> {
	const module = await canvas().post<Json>(`/api/v1/courses/${courseId}/modules`, {
		module: { name: 'Student progress module', position: 1 },
	});
	const moduleId = String(module.id);
	const addPage = async (title: string, type: string): Promise<void> => {
		const page = await canvas().post<Json>(`/api/v1/courses/${courseId}/pages`, {
			wiki_page: { title, body: `<p>${title}</p>`, published: true },
		});
		await canvas().post(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, {
			module_item: { type: 'Page', page_url: page.url, completion_requirement: { type } },
		});
	};
	await addPage('Progress page mark done', 'must_mark_done');
	await addPage('Progress page view', 'must_view');
	const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
		assignment: { name: 'Progress assignment', submission_types: ['online_text_entry'], points_possible: 10, published: true },
	});
	await canvas().post(`/api/v1/courses/${courseId}/modules/${moduleId}/items`, {
		module_item: { type: 'Assignment', content_id: assignment.id, completion_requirement: { type: 'must_submit' } },
	});
	await canvas().put(`/api/v1/courses/${courseId}/modules/${moduleId}`, { module: { published: true } });
	return module;
}

async function ensureProgressModule(courseId: string, modules: Json[]): Promise<ModulesBattery['progress']> {
	const module = modules.find((m) => m.name === 'Student progress module') ?? (await createProgressModule(courseId));
	const moduleId = String(module.id);
	const items = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/modules/${moduleId}/items`);
	const byTitle = (title: string): Json => {
		const item = items.find((i) => i.title === title);
		if (!item) throw new Error(`Progress module item "${title}" is missing; delete the module "Student progress module" to rebuild it`);
		return item;
	};
	// Wait until the student personas can see the module and all its items (visibility caches,
	// at most five minutes each).
	const student = new CanvasClient('student');
	const student2 = new CanvasClient('student2');
	const deadline = Date.now() + 11 * 60_000;
	for (;;) {
		const seen = await Promise.all(
			[student, student2].map((client) => client.request('GET', `/api/v1/courses/${courseId}/modules/${moduleId}/items`)),
		);
		if (seen.every((res) => res.status === 200 && (res.data as Json[]).length === items.length)) break;
		if (Date.now() > deadline) throw new Error('Students still cannot see the progress module after eleven minutes');
		await new Promise((r) => setTimeout(r, 5000));
	}
	return {
		moduleId,
		markDoneItemId: String(byTitle('Progress page mark done').id),
		viewItemId: String(byTitle('Progress page view').id),
		assignmentItemId: String(byTitle('Progress assignment').id),
		assignmentId: String(byTitle('Progress assignment').content_id),
		markDonePageUrl: String(byTitle('Progress page mark done').page_url),
		itemCount: items.length,
	};
}

// ---------------------------------------------------------------------------
// Assignments, assignment groups, extensions
// ---------------------------------------------------------------------------

export interface AssignmentsBattery {
	courseId: string;
	/** Assignment group holding the bulk assignments. */
	bulkGroupId: string;
	/** IDs of all assignment groups created for the battery (more than 10). */
	groupIds: string[];
}

export function ensureAssignmentsBattery(): Promise<AssignmentsBattery> {
	return withLock('assignments', async () => {
		const courseId = await ensureCourse('B', 'W5682 assignments battery');
		await ensureStudents(courseId, [fx('studentUserId'), fx('student2UserId')]);

		const groups = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignment_groups`);
		const byName = new Map(groups.map((g) => [String(g.name), g]));
		const groupNames = Array.from({ length: 12 }, (_, i) => `Bulk group ${pad(i + 1)}`);
		for (const name of groupNames.filter((n) => !byName.has(n))) {
			byName.set(name, await canvas().post<Json>(`/api/v1/courses/${courseId}/assignment_groups`, { name }));
		}
		const groupIds = groupNames.map((name) => String(byName.get(name)!.id));
		const bulkGroupId = groupIds[0];

		const assignments = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments`);
		const have = new Set(assignments.map((a) => String(a.name)));
		const wanted = Array.from({ length: BULK }, (_, i) => i).filter((i) => !have.has(`Bulk assignment ${pad(i + 1)}`));
		await pool(wanted, 6, (i) => {
			// A spread of shapes for the filters: due in the past, due in the future, undated; a few posted to SIS.
			const dueAt = i % 3 === 0 ? '2021-03-01T12:00:00Z' : i % 3 === 1 ? '2035-03-01T12:00:00Z' : null;
			return canvas().post(`/api/v1/courses/${courseId}/assignments`, {
				assignment: {
					name: `Bulk assignment ${pad(i + 1)}`,
					assignment_group_id: i < 60 ? bulkGroupId : groupIds[1 + (i % 5)],
					submission_types: i % 4 === 0 ? ['online_url'] : ['online_text_entry'],
					points_possible: 10,
					due_at: dueAt,
					published: i % 7 !== 0,
					post_to_sis: i % 10 === 0,
				},
			});
		});
		return { courseId, bulkGroupId, groupIds };
	});
}

// ---------------------------------------------------------------------------
// Submissions, submission comments, peer reviews
// ---------------------------------------------------------------------------

export interface SubmissionsBattery {
	courseId: string;
	sectionId: string;
	/** Published text/url assignment every bulk student has a submission row for. */
	bulkAssignmentId: string;
	/** Own students (not the personas), more than 50. */
	studentIds: string[];
	/** Students who handed something in on the bulk assignment. */
	submittedIds: string[];
	/** Of those, the ones already graded. */
	gradedIds: string[];
}

export const BULK_STUDENTS = 55;

export function ensureSubmissionsBattery(): Promise<SubmissionsBattery> {
	return withLock('submissions', async () => {
		const courseId = await ensureCourse('C', 'W5682 submissions battery');

		const users = await pool(Array.from({ length: BULK_STUDENTS }, (_, i) => i + 1), 6, async (n) => {
			const sisId = `${PREFIX}-S-${pad(n)}`;
			const found = await canvas().request('GET', `/api/v1/users/sis_user_id:${sisId}`);
			if (found.status === 200) return String((found.data as Json).id);
			const created = await canvas().post<Json>(`/api/v1/accounts/${fx('accountId')}/users`, {
				user: { name: `W5682 Student ${pad(n)}`, skip_registration: true },
				pseudonym: { unique_id: `w5682.student${pad(n)}@example.edu`, sis_user_id: sisId, send_confirmation: false },
				communication_channel: { type: 'email', address: `w5682.student${pad(n)}@example.edu`, skip_confirmation: true },
			});
			return String(created.id);
		});
		await ensureStudents(courseId, [...users, fx('studentUserId'), fx('student2UserId')]);

		const sections = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/sections`);
		const sectionId = String(sections[0].id);

		const assignments = await canvas().getAll<Json>(`/api/v1/courses/${courseId}/assignments?search_term=Bulk%20submissions`);
		let assignment = assignments.find((a) => a.name === 'Bulk submissions');
		assignment ??= await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: {
				name: 'Bulk submissions',
				submission_types: ['online_text_entry', 'online_url'],
				points_possible: 10,
				published: true,
			},
		});
		const bulkAssignmentId = String(assignment.id);

		const submittedIds = users.slice(0, 20);
		const gradedIds = users.slice(0, 10);
		const existing = await canvas().getAll<Json>(
			`/api/v1/courses/${courseId}/assignments/${bulkAssignmentId}/submissions`,
		);
		const state = new Map(existing.map((s) => [String(s.user_id), String(s.workflow_state)]));
		await pool(
			submittedIds.filter((id) => (state.get(id) ?? 'unsubmitted') === 'unsubmitted'),
			4,
			(userId) =>
				canvas().post(`/api/v1/courses/${courseId}/assignments/${bulkAssignmentId}/submissions`, {
					submission: { submission_type: 'online_text_entry', body: `<p>Answer of ${userId}</p>`, user_id: userId },
				}),
		);
		await pool(
			gradedIds.filter((id) => state.get(id) !== 'graded'),
			4,
			(userId, index) =>
				canvas().put(`/api/v1/courses/${courseId}/assignments/${bulkAssignmentId}/submissions/${userId}`, {
					submission: { posted_grade: String(5 + (index % 6)) },
				}),
		);
		return { courseId, sectionId, bulkAssignmentId, studentIds: users, submittedIds, gradedIds };
	});
}

// ---------------------------------------------------------------------------
// Files, folders, media objects
// ---------------------------------------------------------------------------

export interface FilesBattery {
	courseId: string;
	groupId: string;
	rootFolderId: string;
	/** Folder holding more than 100 sub-folders. */
	bulkFoldersId: string;
	/** Folder holding more than 100 files of three content types. */
	bulkFilesId: string;
}

/** Canvas' three-step upload, done directly (set-up and verification only). */
export async function uploadDirect(
	client: CanvasClient,
	preflightPath: string,
	name: string,
	content: Buffer,
	contentType: string,
	extra: Json = {},
): Promise<Json> {
	const step1 = await client.post<Json>(preflightPath, { name, size: content.length, content_type: contentType, ...extra });
	const form = new FormData();
	for (const [key, value] of Object.entries((step1.upload_params ?? {}) as Json)) {
		form.append(key, String(value));
	}
	form.append(String(step1.file_param ?? 'file'), new Blob([content], { type: contentType }), name);
	const step2 = await fetch(String(step1.upload_url), { method: 'POST', body: form, redirect: 'manual' });
	const text = await step2.text();
	if (step2.status >= 400) throw new Error(`upload step 2 -> ${step2.status}: ${text.slice(0, 300)}`);
	let body: Json | undefined;
	try {
		body = JSON.parse(text) as Json;
	} catch {
		// redirect without a body
	}
	if (body?.id !== undefined && step2.status < 300) return body;
	const location = step2.headers.get('location') ?? (body?.location as string | undefined);
	if (!location) throw new Error(`upload step 2 -> ${step2.status} without a location`);
	const confirmed = await client.request('GET', location);
	if (confirmed.status >= 400) throw new Error(`upload step 3 -> ${confirmed.status}`);
	return confirmed.data as Json;
}

/** Download a Canvas file with the admin token (follows the redirect to the file store). */
export async function downloadFile(file: Json): Promise<Buffer> {
	const response = await canvas().request('GET', `/api/v1/files/${String(file.id)}/public_url`);
	const url = String((response.data as Json).public_url ?? file.url);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`download of file ${String(file.id)} -> ${res.status}`);
	return Buffer.from(await res.arrayBuffer());
}

export function ensureFilesBattery(): Promise<FilesBattery> {
	return withLock('files', async () => {
		const courseId = await ensureCourse('D', 'W5682 files battery');
		await ensureStudents(courseId, [fx('studentUserId'), fx('student2UserId')]);
		const groupId = await ensureGroup(courseId, 'W5682 files group', [fx('studentUserId')]);

		const root = await canvas().get<Json>(`/api/v1/courses/${courseId}/folders/root`);
		const rootFolderId = String(root.id);
		const top = await canvas().getAll<Json>(`/api/v1/folders/${rootFolderId}/folders`);
		const folderNamed = async (name: string): Promise<string> => {
			const existing = top.find((f) => f.name === name);
			if (existing) return String(existing.id);
			const created = await canvas().post<Json>(`/api/v1/folders/${rootFolderId}/folders`, { name });
			return String(created.id);
		};
		const bulkFoldersId = await folderNamed('bulk-folders');
		const bulkFilesId = await folderNamed('bulk-files');

		const subFolders = await canvas().getAll<Json>(`/api/v1/folders/${bulkFoldersId}/folders`);
		const haveFolders = new Set(subFolders.map((f) => String(f.name)));
		const wantedFolders = Array.from({ length: BULK }, (_, i) => `folder-${pad(i + 1)}`).filter(
			(name) => !haveFolders.has(name),
		);
		await pool(wantedFolders, 6, (name) => canvas().post(`/api/v1/folders/${bulkFoldersId}/folders`, { name }));

		const files = await canvas().getAll<Json>(`/api/v1/folders/${bulkFilesId}/files`);
		const haveFiles = new Set(files.map((f) => String(f.display_name)));
		const kinds: Array<[string, string, Buffer]> = [
			['txt', 'text/plain', Buffer.from('bulk text file\n')],
			['csv', 'text/csv', Buffer.from('a,b\n1,2\n')],
			// Smallest valid PNG (1x1 transparent pixel).
			[
				'png',
				'image/png',
				Buffer.from(
					'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
					'base64',
				),
			],
		];
		const wantedFiles = Array.from({ length: BULK }, (_, i) => i).filter((i) => {
			const [ext] = kinds[i % kinds.length];
			return !haveFiles.has(`bulk-${pad(i + 1)}.${ext}`);
		});
		await pool(wantedFiles, 4, (i) => {
			const [ext, type, content] = kinds[i % kinds.length];
			return uploadDirect(canvas(), `/api/v1/folders/${bulkFilesId}/files`, `bulk-${pad(i + 1)}.${ext}`, content, type);
		});
		return { courseId, groupId, rootFolderId, bulkFoldersId, bulkFilesId };
	});
}

// ---------------------------------------------------------------------------
// Running the Canvas node with binary input
// ---------------------------------------------------------------------------

export interface BinaryInput {
	/** File name of the binary property (omit to test files without a name). */
	fileName?: string;
	mimeType?: string;
	/** Exact content as base64, or ... */
	b64?: string;
	/** ... a size in bytes: the content is generated by `patternBuffer(size)`. */
	size?: number;
	/** Name of the binary property. Default: data. */
	property?: string;
	/** JSON of the item. */
	json?: Json;
}

/** Deterministic content for generated files, so uploads can be compared byte for byte. */
export function patternBuffer(size: number): Buffer {
	const buffer = Buffer.alloc(size);
	for (let i = 0; i < size; i++) {
		buffer[i] = (i * 31 + (i >> 8) * 7) & 0xff;
	}
	return buffer;
}

const TO_BINARY_CODE = `
const out = [];
for (let index = 0; index < items.length; index++) {
	const input = items[index].json;
	const item = { json: input.json ?? {}, pairedItem: { item: index } };
	if (input.b64 !== undefined || input.size !== undefined) {
		let buffer;
		if (input.b64 !== undefined) {
			buffer = Buffer.from(input.b64, 'base64');
		} else {
			buffer = Buffer.alloc(input.size);
			for (let i = 0; i < input.size; i++) buffer[i] = (i * 31 + (i >> 8) * 7) & 0xff;
		}
		const binary = { data: buffer.toString('base64'), mimeType: input.mimeType ?? 'application/octet-stream' };
		if (input.fileName !== undefined) binary.fileName = input.fileName;
		item.binary = { [input.property ?? 'data']: binary };
	}
	out.push(item);
}
return out;
`;

export interface BinaryRunResult {
	ok: boolean;
	success: Json[];
	error: Json[];
	failure?: { message: string; description?: string };
}

/**
 * Run a Canvas node operation whose input items carry binary data:
 * Webhook -> Split Out -> Code (builds the binary property) -> Canvas.
 */
export async function runWithBinary(opts: RunNodeOptions, inputs: BinaryInput[]): Promise<BinaryRunResult> {
	const api = n8n();
	const node: N8nNode = canvasNode(opts, 'Canvas', [660, 0]);
	const path = `canvas-battery-${randomUUID()}`;
	const workflow: N8nWorkflow = {
		name: `[battery] ${opts.resource}.${opts.operation} (binary)`,
		settings: { executionOrder: 'v1' },
		nodes: [
			{
				id: randomUUID(),
				name: 'Webhook',
				type: 'n8n-nodes-base.webhook',
				typeVersion: 2,
				position: [0, 0],
				webhookId: path,
				parameters: { httpMethod: 'POST', path, responseMode: 'lastNode', options: {} },
			},
			{
				id: randomUUID(),
				name: 'Items',
				type: 'n8n-nodes-base.splitOut',
				typeVersion: 1,
				position: [220, 0],
				parameters: { fieldToSplitOut: 'body.items', options: {} },
			},
			{
				id: randomUUID(),
				name: 'To Binary',
				type: 'n8n-nodes-base.code',
				typeVersion: 2,
				position: [440, 0],
				parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: TO_BINARY_CODE },
			},
			node,
		],
		connections: {
			Webhook: { main: [[{ node: 'Items', type: 'main', index: 0 }]] },
			Items: { main: [[{ node: 'To Binary', type: 'main', index: 0 }]] },
			'To Binary': { main: [[{ node: 'Canvas', type: 'main', index: 0 }]] },
		},
	};
	const workflowId = await api.createWorkflow(workflow);
	try {
		await api.activate(workflowId);
		await api.callWebhook(path, { items: inputs });
		const execution = await api.lastExecution(workflowId, 400);
		const run = execution.nodes.Canvas?.[0];
		const nodeError =
			run?.error ?? execution.error ?? Object.values(execution.nodes).flatMap((runs) => runs.map((r) => r.error)).find(Boolean);
		// Same record the harness writes for runNode(), so the coverage report sees these runs.
		const outcome =
			execution.status !== 'success' ? 'failed' : (run?.outputs[1]?.length ?? 0) > 0 ? 'error-output' : 'success';
		appendFileSync(
			resolve(__dirname, '..', '.results', 'ops.jsonl'),
			JSON.stringify({ resource: opts.resource, operation: opts.operation, outcome, at: new Date().toISOString() }) + '\n',
		);
		return {
			ok: execution.status === 'success',
			success: run?.outputs[0] ?? [],
			error: run?.outputs[1] ?? [],
			failure: nodeError
				? { message: String(nodeError.message ?? ''), description: nodeError.description as string | undefined }
				: undefined,
		};
	} finally {
		await api.deleteWorkflow(workflowId).catch(() => undefined);
	}
}
