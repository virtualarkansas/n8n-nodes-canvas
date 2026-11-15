import { describe, expect, it } from 'vitest';
import { canvas, fx, unique } from '../lib/canvas';
import { runNode, runOk } from '../lib/harness';
import type { Json } from '../lib/n8n';
import { railsJson } from './support/ownPersonas';

/**
 * Resource: errorReport. Canvas answers a report with { logged, id } only and has no
 * API that returns one (site administrators read them in the web interface), so the
 * reports are read back from the database.
 *
 * Canvas charges 200 units of the rate limit quota per report (of 600), so the file
 * creates few of them, spread over several users.
 */
describe('errorReport', () => {
	interface StoredReport {
		id: number;
		subject: string | null;
		url: string | null;
		email: string | null;
		comments: string | null;
		http_env: Json | null;
		data: Json;
		user_id: number | null;
		account_id: number | null;
	}

	const reports = (ids: unknown[]): StoredReport[] =>
		railsJson<StoredReport[]>(
			`puts "JSON=" + ErrorReport.where(id: [${ids.map(Number).join(',')}]).order(:id).map { |r| r.attributes.slice("id", "subject", "url", "email", "comments", "http_env", "data", "user_id", "account_id") }.to_json`,
		);

	it('create: every field is stored with the report, for the user of the credential', async () => {
		const subject = unique('Battery report: Ünïcødé 测试 "quoted" & <b>tags</b> 🎓');
		const comments = 'First line\nSecond line with "quotes", <script>alert(1)</script> & an umlaut: ä';
		const url = `${canvas().url}/courses/${fx('courseId')}/assignments?filter=a%20b&x=1`;
		const environment = { app: 'enrollment sync', version: '1.4', nested: { attempts: 3, tags: ['a', 'b'] } };

		const [created] = await runOk({
			resource: 'errorReport',
			operation: 'create',
			params: {
				subject,
				additionalFields: {
					comments,
					email: 'reporter+battery@example.edu',
					httpEnv: JSON.stringify(environment),
					userPerceivedSeverity: 'workaround_possible',
					url,
				},
			},
		});
		expect(created).toEqual({ logged: true, id: expect.any(Number) });

		const [stored] = reports([created.id]);
		expect(stored).toMatchObject({
			id: created.id,
			subject,
			comments,
			url,
			email: 'reporter+battery@example.edu',
			http_env: environment,
			user_id: Number(fx('adminUserId')),
			account_id: Number(fx('accountId')),
		});
		expect(stored.data.user_perceived_severity).toBe('workaround_possible');
		// Canvas adds the roles of the reporting user itself.
		expect(String(stored.data.user_roles)).toContain('admin');
	});

	it('create: with a subject only, Canvas fills in the reporter\'s address and the request environment; the environment may come from an expression', async () => {
		const teacher = await canvas().get<Json>(`/api/v1/users/${fx('teacherUserId')}/profile`);
		const result = await runNode({
			resource: 'errorReport',
			operation: 'create',
			persona: 'teacher',
			items: [
				// The expressions below resolve to nothing for this item: only the subject is sent.
				{ subject: unique('Battery report, subject only') },
				{ subject: unique('Battery report, environment object'), environment: { source: 'expression', build: 7 }, severity: 'just_a_comment' },
			],
			params: {
				subject: '={{ $json.subject }}',
				additionalFields: { httpEnv: '={{ $json.environment }}', userPerceivedSeverity: '={{ $json.severity }}' },
				batchProcessing: { mode: 'individual' },
			},
		});
		expect(result.ok).toBe(true);
		expect(result.error).toEqual([]);
		expect(result.success).toHaveLength(2);
		expect(result.rawSuccess.map((item) => (item.pairedItem as Json).item)).toEqual([0, 1]);

		const [plain, withEnvironment] = reports(result.success.map((r) => r.id));
		expect(plain).toMatchObject({ user_id: Number(fx('teacherUserId')), email: teacher.primary_email, comments: null, url: null });
		expect(plain.subject).toContain('subject only');
		expect(plain.data.user_perceived_severity).toBeUndefined();
		expect(String(plain.data.user_roles)).toContain('teacher');
		// Without "Environment (JSON)" Canvas records details of the request itself.
		expect(Object.keys(plain.http_env ?? {}).length).toBeGreaterThan(0);
		expect(plain.http_env).not.toHaveProperty('source');

		expect(withEnvironment.http_env).toEqual({ source: 'expression', build: 7 });
		expect(withEnvironment.data.user_perceived_severity).toBe('just_a_comment');
	});

	it('create: an environment that is no JSON object is rejected before anything is sent', async () => {
		for (const httpEnv of ['{not json', '["a", "list"]', '"text"']) {
			const result = await runNode({
				resource: 'errorReport',
				operation: 'create',
				persona: 'student',
				params: {
					subject: 'Battery report that must not be created',
					additionalFields: { httpEnv },
					errorHandling: { onError: 'continueWithError' },
				},
			});
			expect(result.success, httpEnv).toEqual([]);
			expect(result.error[0], httpEnv).toMatchObject({ errorCode: 0, errorType: 'INVALID_PARAMETERS', resource: 'errorReport', operation: 'create' });
			expect(String(result.error[0].errorMessage), httpEnv).toContain('Environment (JSON)');
		}
	});
});
