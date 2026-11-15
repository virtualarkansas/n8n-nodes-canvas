import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, createUserWithToken, fx, unique } from '../lib/canvas';
import type { TestUser } from '../lib/canvas';
import { createCredential, n8n, runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { sandboxSubAccount, waitFor } from './support/commsSandbox';
import { createSandboxCourse, deleteSandboxCourse, enroll } from './support/gradingSandbox';
import type { SandboxCourse } from './support/gradingSandbox';

/**
 * Resource: group, the operations that look at a group through the eyes of the
 * caller: Get Activity Stream, Get Activity Stream Summary, Get Permissions and
 * Preview HTML.
 *
 * The activity stream is per user, so the group lives in a course of this file's
 * own and has two members created for it: one posts discussions and announcements
 * in the group, the other reads the stream through the node.
 */
describe('group: activity stream, permissions, HTML preview', () => {
	let course: SandboxCourse;
	let reader: TestUser;
	let poster: TestUser;
	let readerCredential: { id: string; name: string; type: string };
	let groupId = '';
	let sisGroupId = '';
	const TOPICS = 12;
	const ANNOUNCEMENTS = 2;
	const eh = { errorHandling: { onError: 'continueWithError' } };

	const stream = (): Promise<Json[]> => reader.client.getAll<Json>(`/api/v1/groups/${groupId}/activity_stream`);

	beforeAll(async () => {
		course = await createSandboxCourse('group-activity', { accountId: await sandboxSubAccount() });
		reader = await createUserWithToken('Group Stream Reader');
		poster = await createUserWithToken('Group Stream Poster');
		readerCredential = await createCredential(reader.token, 'group stream reader');
		for (const user of [reader, poster]) await enroll(course.id, user.id, 'StudentEnrollment');

		const category = await canvas().post<Json>(`/api/v1/courses/${course.id}/group_categories`, { name: unique('Stream teams') });
		sisGroupId = unique('STREAM-GROUP').replace(/\s/g, '-');
		const group = await canvas().post<Json>(`/api/v1/group_categories/${String(category.id)}/groups`, {
			name: 'Stream team',
			sis_group_id: sisGroupId,
		});
		groupId = String(group.id);
		await canvas().put(`/api/v1/groups/${groupId}`, { members: [reader.id, poster.id] });

		// The poster's activity lands in the reader's stream (Canvas does that in background jobs).
		for (let i = 1; i <= TOPICS; i++) {
			await poster.client.post(`/api/v1/groups/${groupId}/discussion_topics`, {
				title: `Stream topic ${String(i).padStart(2, '0')} "quoted" & ünï 話題`,
				message: `<p>Message ${i}</p>`,
				published: true,
			});
		}
		for (let i = 1; i <= ANNOUNCEMENTS; i++) {
			await poster.client.post(`/api/v1/groups/${groupId}/discussion_topics`, {
				title: `Stream announcement ${i}`,
				message: '<p>Listen up</p>',
				is_announcement: true,
				published: true,
			});
		}
		await waitFor(async () => (await stream()).length >= TOPICS + ANNOUNCEMENTS, 300_000, 'the stream items of the group');
	}, 900_000);

	afterAll(async () => {
		await deleteSandboxCourse(course);
		for (const user of [reader, poster]) {
			if (user) await canvas().request('DELETE', `/api/v1/accounts/${fx('accountId')}/users/${user.id}`);
		}
		if (readerCredential) await n8n().api('DELETE', `/credentials/${readerCredential.id}`).catch(() => undefined);
	}, 300_000);

	// ---------------------------------------------------------------- activity stream

	it('getActivityStream: the caller\'s stream of the group, across pages', async () => {
		const expected = await stream();
		expect(expected).toHaveLength(TOPICS + ANNOUNCEMENTS);

		// Default paging: 10 per page, up to 5 pages.
		const byDefault = await runOk({ resource: 'group', operation: 'getActivityStream', credential: readerCredential, params: { groupId } });
		expect(byDefault.map((item) => item.id)).toEqual(expected.map((item) => item.id));
		expect(new Set(byDefault.map((item) => item.id)).size).toBe(TOPICS + ANNOUNCEMENTS);
		expect(byDefault.every((item) => item.context_type === 'Group' && item.group_id === Number(groupId))).toBe(true);
		expect(byDefault.filter((item) => item.type === 'DiscussionTopic')).toHaveLength(TOPICS);
		expect(byDefault.filter((item) => item.type === 'Announcement')).toHaveLength(ANNOUNCEMENTS);
		expect(byDefault.map((item) => String(item.title))).toContain('Stream topic 07 "quoted" & ünï 話題');

		const all = await runOk({
			resource: 'group',
			operation: 'getActivityStream',
			credential: readerCredential,
			params: { groupId: `sis_group_id:${sisGroupId}`, pagination: { returnAll: true } },
		});
		expect(all.map((item) => item.id)).toEqual(expected.map((item) => item.id));

		const twoPages = await runOk({
			resource: 'group',
			operation: 'getActivityStream',
			credential: readerCredential,
			items: [{ group: Number(groupId) }],
			params: { groupId: '={{ $json.group }}', pagination: { perPage: 4, maxPages: 2 } },
		});
		expect(twoPages.map((item) => item.id)).toEqual(expected.slice(0, 8).map((item) => item.id));
	});

	it('getActivityStream: the stream belongs to the caller, so an admin who is not a member gets nothing', async () => {
		const result = await runNode({ resource: 'group', operation: 'getActivityStream', params: { groupId, pagination: { returnAll: true } } });
		expect(result.ok).toBe(true);
		expect(result.success).toEqual([]);
		expect(result.error).toEqual([]);
	});

	it('getActivityStreamSummary: one item per kind of activity, with unread counts', async () => {
		const expected = await reader.client.get<Json[]>(`/api/v1/groups/${groupId}/activity_stream/summary`);
		const summary = await runOk({ resource: 'group', operation: 'getActivityStreamSummary', credential: readerCredential, params: { groupId } });
		expect(summary).toEqual(expected);
		const byType = new Map(summary.map((entry) => [entry.type, entry]));
		expect(byType.get('DiscussionTopic')).toMatchObject({ count: TOPICS, unread_count: TOPICS });
		expect(byType.get('Announcement')).toMatchObject({ count: ANNOUNCEMENTS, unread_count: ANNOUNCEMENTS });

		// Nothing for somebody who is not a member.
		const asAdmin = await runOk({ resource: 'group', operation: 'getActivityStreamSummary', params: { groupId } });
		expect(asAdmin).toEqual([]);
	});

	// ---------------------------------------------------------------- permissions

	it('getPermissions: the named permissions, or all of them, for the caller', async () => {
		const [named] = await runOk({
			resource: 'group',
			operation: 'getPermissions',
			credential: readerCredential,
			params: { groupId, permissions: ' read_roster, post_to_forum ,manage,no_such_permission,' },
		});
		// A member may read and post, not manage; a name Canvas does not know is simply false.
		expect(named).toEqual({ read_roster: true, post_to_forum: true, manage: false, no_such_permission: false });

		// Without names Canvas reports every right of the group.
		const expectedAll = await reader.client.get<Json>(`/api/v1/groups/${groupId}/permissions`);
		const [everything] = await runOk({ resource: 'group', operation: 'getPermissions', credential: readerCredential, params: { groupId } });
		expect(everything).toEqual(expectedAll);
		expect(Object.keys(everything).length).toBeGreaterThan(20);
		expect(everything).toMatchObject({ read: true, participate: true, manage: false, delete: false });

		// The answer depends on who asks: per input item, by SIS ID, as the admin.
		const asAdmin = await runOk({
			resource: 'group',
			operation: 'getPermissions',
			items: [{ names: ['manage', 'delete'] }, { names: 'participate' }],
			params: { groupId: `sis_group_id:${sisGroupId}`, permissions: '={{ $json.names }}' },
		});
		expect(asAdmin).toEqual([{ manage: true, delete: true }, { participate: false }]);
	});

	// ---------------------------------------------------------------- preview HTML

	it('previewHtml: unsafe markup is removed and links to Canvas content are made absolute', async () => {
		const html =
			'<p onclick="steal()">Résumé — 履歴書 &amp; "quotes" <script>alert(1)</script><blink>old</blink> ' +
			`<a href="/groups/${groupId}/files/1/download">a file</a> <img src="/courses/${course.id}/files/2/preview" alt="x"></p>`;
		const expected = await reader.client.post<Json>(`/api/v1/groups/${groupId}/preview_html`, { html });
		const [processed] = await runOk({ resource: 'group', operation: 'previewHtml', credential: readerCredential, params: { groupId, html } });
		expect(processed).toEqual(expected);

		const out = String(processed.html);
		expect(out).toContain('Résumé — 履歴書 &amp; "quotes"');
		expect(out).not.toContain('<script');
		expect(out).not.toContain('onclick');
		expect(out).not.toContain('<blink');
		expect(out).toContain(`href="${canvas().url}/groups/${groupId}/files/1/download"`);
		expect(out).toContain(`data-api-endpoint="${canvas().url}/api/v1/groups/${groupId}/files/1"`);
		expect(out).toContain(`src="${canvas().url}/courses/${course.id}/files/2/preview"`);

		// Plain text comes back as it is; one request per input item.
		const many = await runOk({
			resource: 'group',
			operation: 'previewHtml',
			items: [{ html: 'just text' }, { html: '<ul><li>one</li></ul>' }],
			params: { groupId, html: '={{ $json.html }}' },
		});
		expect(many).toEqual([{ html: 'just text' }, { html: '<ul><li>one</li></ul>' }]);
	});

	// ---------------------------------------------------------------- errors

	it('errors: somebody outside the course is refused, unknown groups are not found', async () => {
		const operations: Array<[string, Json]> = [
			['getActivityStream', {}],
			['getActivityStreamSummary', {}],
			['getPermissions', { permissions: 'read' }],
			['previewHtml', { html: '<p>x</p>' }],
		];
		for (const [operation, params] of operations) {
			const outsider = await runNode({ resource: 'group', operation, persona: 'student', params: { groupId, ...params, ...eh } });
			expect(outsider.success, operation).toEqual([]);
			expect([401, 403], operation).toContain(outsider.error[0].errorCode);
			expect(outsider.error[0], operation).toMatchObject({ resource: 'group', operation });

			const missing = await runNode({
				resource: 'group',
				operation,
				credential: readerCredential,
				items: [{ id: 99999999 }, { id: Number(groupId) }],
				params: { groupId: '={{ $json.id }}', ...params, ...eh },
			});
			expect(missing.error, operation).toHaveLength(1);
			expect(missing.error[0], operation).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', originalItem: { id: 99999999 } });
			// The second item still went through.
			expect(missing.rawSuccess.length, operation).toBeGreaterThan(0);
			expect(missing.rawSuccess.every((item) => (item.pairedItem as Json).item === 1), operation).toBe(true);
		}
	});
});
