import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canvas, CanvasClient, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { uploadFile } from './content.helper';
import { ownPersona, railsJson, rails, removePersonas } from './support/ownPersonas';
import type { OwnPersona } from './support/ownPersonas';

/**
 * Resource: user — the operations on a user's own preferences and sessions:
 * settings, custom colors, dashboard positions, editor / Files UI preference,
 * avatars and mobile sessions.
 *
 * Everything is written to users created by this file. Seeded courses and groups
 * only serve as the "asset" a color or position is stored for (that is data of
 * the user, not of the course). Writes are verified by reading back from Canvas
 * directly; the two preferences Canvas has no GET for are read with a Rails query.
 */
describe('user: preferences and sessions', () => {
	const account = fx('accountId');
	/** Acts as "the current user" (has an API token and an n8n credential). */
	let owner: OwnPersona;
	/** Plain users the admin works on. */
	const users: string[] = [];
	/** A course nobody of this file is enrolled in. */
	let foreignCourseId = '';
	let adminRoleUserId = '';
	let mobileKeyId = 0;

	const courseA = `course_${fx('courseId')}`;
	const courseB = `course_${fx('courseId2')}`;
	const group = `group_${fx('groupId')}`;

	const settingsOf = (id: string): Promise<Json> => canvas().get<Json>(`/api/v1/users/${id}/settings`);
	const colorsOf = async (id: string): Promise<Json> =>
		(await canvas().get<Json>(`/api/v1/users/${id}/colors`)).custom_colors as Json;
	const positionsOf = async (id: string): Promise<Json> =>
		(await canvas().get<Json>(`/api/v1/users/${id}/dashboard_positions`)).dashboard_positions as Json;
	const refuse = { errorHandling: { onError: 'continueWithError' } };

	beforeAll(async () => {
		owner = await ownPersona('Preferences Owner');
		for (let i = 1; i <= 4; i++) {
			const user = await canvas().post<Json>(`/api/v1/accounts/${account}/users`, {
				user: { name: `${unique('Preferences User')} ${i}`, skip_registration: true },
				pseudonym: { unique_id: `${unique('prefs').replace(/\s/g, '.')}@example.edu`, send_confirmation: false },
			});
			users.push(String(user.id));
		}
		const course = await canvas().post<Json>(`/api/v1/accounts/${account}/courses`, {
			course: { name: unique('Preferences foreign course') },
		});
		foreignCourseId = String(course.id);
	}, 360_000);

	afterAll(async () => {
		if (mobileKeyId) {
			rails(`DeveloperKey.where(id: ${mobileKeyId}).each(&:destroy)`);
		}
		if (adminRoleUserId) {
			await canvas().request(
				'DELETE',
				`/api/v1/accounts/${account}/admins/${adminRoleUserId}?role_id=${fx('accountRoleId')}`,
			);
		}
		if (foreignCourseId) await canvas().request('DELETE', `/api/v1/courses/${foreignCourseId}?event=delete`);
		for (const id of users) {
			await canvas().request('DELETE', `/api/v1/accounts/${account}/users/${id}`);
		}
		await removePersonas([owner]);
	});

	// ------------------------------------------------------------------ settings

	const SETTINGS: Array<[string, string]> = [
		['collapseCourseNav', 'collapse_course_nav'],
		['collapseGlobalNav', 'collapse_global_nav'],
		['commentLibrarySuggestionsEnabled', 'comment_library_suggestions_enabled'],
		['elementaryDashboardDisabled', 'elementary_dashboard_disabled'],
		['hideDashcardColorOverlays', 'hide_dashcard_color_overlays'],
		['manualMarkAsRead', 'manual_mark_as_read'],
		['releaseNotesBadgeDisabled', 'release_notes_badge_disabled'],
		['widgetDashboardDarkMode', 'widget_dashboard_dark_mode'],
		['widgetDashboardUserPreference', 'widget_dashboard_user_preference'],
	];

	it('updateSettings / getSettings: every setting reaches Canvas, switched on and off', async () => {
		const id = users[0];
		// A new user has everything off.
		for (const [, canvasName] of SETTINGS) expect((await settingsOf(id))[canvasName], canvasName).toBe(false);

		// Alternate on/off so a setting sent under the wrong name cannot go unnoticed, then invert.
		for (const firstOn of [true, false]) {
			const updateFields: Json = {};
			const expected: Json = {};
			SETTINGS.forEach(([uiName, canvasName], index) => {
				const value = (index % 2 === 0) === firstOn;
				updateFields[uiName] = value;
				expected[canvasName] = value;
			});
			const [updated] = await runOk({ resource: 'user', operation: 'updateSettings', params: { userId: id, updateFields } });
			const actual = await settingsOf(id);
			expect(actual).toMatchObject(expected);
			expect(updated).toEqual(actual);
		}

		const [settings] = await runOk({ resource: 'user', operation: 'getSettings', params: { userId: Number(id) } });
		expect(settings).toEqual(await settingsOf(id));
	});

	it('updateSettings: settings that are not added keep their value; without any field nothing changes', async () => {
		const id = users[0];
		const before = await settingsOf(id);
		const [updated] = await runOk({
			resource: 'user',
			operation: 'updateSettings',
			params: { userId: id, updateFields: { manualMarkAsRead: !before.manual_mark_as_read } },
		});
		const expected = { ...before, manual_mark_as_read: !before.manual_mark_as_read };
		expect(await settingsOf(id)).toEqual(expected);
		expect(updated).toEqual(expected);

		const [untouched] = await runOk({ resource: 'user', operation: 'updateSettings', params: { userId: id } });
		expect(untouched).toEqual(expected);
		expect(await settingsOf(id)).toEqual(expected);
	});

	it('settings: users change their own with "self"; several users per run; other users are refused', async () => {
		const [own] = await runOk({
			resource: 'user',
			operation: 'updateSettings',
			credential: owner.credential,
			params: { userId: 'self', updateFields: { collapseGlobalNav: true, hideDashcardColorOverlays: true } },
		});
		expect(own).toMatchObject({ collapse_global_nav: true, hide_dashcard_color_overlays: true, manual_mark_as_read: false });
		expect(await settingsOf(owner.id)).toEqual(own);
		const [ownRead] = await runOk({ resource: 'user', operation: 'getSettings', credential: owner.credential, params: { userId: 'self' } });
		expect(ownRead).toEqual(own);

		const result = await runNode({
			resource: 'user',
			operation: 'getSettings',
			items: [{ id: Number(users[0]) }, { id: 99999999 }, { id: Number(owner.id) }],
			params: { userId: '={{ $json.id }}', ...refuse },
		});
		expect(result.success).toEqual([await settingsOf(users[0]), await settingsOf(owner.id)]);
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual([0, 2]);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'user', operation: 'getSettings' });

		const before = await settingsOf(users[1]);
		for (const operation of ['getSettings', 'updateSettings']) {
			const forbidden = await runNode({
				resource: 'user',
				operation,
				credential: owner.credential,
				params: { userId: users[1], updateFields: { manualMarkAsRead: true }, ...refuse },
			});
			expect(forbidden.success, operation).toEqual([]);
			expect(forbidden.error[0], operation).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'user', operation });
		}
		expect(await settingsOf(users[1])).toEqual(before);
	});

	it('read operations take SIS IDs, also ones with characters that need URL encoding (seeded user, read only)', async () => {
		const id = fx('oddSisUserId');
		const userId = `sis_user_id:${fx('oddSisUserSisId')}`;
		const [settings] = await runOk({ resource: 'user', operation: 'getSettings', params: { userId } });
		expect(settings).toEqual(await settingsOf(id));
		const [colors] = await runOk({ resource: 'user', operation: 'getColors', params: { userId } });
		expect(colors).toEqual(await colorsOf(id));
		const [positions] = await runOk({ resource: 'user', operation: 'getDashboardPositions', params: { userId } });
		expect(positions).toEqual(await positionsOf(id));
		const avatars = await runOk({ resource: 'user', operation: 'getAvatars', params: { userId } });
		expect(avatars).toEqual(await canvas().get<Json[]>(`/api/v1/users/${id}/avatars`));
	});

	// ------------------------------------------------------------------ custom colors

	it('setColor: colors for courses, a group and a user, with and without "#", three and six digits', async () => {
		const id = users[0];
		expect(await colorsOf(id)).toEqual({});
		const [none] = await runOk({ resource: 'user', operation: 'getColors', params: { userId: id } });
		expect(none).toEqual({});

		const colors = [
			{ asset: courseA, color: '#Abc123', stored: '#Abc123' },
			{ asset: courseB, color: 'fed', stored: '#fed' },
			{ asset: group, color: '#00FF7f', stored: '#00FF7f' },
			{ asset: `user_${id}`, color: '123456', stored: '#123456' },
		];
		const result = await runNode({
			resource: 'user',
			operation: 'setColor',
			items: colors,
			params: {
				userId: Number(id),
				assetString: '={{ $json.asset }}',
				hexcode: '={{ $json.color }}',
				// Canvas keeps all colors of a user in one record: requests sent at the same time
				// overwrite each other (a lost update), so they go one after the other.
				batchProcessing: { mode: 'individual' },
			},
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect(result.success).toEqual(colors.map((entry) => ({ hexcode: entry.stored })));
		expect(await colorsOf(id)).toEqual(Object.fromEntries(colors.map((entry) => [entry.asset, entry.stored])));
	});

	it('getColors / getColor: return what Canvas stores; changing one color leaves the others alone', async () => {
		const id = users[0];
		const [all] = await runOk({ resource: 'user', operation: 'getColors', params: { userId: id } });
		expect(all).toEqual(await colorsOf(id));
		expect(Object.keys(all).sort()).toEqual([courseA, courseB, group, `user_${id}`].sort());

		const single = await runNode({
			resource: 'user',
			operation: 'getColor',
			items: [{ asset: courseA }, { asset: `course_${foreignCourseId}` }, { asset: group }],
			params: { userId: id, assetString: '={{ $json.asset }}', ...refuse },
		});
		expect(single.success).toEqual([{ hexcode: '#Abc123' }, { hexcode: '#00FF7f' }]);
		// No color stored for that course: Canvas answers 404.
		expect(single.error).toHaveLength(1);
		expect(single.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'user', operation: 'getColor' });

		const before = await colorsOf(id);
		const [changed] = await runOk({ resource: 'user', operation: 'setColor', params: { userId: id, assetString: courseA, hexcode: '#0b874b' } });
		expect(changed).toEqual({ hexcode: '#0b874b' });
		expect(await colorsOf(id)).toEqual({ ...before, [courseA]: '#0b874b' });
	});

	it('colors: "self" for the user themselves; invalid colors, unknown assets and other users are refused', async () => {
		const [own] = await runOk({
			resource: 'user',
			operation: 'setColor',
			credential: owner.credential,
			params: { userId: 'self', assetString: ` ${courseA} `, hexcode: ' #BADA55 ' },
		});
		expect(own).toEqual({ hexcode: '#BADA55' });
		expect(await colorsOf(owner.id)).toEqual({ [courseA]: '#BADA55' });
		const [ownColors] = await runOk({ resource: 'user', operation: 'getColors', credential: owner.credential, params: { userId: 'self' } });
		expect(ownColors).toEqual({ [courseA]: '#BADA55' });

		const id = users[1];
		const invalid = await runNode({
			resource: 'user',
			operation: 'setColor',
			items: [{ asset: courseA, color: 'zzz' }, { asset: 'course_99999999', color: '#123456' }, { asset: 'banana', color: '#123456' }],
			params: { userId: id, assetString: '={{ $json.asset }}', hexcode: '={{ $json.color }}', ...refuse },
		});
		expect(invalid.success).toEqual([]);
		expect(invalid.error.map((e) => [e.errorCode, e.errorType])).toEqual([
			[400, 'VALIDATION_ERROR'],
			[404, 'NOT_FOUND'],
			[404, 'NOT_FOUND'],
		]);
		expect(String(invalid.error[0].errorMessage)).toContain('Invalid Hexcode Provided');

		for (const [operation, params] of [
			['setColor', { assetString: courseA, hexcode: '#000000' }],
			['getColors', {}],
			['getColor', { assetString: courseA }],
		] as const) {
			const forbidden = await runNode({
				resource: 'user',
				operation,
				persona: 'teacher',
				params: { userId: id, ...params, ...refuse },
			});
			expect(forbidden.success, operation).toEqual([]);
			expect(forbidden.error[0], operation).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'user', operation });
		}
		expect(await colorsOf(id)).toEqual({});
	});

	// ------------------------------------------------------------------ dashboard positions

	it('updateDashboardPositions / getDashboardPositions: positions are stored as numbers; cards that are not listed stay', async () => {
		const id = users[0];
		const [none] = await runOk({ resource: 'user', operation: 'getDashboardPositions', params: { userId: id } });
		expect(none).toEqual({});

		const [updated] = await runOk({
			resource: 'user',
			operation: 'updateDashboardPositions',
			params: {
				userId: id,
				positions: {
					position: [
						{ assetString: courseA, position: 2 },
						{ assetString: ` ${courseB} `, position: 1 },
						{ assetString: group, position: 0 },
					],
				},
			},
		});
		const expected = { [courseA]: 2, [courseB]: 1, [group]: 0 };
		expect(await positionsOf(id)).toEqual(expected);
		expect(updated).toEqual(expected);

		// Positions from the input item (numbers and numeric text); only the listed card moves.
		const result = await runNode({
			resource: 'user',
			operation: 'updateDashboardPositions',
			items: [{ asset: courseA, pos: 7 }, { asset: group, pos: '-3' }],
			params: {
				userId: Number(id),
				positions: { position: [{ assetString: '={{ $json.asset }}', position: '={{ $json.pos }}' }] },
				batchProcessing: { mode: 'individual' },
			},
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		const moved = { [courseA]: 7, [courseB]: 1, [group]: -3 };
		expect(await positionsOf(id)).toEqual(moved);
		expect(result.success[1]).toEqual(moved);

		const [read] = await runOk({ resource: 'user', operation: 'getDashboardPositions', params: { userId: id } });
		expect(read).toEqual(moved);
	});

	it('updateDashboardPositions: unusable input is rejected before or by Canvas, and nothing is stored', async () => {
		const id = users[1];
		const attempt = (positions: Json, credential?: OwnPersona['credential'], userId = id) =>
			runNode({ resource: 'user', operation: 'updateDashboardPositions', credential, params: { userId, positions, ...refuse } });

		const empty = await attempt({});
		expect(empty.success).toEqual([]);
		expect(empty.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', resource: 'user', operation: 'updateDashboardPositions' });
		expect(String(empty.error[0].errorMessage)).toContain('at least one dashboard position');

		const fraction = await attempt({ position: [{ assetString: courseA, position: 1.5 }] });
		expect(fraction.error[0]).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS' });
		expect(String(fraction.error[0].errorMessage)).toContain('whole number');

		const tooHigh = await attempt({ position: [{ assetString: courseA, position: 5000 }] });
		expect(tooHigh.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR' });
		expect(String(tooHigh.error[0].errorMessage)).toContain('Position 5000 is too high');

		const unknown = await attempt({ position: [{ assetString: 'course_99999999', position: 1 }] });
		expect(unknown.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND' });

		const forbidden = await runNode({
			resource: 'user',
			operation: 'updateDashboardPositions',
			persona: 'teacher',
			params: { userId: id, positions: { position: [{ assetString: courseA, position: 1 }] }, ...refuse },
		});
		expect(forbidden.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN' });
		expect(await positionsOf(id)).toEqual({});

		// Canvas also checks that the calling user may see the course: the owner is not enrolled in it.
		const unseen = await attempt({ position: [{ assetString: `course_${foreignCourseId}`, position: 1 }] }, owner.credential, 'self');
		expect(unseen.success).toEqual([]);
		expect(unseen.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN' });
		expect(await positionsOf(owner.id)).toEqual({});
	});

	// ------------------------------------------------------------------ editor and Files UI

	/** Canvas has no endpoint that returns these two preferences, so they are read from the database. */
	const preferences = (ids: string[]): Array<{ id: number; editor: string | null; files: string | null }> =>
		railsJson(
			`puts "JSON=" + User.where(id: [${ids.map(Number).join(',')}]).order(:id).map { |u| { id: u.id, editor: u.get_preference(:text_editor_preference), files: u.get_preference(:files_ui_version) } }.to_json`,
		);

	it('setTextEditorPreference / setFilesUiVersion: every choice is stored for the user', async () => {
		const [first, second, third] = users;
		const editors = await runNode({
			resource: 'user',
			operation: 'setTextEditorPreference',
			items: [{ id: Number(first), editor: 'block_editor' }, { id: Number(second), editor: 'rce' }, { id: Number(third), editor: 'rce' }],
			params: { userId: '={{ $json.id }}', textEditorPreference: '={{ $json.editor }}' },
		});
		expect(editors.error).toEqual([]);
		expect(editors.success).toEqual([
			{ text_editor_preference: 'block_editor' },
			{ text_editor_preference: 'rce' },
			{ text_editor_preference: 'rce' },
		]);
		const versions = await runNode({
			resource: 'user',
			operation: 'setFilesUiVersion',
			items: [{ id: Number(first), version: 'v2' }, { id: Number(second), version: 'v1' }],
			params: { userId: '={{ $json.id }}', filesUiVersion: '={{ $json.version }}' },
		});
		expect(versions.error).toEqual([]);
		expect(versions.success).toEqual([{ files_ui_version: 'v2' }, { files_ui_version: 'v1' }]);

		expect(preferences([first, second, third])).toEqual([
			{ id: Number(first), editor: 'block_editor', files: 'v2' },
			{ id: Number(second), editor: 'rce', files: 'v1' },
			{ id: Number(third), editor: 'rce', files: null },
		]);

		// "No Preference" clears the editor choice; the Files UI version can be switched back.
		const [cleared] = await runOk({ resource: 'user', operation: 'setTextEditorPreference', params: { userId: third, textEditorPreference: '' } });
		expect(cleared).toEqual({ text_editor_preference: null });
		const [switched] = await runOk({ resource: 'user', operation: 'setFilesUiVersion', params: { userId: first, filesUiVersion: 'v1' } });
		expect(switched).toEqual({ files_ui_version: 'v1' });
		const [own] = await runOk({
			resource: 'user',
			operation: 'setTextEditorPreference',
			credential: owner.credential,
			params: { userId: 'self', textEditorPreference: 'block_editor' },
		});
		expect(own).toEqual({ text_editor_preference: 'block_editor' });
		expect(preferences([first, third, owner.id])).toEqual(
			[
				{ id: Number(first), editor: 'block_editor', files: 'v1' },
				{ id: Number(third), editor: null, files: null },
				{ id: Number(owner.id), editor: 'block_editor', files: null },
			].sort((a, b) => a.id - b.id),
		);
	});

	it('setTextEditorPreference / setFilesUiVersion: values Canvas does not know and other users are refused', async () => {
		const id = users[3];
		const editor = await runNode({
			resource: 'user',
			operation: 'setTextEditorPreference',
			items: [{ editor: 'vim' }],
			params: { userId: id, textEditorPreference: '={{ $json.editor }}', ...refuse },
		});
		expect(editor.success).toEqual([]);
		expect(editor.error[0]).toMatchObject({ errorCode: 422, errorType: 'VALIDATION_ERROR', resource: 'user', operation: 'setTextEditorPreference' });

		const version = await runNode({
			resource: 'user',
			operation: 'setFilesUiVersion',
			items: [{ version: 'v3' }],
			params: { userId: id, filesUiVersion: '={{ $json.version }}', ...refuse },
		});
		expect(version.success).toEqual([]);
		expect(version.error[0]).toMatchObject({ errorCode: 400, errorType: 'VALIDATION_ERROR', resource: 'user', operation: 'setFilesUiVersion' });
		expect(String(version.error[0].errorMessage)).toContain('Invalid files_ui_version provided');

		for (const [operation, params] of [
			['setTextEditorPreference', { textEditorPreference: 'rce' }],
			['setFilesUiVersion', { filesUiVersion: 'v2' }],
		] as const) {
			const forbidden = await runNode({ resource: 'user', operation, persona: 'student', params: { userId: id, ...params, ...refuse } });
			expect(forbidden.success, operation).toEqual([]);
			expect(forbidden.error[0], operation).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'user', operation });
		}
		expect(preferences([id])).toEqual([{ id: Number(id), editor: null, files: null }]);
	});

	// ------------------------------------------------------------------ avatars

	it('getAvatars: lists the gravatar, uploaded profile pictures and "no picture", with the token Update takes', async () => {
		const png = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
			'base64',
		);
		const pictures: number[] = [];
		for (const name of ['portrait one.png', 'portrait-two.png']) {
			const file = await uploadFile('/api/v1/users/self/files', name, new Uint8Array(png), {
				contentType: 'image/png',
				folderPath: 'profile pictures',
				token: owner.token,
			});
			pictures.push(Number(file.id));
		}

		const expected = await canvas().get<Json[]>(`/api/v1/users/${owner.id}/avatars`);
		expect(expected.map((a) => a.type)).toEqual(['gravatar', 'attachment', 'attachment', 'no_pic']);

		const avatars = await runOk({ resource: 'user', operation: 'getAvatars', params: { userId: owner.id } });
		expect(avatars).toEqual(expected);
		expect(avatars.filter((a) => a.type === 'attachment').map((a) => a.id).sort()).toEqual([...pictures].sort());
		for (const avatar of avatars) expect(avatar.token, String(avatar.type)).toBeTypeOf('string');

		const own = await runOk({ resource: 'user', operation: 'getAvatars', credential: owner.credential, params: { userId: 'self' } });
		expect(own.map((a) => [a.type, a.token])).toEqual(expected.map((a) => [a.type, a.token]));

		// The token of a listed picture is what Update's "Avatar Token" takes.
		const picture = avatars.find((a) => a.type === 'attachment') as Json;
		await runOk({ resource: 'user', operation: 'update', params: { userId: owner.id, updateFields: { avatarToken: String(picture.token) } } });
		const profile = await canvas().get<Json>(`/api/v1/users/${owner.id}/profile`);
		expect(String(profile.avatar_url)).toContain(`/images/thumbnails/${String(picture.id)}/`);

		const bare = await runOk({ resource: 'user', operation: 'getAvatars', params: { userId: users[0] } });
		expect(bare.map((a) => a.type)).toEqual(['gravatar', 'no_pic']);

		const result = await runNode({
			resource: 'user',
			operation: 'getAvatars',
			persona: 'student',
			items: [{ id: 'self' }, { id: users[0] }],
			params: { userId: '={{ $json.id }}', ...refuse },
		});
		expect(result.success.length).toBeGreaterThanOrEqual(2);
		expect(result.rawSuccess.every((item) => (item.pairedItem as Json).item === 0)).toBe(true);
		expect(result.error).toHaveLength(1);
		expect(result.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'user', operation: 'getAvatars' });
	});

	// ------------------------------------------------------------------ mobile sessions

	it('expireMobileSessions: expires the tokens of mobile apps only, and respects "Skip Admins"', async () => {
		const [plainUser, adminUser] = [users[0], users[2]];
		// "Skip Admins" looks for an administrator of the root account; a limited account role is enough.
		await canvas().post(`/api/v1/accounts/${account}/admins`, {
			user_id: adminUser,
			role_id: fx('accountRoleId'),
			send_confirmation: false,
		});
		adminRoleUserId = adminUser;

		// Canvas takes a developer key with a push notification ARN for a mobile app. Neither such
		// a key nor a token issued by it can be created through the API.
		const prepared = railsJson<{ key: number; tokens: Record<string, string> }>(
			[
				'key = DeveloperKey.create!(account: Account.default, name: "n8n battery mobile app", sns_arn: "arn:aws:sns:us-east-1:000000000000:app/GCM/n8n-battery")',
				'key.developer_key_account_bindings.where(account: Account.default).each { |b| b.update!(workflow_state: "on") }',
				`tokens = [${Number(plainUser)}, ${Number(adminUser)}].to_h { |id| [id.to_s, User.find(id).access_tokens.create!(developer_key: key, purpose: "battery mobile session").full_token] }`,
				`tokens["ordinary"] = User.find(${Number(plainUser)}).access_tokens.create!(purpose: "battery ordinary token").full_token`,
				'puts "JSON=" + { key: key.id, tokens: tokens }.to_json',
			].join('; '),
		);
		mobileKeyId = prepared.key;
		const works = async (token: string): Promise<number> =>
			(await CanvasClient.withToken(token).request('GET', '/api/v1/users/self')).status;
		const mobile = prepared.tokens[plainUser];
		const adminMobile = prepared.tokens[adminUser];
		const ordinary = prepared.tokens.ordinary;
		expect([await works(mobile), await works(adminMobile), await works(ordinary)]).toEqual([200, 200, 200]);

		// An administrator is left alone when asked to.
		const [skipped] = await runOk({
			resource: 'user',
			operation: 'expireMobileSessions',
			params: { userId: adminUser, additionalFields: { skipAdmins: true } },
		});
		expect(skipped).toEqual({ message: 'All mobile sessions terminated' });
		expect(await works(adminMobile)).toBe(200);
		expect(await works(mobile)).toBe(200);

		// Without options: the user's mobile token expires, their other token and other users' tokens do not.
		const [expired] = await runOk({ resource: 'user', operation: 'expireMobileSessions', params: { userId: Number(plainUser) } });
		expect(expired).toEqual({ message: 'All mobile sessions terminated' });
		expect(await works(mobile)).toBe(401);
		expect(await works(ordinary)).toBe(200);
		expect(await works(adminMobile)).toBe(200);

		await runOk({
			resource: 'user',
			operation: 'expireMobileSessions',
			params: { userId: adminUser, additionalFields: { skipAdmins: false } },
		});
		expect(await works(adminMobile)).toBe(401);
	});

	it('expireMobileSessions: unknown users are a 404; teachers may not log other users out', async () => {
		const missing = await runNode({ resource: 'user', operation: 'expireMobileSessions', params: { userId: '99999999', ...refuse } });
		expect(missing.success).toEqual([]);
		expect(missing.error[0]).toMatchObject({ errorCode: 404, errorType: 'NOT_FOUND', resource: 'user', operation: 'expireMobileSessions' });

		const forbidden = await runNode({
			resource: 'user',
			operation: 'expireMobileSessions',
			persona: 'teacher',
			params: { userId: users[1], ...refuse },
		});
		expect(forbidden.success).toEqual([]);
		expect(forbidden.error[0]).toMatchObject({ errorCode: 403, errorType: 'FORBIDDEN', resource: 'user', operation: 'expireMobileSessions' });
	});
});
