import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { ensureFilesBattery } from './contentBattery';
import type { FilesBattery } from './contentBattery';

/**
 * Resource: mediaObject. The local Canvas has no media server (Kaltura), so
 * media objects are registered by ID the way the media plugin does it after an
 * upload; Canvas keeps titles and caption tracks itself, which is what the
 * operations work on. Listing media *sources* needs the media server and
 * fails on this instance, as the tests show.
 */
describe('mediaObject', () => {
	let battery: FilesBattery;
	let courseId = '';
	const run = unique('m').replace(/[^a-z0-9]/gi, '').toLowerCase();
	const courseMedia = [`m-${run}a`, `m-${run}b`, `m-${run}c`];
	const groupMedia = `m-${run}g`;
	const userMedia = `m-${run}u`;
	const attachmentIds: string[] = [];
	const srt = (text: string): string => `1\n00:00:00,000 --> 00:00:02,500\n${text}\n`;

	const register = async (client: CanvasClient, mediaId: string, contextCode: string, title: string, type = 'video'): Promise<void> => {
		const created = await client.post<Json>('/api/v1/media_objects', { id: mediaId, type, context_code: contextCode, title });
		attachmentIds.push(String((created.media_object as Json).attachment_id));
	};
	const listFromCanvas = (path: string, query = ''): Promise<Json[]> =>
		canvas().getAll<Json>(`${path}?exclude[]=sources&exclude[]=tracks${query}`);

	beforeAll(async () => {
		battery = await ensureFilesBattery();
		courseId = battery.courseId;
		await register(canvas(), courseMedia[0], `course_${courseId}`, `Zebra lecture ${run}`);
		await register(canvas(), courseMedia[1], `course_${courseId}`, `Alpha lecture ünï ${run}`, 'audio');
		await register(canvas(), courseMedia[2], `course_${courseId}`, `Middle lecture ${run}`);
		await register(canvas(), groupMedia, `group_${battery.groupId}`, `Group recording ${run}`);
		await register(new CanvasClient('student2'), userMedia, `user_${fx('student2UserId')}`, `My recording ${run}`);
	}, 1_200_000);

	afterAll(async () => {
		for (const id of attachmentIds) await canvas().request('DELETE', `/api/v1/files/${id}`);
	});

	it('getAll: media objects of a course, sorted and ordered', async () => {
		const path = `/api/v1/courses/${courseId}/media_objects`;
		const params = { contextType: 'course', courseId };
		const exclude = ['sources', 'tracks'];

		const byTitle = await runOk({
			resource: 'mediaObject',
			operation: 'getAll',
			params: { ...params, options: { exclude, sort: 'title', order: 'asc' }, pagination: { returnAll: true } },
		});
		expect(byTitle.map((m) => m.media_id)).toEqual((await listFromCanvas(path, '&sort=title&order=asc')).map((m) => m.media_id));
		const mine = byTitle.filter((m) => courseMedia.includes(String(m.media_id)));
		expect(mine.map((m) => m.media_id)).toEqual([courseMedia[1], courseMedia[2], courseMedia[0]]);
		expect(mine[0]).toMatchObject({ media_type: 'audio', title: `Alpha lecture ünï ${run}` });
		expect(mine[0]).not.toHaveProperty('media_sources');
		expect(mine[0]).not.toHaveProperty('media_tracks');

		const byTitleDesc = await runOk({
			resource: 'mediaObject',
			operation: 'getAll',
			params: { ...params, options: { exclude, sort: 'title', order: 'desc' }, pagination: { returnAll: true } },
		});
		expect(byTitleDesc.map((m) => m.media_id)).toEqual([...byTitle.map((m) => m.media_id)].reverse());

		const newestFirst = await runOk({
			resource: 'mediaObject',
			operation: 'getAll',
			params: { ...params, options: { exclude, sort: 'created_at', order: 'desc' }, pagination: { returnAll: true } },
		});
		expect(newestFirst.slice(0, 3).map((m) => m.media_id)).toEqual([courseMedia[2], courseMedia[1], courseMedia[0]]);

		const paged = await runOk({
			resource: 'mediaObject',
			operation: 'getAll',
			params: { ...params, options: { exclude, sort: 'created_at', order: 'desc' }, pagination: { perPage: 1, maxPages: 2 } },
		});
		expect(paged.map((m) => m.media_id)).toEqual([courseMedia[2], courseMedia[1]]);
	});

	it('getAll: "exclude" decides whether tracks and sources are looked up', async () => {
		const params = { contextType: 'course', courseId };
		await canvas().put(`/api/v1/media_objects/${courseMedia[0]}/media_tracks`, [{ locale: 'en', content: srt('Hello') }]);

		// Tracks are stored in Canvas and can be listed without a media server.
		const withTracks = await runOk({
			resource: 'mediaObject',
			operation: 'getAll',
			params: { ...params, options: { exclude: ['sources'] }, pagination: { returnAll: true } },
		});
		const zebra = withTracks.find((m) => m.media_id === courseMedia[0])!;
		expect((zebra.media_tracks as Json[]).map((t) => t.locale)).toEqual(['en']);
		expect(zebra).not.toHaveProperty('media_sources');

		// Sources come from the media server, which this Canvas does not have.
		const withSources = await runNode({
			resource: 'mediaObject',
			operation: 'getAll',
			params: { ...params, options: { exclude: ['tracks'] }, errorHandling: { onError: 'continueWithError' } },
		});
		expect(withSources.success).toEqual([]);
		expect(withSources.error[0]).toMatchObject({ errorCode: 500, errorType: 'SERVER_ERROR', resource: 'mediaObject' });
	});

	it('getAll: group and user contexts', async () => {
		const group = await runOk({
			resource: 'mediaObject',
			operation: 'getAll',
			params: { contextType: 'group', groupId: battery.groupId, options: { exclude: ['sources', 'tracks'] }, pagination: { returnAll: true } },
		});
		expect(group.map((m) => m.media_id)).toEqual(
			(await listFromCanvas(`/api/v1/groups/${battery.groupId}/media_objects`)).map((m) => m.media_id),
		);
		expect(group.map((m) => m.media_id)).toContain(groupMedia);
		expect(group.map((m) => m.media_id)).not.toContain(courseMedia[0]);

		// The user context lists what the user of the credential uploaded to their own files.
		const own = await runOk({
			resource: 'mediaObject',
			operation: 'getAll',
			persona: 'student2',
			params: { contextType: 'user', options: { exclude: ['sources', 'tracks'] }, pagination: { returnAll: true } },
		});
		expect(own.map((m) => m.media_id)).toContain(userMedia);
		expect(own.map((m) => m.media_id)).not.toContain(courseMedia[0]);
		const admin = await runOk({
			resource: 'mediaObject',
			operation: 'getAll',
			params: { contextType: 'user', options: { exclude: ['sources', 'tracks'] }, pagination: { returnAll: true } },
		});
		expect(admin.map((m) => m.media_id)).not.toContain(userMedia);
	});

	it('update: changes the title shown for the media object', async () => {
		const title = `Umbenannt ünï 媒体 "quoted" & more ${run}`;
		const [updated] = await runOk({
			resource: 'mediaObject',
			operation: 'update',
			params: { mediaObjectId: courseMedia[0], title },
		});
		expect(updated).toMatchObject({ media_id: courseMedia[0], title });
		const listed = await listFromCanvas(`/api/v1/courses/${courseId}/media_objects`);
		expect(listed.find((m) => m.media_id === courseMedia[0])!.title).toBe(title);

		// Several at once, IDs from expressions.
		const result = await runNode({
			resource: 'mediaObject',
			operation: 'update',
			items: [{ id: courseMedia[1] }, { id: courseMedia[2] }],
			params: { mediaObjectId: '={{ $json.id }}', title: `=Bulk renamed {{ $json.id }}` },
		});
		expect(result.failure, JSON.stringify(result.failure)).toBeUndefined();
		expect(result.success.map((m) => m.title)).toEqual(courseMedia.slice(1).map((id) => `Bulk renamed ${id}`));
	});

	it('update: only the owner may rename; unknown media objects are not found', async () => {
		const notOwner = await runNode({
			resource: 'mediaObject',
			operation: 'update',
			persona: 'student2',
			params: { mediaObjectId: courseMedia[0], title: 'Hijacked', errorHandling: { onError: 'continueWithError' } },
		});
		expect(notOwner.success).toEqual([]);
		expect(notOwner.error[0]).toMatchObject({ errorType: 'FORBIDDEN' });
		expect([401, 403]).toContain(notOwner.error[0].errorCode);

		const [own] = await runOk({
			resource: 'mediaObject',
			operation: 'update',
			persona: 'student2',
			params: { mediaObjectId: userMedia, title: `Renamed by the owner ${run}` },
		});
		expect(own.title).toBe(`Renamed by the owner ${run}`);

		// Canvas does not tell an unknown media object from one that belongs to somebody else.
		const missing = await runNode({
			resource: 'mediaObject',
			operation: 'update',
			params: { mediaObjectId: 'm-doesnotexist000', title: 'x', errorHandling: { onError: 'continueWithError' } },
		});
		expect(missing.success).toEqual([]);
		expect([401, 403, 404]).toContain(missing.error[0].errorCode);
		expect(missing.error[0]).toMatchObject({ resource: 'mediaObject', operation: 'update' });
	});

	it('updateTracks / listTracks: replace the caption tracks and read them back', async () => {
		const mediaObjectId = courseMedia[2];
		const tracksFromCanvas = (): Promise<Json[]> =>
			canvas().get<Json[]>(`/api/v1/media_objects/${mediaObjectId}/media_tracks?include[]=content`);

		const set = await runOk({
			resource: 'mediaObject',
			operation: 'updateTracks',
			params: {
				mediaObjectId,
				tracks: {
					trackValues: [
						{ locale: 'en', content: srt('Hello "world" & more'), kind: 'captions' },
						{ locale: 'es', content: srt('Hola ünï'), kind: 'subtitles' },
						{ locale: 'zh', content: srt('你好'), kind: 'subtitles' },
					],
				},
				options: { include: ['content', 'created_at', 'updated_at', 'webvtt_content'] },
			},
		});
		expect(set.map((t) => t.locale).sort()).toEqual(['en', 'es', 'zh']);
		expect(set[0]).toHaveProperty('content');
		expect(set[0]).toHaveProperty('created_at');
		expect(String(set.find((t) => t.locale === 'en')!.webvtt_content)).toContain('WEBVTT');
		const stored = await tracksFromCanvas();
		expect(stored.find((t) => t.locale === 'en')).toMatchObject({ kind: 'captions', content: srt('Hello "world" & more') });
		expect(stored.find((t) => t.locale === 'zh')).toMatchObject({ kind: 'subtitles', content: srt('你好') });

		const listed = await runOk({ resource: 'mediaObject', operation: 'listTracks', params: { mediaObjectId } });
		expect(listed.map((t) => t.id).sort()).toEqual(stored.map((t) => t.id).sort());
		expect(listed[0]).not.toHaveProperty('content');
		const detailed = await runOk({
			resource: 'mediaObject',
			operation: 'listTracks',
			params: { mediaObjectId, options: { include: ['content', 'created_at', 'updated_at', 'webvtt_content'] } },
		});
		for (const track of detailed) {
			expect(track.content).toBeTypeOf('string');
			expect(track.webvtt_content).toBeTypeOf('string');
			expect(track.created_at).toBeTypeOf('string');
			expect(track.updated_at).toBeTypeOf('string');
		}

		// A track without content is kept as it is, a new one is added, the one not listed is deleted.
		const replaced = await runOk({
			resource: 'mediaObject',
			operation: 'updateTracks',
			params: {
				mediaObjectId,
				tracks: { trackValues: [{ locale: 'en' }, { locale: 'fr', content: srt('Bonjour') }] },
			},
		});
		expect(replaced.map((t) => t.locale).sort()).toEqual(['en', 'fr']);
		const after = await tracksFromCanvas();
		expect(after.map((t) => t.locale).sort()).toEqual(['en', 'fr']);
		expect(after.find((t) => t.locale === 'en')!.content).toBe(srt('Hello "world" & more'));

		const empty = await runOk({ resource: 'mediaObject', operation: 'listTracks', params: { mediaObjectId: courseMedia[1] } });
		expect(empty).toEqual([]);
	});

	it('updateTracks: at least one track is required; without the right to edit captions nothing changes', async () => {
		const none = await runNode({
			resource: 'mediaObject',
			operation: 'updateTracks',
			params: { mediaObjectId: courseMedia[2], tracks: {}, errorHandling: { onError: 'continueWithError' } },
		});
		expect(none.error[0].errorCode).toBe(0);
		expect(String(none.error[0].errorMessage)).toContain('At least one track is required');

		const notAllowed = await runNode({
			resource: 'mediaObject',
			operation: 'updateTracks',
			persona: 'student2',
			params: {
				mediaObjectId: courseMedia[2],
				tracks: { trackValues: [{ locale: 'de', content: srt('Hallo') }] },
				errorHandling: { onError: 'continueWithError' },
			},
		});
		// Canvas answers "204 No Content" instead of an error here: the node reports success,
		// but the tracks are untouched.
		expect(notAllowed.error).toEqual([]);
		expect(notAllowed.success).toEqual([{ success: true }]);
		const stored = await canvas().get<Json[]>(`/api/v1/media_objects/${courseMedia[2]}/media_tracks`);
		expect(stored.map((t) => t.locale).sort()).toEqual(['en', 'fr']);

		// Remove All Tracks sends the empty list on purpose (the tracks given along with it are ignored).
		const removed = await runOk({
			resource: 'mediaObject',
			operation: 'updateTracks',
			params: { mediaObjectId: courseMedia[2], removeAllTracks: true, tracks: { trackValues: [{ locale: 'de', content: srt('Hallo') }] } },
		});
		expect(removed.every((t) => !('locale' in t))).toBe(true);
		expect(await canvas().get<Json[]>(`/api/v1/media_objects/${courseMedia[2]}/media_tracks`)).toEqual([]);
	});
});
