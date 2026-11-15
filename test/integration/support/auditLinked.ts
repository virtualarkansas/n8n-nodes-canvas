import { canvas } from '../../lib/canvas';
import type { Json } from '../../lib/n8n';

/**
 * The audit logs (authentication, grade change, course) answer every page with
 * `{ events: [...], linked: { users: [...], ... } }`: `linked` holds the records the
 * events of that page refer to. This reads a log directly from Canvas, page by page
 * (in pages of `perPage`, so they differ from the node's), and gives for every event
 * the records its links point to, resolved against its own page, the way the node
 * should output them: `{ [link name]: record | null }`.
 */
export async function expectedLinked(
	path: string,
	collections: Record<string, string>,
	perPage = 7,
): Promise<Map<string, { event: Json; linked: Json }>> {
	const out = new Map<string, { event: Json; linked: Json }>();
	let next: string | undefined = `${path}${path.includes('?') ? '&' : '?'}per_page=${perPage}`;
	while (next) {
		const res = await canvas().request('GET', next);
		if (res.status >= 400) {
			throw new Error(`Canvas GET ${next} -> ${res.status}: ${JSON.stringify(res.data).slice(0, 400)}`);
		}
		const page = res.data as { events: Json[]; linked: Record<string, Json[]> };
		for (const event of page.events) {
			const linked: Json = {};
			for (const [name, id] of Object.entries(event.links as Json)) {
				const collection = collections[name];
				if (!collection) continue;
				const found = (page.linked[collection] ?? []).find(
					(record) => id !== null && id !== '' && String(record.id) === String(id),
				);
				linked[name] = found ?? null;
			}
			out.set(String(event.id), { event, linked });
		}
		const match = /<([^>]+)>\s*;\s*rel="next"/.exec(res.headers.get('link') ?? '');
		next = match ? match[1] : undefined;
	}
	return out;
}

/** The link names of each log and the `linked` collection each one is found in. */
export const AUTHENTICATION_LINKS = { login: 'logins', account: 'accounts', user: 'users', page_view: 'page_views' };
export const GRADE_CHANGE_LINKS = {
	course: 'courses',
	assignment: 'assignments',
	student: 'users',
	grader: 'users',
	page_view: 'page_views',
};
export const COURSE_LINKS = {
	course: 'courses',
	copied_from: 'courses',
	copied_to: 'courses',
	reset_from: 'courses',
	reset_to: 'courses',
	user: 'users',
	page_view: 'page_views',
};
