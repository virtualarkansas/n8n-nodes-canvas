import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Helpers
// ============================================

/**
 * Remove request-level arguments from a collection and return them.
 * The UI keeps them with the record's fields, Canvas reads them next to the record object.
 */
function takeKeys(fields: Record<string, unknown>, keys: string[]): Record<string, unknown> {
	const taken: Record<string, unknown> = {};
	for (const key of keys) {
		if (fields[key] !== undefined) {
			taken[key] = fields[key];
			delete fields[key];
		}
	}
	return taken;
}

/** Drop options that were added in the UI but left empty, so they do not reach Canvas as blank filters. */
function withoutBlanks(fields: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === null || value === '') continue;
		if (Array.isArray(value) && value.length === 0) continue;
		result[key] = value;
	}
	return result;
}

/** "a, b ,c" (or an array coming from an expression) -> ['a', 'b', 'c']. */
function toList(value: unknown): string[] {
	if (value === undefined || value === null) return [];
	const entries = Array.isArray(value) ? value : String(value).split(',');
	return entries.map((entry) => String(entry).trim()).filter((entry) => entry !== '');
}

// ============================================
// Course
// ============================================

export function buildCourseRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');

	switch (operation) {
		case 'create': {
			const fields = getParamObject('additionalFields');
			// These three are request-level arguments in Canvas, not attributes of the course.
			const topLevel: Record<string, unknown> = {};
			for (const key of ['offer', 'enroll_me', 'enable_sis_reactivation']) {
				if (fields[key] !== undefined) {
					topLevel[key] = fields[key];
					delete fields[key];
				}
			}
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${getParam('accountId')}/courses`,
				body: { course: { name: getParam('name'), ...fields }, ...topLevel },
			};
		}
		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/courses/${courseId}`,
				qs: { event: 'delete' },
			};
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}`,
				qs: getParamObject('options'),
			};
		case 'getAll':
			return {
				method: 'GET',
				endpoint: '/api/v1/courses',
				qs: getParamObject('options'),
			};
		case 'update':
			return {
				method: 'PUT',
				endpoint: `/api/v1/courses/${courseId}`,
				body: { course: getParamObject('updateFields') },
			};
		case 'conclude':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/courses/${courseId}`,
				qs: { event: 'conclude' },
			};
		case 'copy':
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${courseId}/content_migrations`,
				body: {
					migration_type: 'course_copy_importer',
					settings: { source_course_id: getParam('sourceCourseId'), ...getParamObject('options') },
				},
			};
		case 'listStudents':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/students`,
				qs: getParamObject('options'),
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for course`);
	}
}

// ============================================
// Section
// ============================================

export function buildSectionRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const sectionId = getParam('sectionId');

	switch (operation) {
		case 'create': {
			const fields = getParamObject('additionalFields');
			// A request-level argument in Canvas, not an attribute of the section.
			const topLevel = takeKeys(fields, ['enable_sis_reactivation']);
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${courseId}/sections`,
				body: { course_section: { name: getParam('name'), ...fields }, ...topLevel },
			};
		}
		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/sections/${sectionId}`,
			};
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/sections/${sectionId}`,
				qs: withoutBlanks(getParamObject('options')),
			};
		case 'getAll':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/sections`,
				qs: withoutBlanks(getParamObject('options')),
			};
		case 'listUsers':
			return {
				method: 'GET',
				endpoint: `/api/v1/sections/${sectionId}/users`,
				qs: withoutBlanks(getParamObject('options')),
			};
		case 'update': {
			const fields = getParamObject('updateFields');
			// A request-level argument in Canvas, not an attribute of the section. It goes into
			// the query string: Canvas treats a JSON `false` in the body as "not given".
			const qs = takeKeys(fields, ['override_sis_stickiness']);
			return {
				method: 'PUT',
				endpoint: `/api/v1/sections/${sectionId}`,
				body: { course_section: fields },
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}
		case 'crosslist': {
			const qs = getParamObject('options');
			return {
				method: 'POST',
				endpoint: `/api/v1/sections/${sectionId}/crosslist/${getParam('newCourseId')}`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}
		case 'decrosslist': {
			const qs = getParamObject('options');
			return {
				method: 'DELETE',
				endpoint: `/api/v1/sections/${sectionId}/crosslist`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for section`);
	}
}

// ============================================
// Tab
// ============================================

function getTabBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType', 'course');
	const contextId = getParam('contextId');

	switch (contextType) {
		case 'course':
			return `/api/v1/courses/${contextId}`;
		case 'account':
			return `/api/v1/accounts/${contextId}`;
		case 'group':
			return `/api/v1/groups/${contextId}`;
		case 'user':
			return `/api/v1/users/${contextId}`;
		default:
			throw new ApplicationError(`Unknown tab context type: ${contextType}`);
	}
}

export function buildTabRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${getTabBasePath(getParam)}/tabs`,
				qs: withoutBlanks(getParamObject('options')),
			};
		case 'update':
			// Canvas can only change the navigation of a course.
			return {
				method: 'PUT',
				endpoint: `/api/v1/courses/${getParam('contextId')}/tabs/${encodeURIComponent(getParam('tabId'))}`,
				body: getParamObject('updateFields'),
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for tab`);
	}
}

// ============================================
// Course Pace
// ============================================

interface IPaceItem {
	id?: string | number;
	module_item_id?: string | number;
	duration?: string | number;
}

/**
 * Translate the pace fields of the UI into the `course_pace` object Canvas expects:
 * days to skip as an array, the pace context as Canvas names it, and the
 * per-module-item durations as nested attributes.
 */
function buildCoursePaceBody(
	fields: Record<string, unknown>,
	itemsParam: Record<string, unknown>,
): Record<string, unknown> {
	const pace: Record<string, unknown> = { ...fields };

	if (pace.selected_days_to_skip !== undefined) {
		// Canvas stores three-letter day names ("sat", "sun").
		pace.selected_days_to_skip = toList(pace.selected_days_to_skip).map((day) =>
			day.toLowerCase().slice(0, 3),
		);
	}

	// Canvas names the student context "Enrollment" (and expects the student's user ID with it).
	if (pace.context_type === 'User') {
		pace.context_type = 'Enrollment';
	}
	if (pace.context_type === 'Course' || pace.context_id === undefined || pace.context_id === '') {
		delete pace.context_type;
		delete pace.context_id;
	}

	const items = itemsParam.item as IPaceItem[] | undefined;
	if (Array.isArray(items) && items.length > 0) {
		pace.course_pace_module_items_attributes = items.map((item) => {
			const attributes: Record<string, unknown> = {
				module_item_id: item.module_item_id,
				duration: item.duration,
			};
			if (item.id !== undefined && item.id !== '') {
				attributes.id = item.id;
			}
			return attributes;
		});
	}

	return pace;
}

export function buildCoursePaceRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const coursePaceId = getParam('coursePaceId');
	const basePath = `/api/v1/courses/${courseId}/course_pacing`;

	switch (operation) {
		case 'create': {
			const pace = buildCoursePaceBody(
				getParamObject('additionalFields'),
				getParamObject('moduleItems'),
			);
			// Canvas rejects an empty `course_pace` object, so a pace created without any
			// option states the default explicitly.
			if (Object.keys(pace).length === 0) {
				pace.workflow_state = 'unpublished';
			}
			return {
				method: 'POST',
				endpoint: basePath,
				body: { course_pace: pace },
			};
		}
		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/${coursePaceId}`,
			};
		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/${coursePaceId}`,
			};
		case 'getByContext': {
			const paceContext = getParam('paceContext', 'course');
			const qs: Record<string, unknown> = {};
			if (paceContext === 'section') {
				qs.course_section_id = getParam('sectionId');
			} else if (paceContext === 'enrollment') {
				qs.enrollment_id = getParam('enrollmentId');
			}
			return {
				method: 'GET',
				endpoint: `${basePath}/new`,
				qs,
			};
		}
		case 'publish':
			return {
				method: 'POST',
				endpoint: `${basePath}/${coursePaceId}/publish`,
			};
		case 'update':
			return {
				method: 'PUT',
				endpoint: `${basePath}/${coursePaceId}`,
				body: {
					course_pace: buildCoursePaceBody(
						getParamObject('updateFields'),
						getParamObject('moduleItems'),
					),
				},
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for coursePace`);
	}
}

// ============================================
// Course Report
// ============================================

export function buildCourseReportRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const reportType = getParam('reportType', 'course_pace_docx');
	const basePath = `/api/v1/courses/${courseId}/reports/${encodeURIComponent(reportType)}`;

	switch (operation) {
		case 'create': {
			const options = getParamObject('options');
			// Canvas requires the `parameters` object, even when nothing is selected.
			const parameters: Record<string, unknown> = {
				section_ids: toList(options.section_ids),
				enrollment_ids: toList(options.enrollment_ids),
			};
			return {
				method: 'POST',
				endpoint: basePath,
				body: { parameters },
			};
		}
		case 'getStatus':
			return {
				method: 'GET',
				endpoint: `${basePath}/${getParam('reportId')}`,
			};
		case 'getLastStatus':
			return {
				method: 'GET',
				endpoint: basePath,
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for courseReport`);
	}
}
