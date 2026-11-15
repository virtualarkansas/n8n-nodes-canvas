import { canvas, fx, unique } from '../lib/canvas';
import type { Json } from '../lib/n8n';

/**
 * A course with Course Pacing switched on, created for one test file:
 * a published module with three assignment items, one extra section and one
 * student enrolled in that section. (The seeded "paced" course only carries the
 * name; pacing is a per-course setting that the battery must not flip on seeds.)
 */
export interface PacedCourse {
	courseId: string;
	sectionId: string;
	studentUserId: string;
	studentEnrollmentId: string;
	moduleItemIds: string[];
	cleanup: () => Promise<void>;
}

export async function createPacedCourse(label: string): Promise<PacedCourse> {
	const account = fx('accountId');
	const course = await canvas().post<Json>(`/api/v1/accounts/${account}/courses`, {
		course: { name: unique(`${label} paced course`), enable_course_paces: true, start_at: '2026-01-05T08:00:00Z' },
		offer: true,
	});
	const courseId = String(course.id);

	const module = await canvas().post<Json>(`/api/v1/courses/${courseId}/modules`, { module: { name: 'Unit 1' } });
	const moduleItemIds: string[] = [];
	for (const title of ['Essay', 'Lab report', 'Reflection']) {
		const assignment = await canvas().post<Json>(`/api/v1/courses/${courseId}/assignments`, {
			assignment: { name: title, submission_types: ['online_text_entry'], points_possible: 10, published: true },
		});
		const item = await canvas().post<Json>(`/api/v1/courses/${courseId}/modules/${String(module.id)}/items`, {
			module_item: { type: 'Assignment', content_id: assignment.id },
		});
		moduleItemIds.push(String(item.id));
	}
	await canvas().put(`/api/v1/courses/${courseId}/modules/${String(module.id)}`, { module: { published: true } });

	const section = await canvas().post<Json>(`/api/v1/courses/${courseId}/sections`, {
		course_section: { name: unique(`${label} paced section`) },
	});
	const sectionId = String(section.id);

	const student = await canvas().post<Json>(`/api/v1/accounts/${account}/users`, {
		user: { name: unique(`${label} Paced Student`), skip_registration: true },
		pseudonym: { unique_id: `${unique('paced').replace(/\s/g, '.')}@example.edu`, send_confirmation: false },
	});
	const studentUserId = String(student.id);
	const enrollment = await canvas().post<Json>(`/api/v1/courses/${courseId}/enrollments`, {
		enrollment: { user_id: studentUserId, type: 'StudentEnrollment', enrollment_state: 'active', course_section_id: sectionId },
	});

	return {
		courseId,
		sectionId,
		studentUserId,
		studentEnrollmentId: String(enrollment.id),
		moduleItemIds,
		cleanup: async () => {
			await canvas().request('DELETE', `/api/v1/courses/${courseId}?event=delete`);
			await canvas().request('DELETE', `/api/v1/accounts/${account}/users/${studentUserId}`);
		},
	};
}

/** Wait until Canvas' background job has finished with a record (pace publish, report, ...). */
export async function waitFor<T>(
	read: () => Promise<T>,
	done: (value: T) => boolean,
	timeoutMs = 90_000,
): Promise<T> {
	const started = Date.now();
	let value = await read();
	while (!done(value)) {
		if (Date.now() - started > timeoutMs) {
			throw new Error(`Timed out waiting for Canvas; last state: ${JSON.stringify(value).slice(0, 400)}`);
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
		value = await read();
	}
	return value;
}
