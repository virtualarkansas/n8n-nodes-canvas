import { ApplicationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { linkedIfAsked } from './shared';
import type { WithPageTransform } from './shared';

/**
 * Canvas builds the "days" and "day details" summaries from a paginated list of
 * submissions, so the same day (or grader) comes back once per page with a
 * partial list each time. Merge those back into one entry.
 */
function mergeById(records: IDataObject[], key: string, nested?: { field: string; key: string; nested?: { field: string; key: string } }): IDataObject[] {
	const merged = new Map<string, IDataObject>();
	for (const record of records) {
		const id = String(record[key]);
		const existing = merged.get(id);
		if (!existing) {
			merged.set(id, { ...record });
			continue;
		}
		if (nested) {
			existing[nested.field] = mergeById(
				[...((existing[nested.field] as IDataObject[]) ?? []), ...((record[nested.field] as IDataObject[]) ?? [])],
				nested.key,
				nested.nested,
			);
		}
	}
	return [...merged.values()];
}

// ============================================
// Gradebook History
// ============================================

export function buildGradebookHistoryRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const base = `/api/v1/courses/${getParam('courseId')}/gradebook_history`;
	// Canvas wants the day only; accept a full date-time from a date picker or expression.
	const date = encodeURIComponent(getParam('date').trim().slice(0, 10));

	switch (operation) {
		case 'getDays':
			return {
				method: 'GET',
				endpoint: `${base}/days`,
				fetchAllPages: true,
				transform: (days) =>
					mergeById(days, 'date', { field: 'graders', key: 'id', nested: { field: 'assignments', key: 'id' } }),
			};
		case 'getDayDetails':
			return {
				method: 'GET',
				endpoint: `${base}/${date}`,
				fetchAllPages: true,
				transform: (graders) => mergeById(graders, 'id', { field: 'assignments', key: 'id' }),
			};
		case 'getSubmissions':
			return {
				method: 'GET',
				endpoint: `${base}/${date}/graders/${getParam('graderId')}/assignments/${getParam('assignmentId')}/submissions`,
			};
		case 'getFeed':
			return { method: 'GET', endpoint: `${base}/feed`, qs: getParamObject('options') };
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for gradebookHistory`);
	}
}

// ============================================
// Grade Change Log
// ============================================

export function buildGradeChangeLogRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const base = '/api/v1/audit/grade_change';
	// Responses look like { links, events: [...], linked: {...} }; each event becomes an item,
	// with the records it refers to unless switched off.
	const list = (endpoint: string, qs: Record<string, unknown>): WithPageTransform => ({
		method: 'GET',
		endpoint,
		qs,
		dataKey: 'events',
		pageTransform: linkedIfAsked(getParam, {
			course: 'courses',
			assignment: 'assignments',
			student: 'users',
			grader: 'users',
			page_view: 'page_views',
		}),
	});

	switch (operation) {
		case 'getByAssignment':
			return list(`${base}/assignments/${getParam('assignmentId')}`, getParamObject('options'));
		case 'getByCourse':
			return list(`${base}/courses/${getParam('courseId')}`, getParamObject('options'));
		case 'getByGrader':
			return list(`${base}/graders/${getParam('graderId')}`, getParamObject('options'));
		case 'getByStudent':
			return list(`${base}/students/${getParam('studentId')}`, getParamObject('options'));
		case 'query': {
			const filters = getParamObject('filters');
			const hasTarget = ['course_id', 'assignment_id', 'student_id', 'grader_id'].some(
				(key) => filters[key] !== undefined && filters[key] !== '',
			);
			if (!hasTarget) {
				throw new ApplicationError(
					'Add at least one filter (Course ID, Assignment ID, Student ID or Grader ID) to query the grade change log',
				);
			}
			return list(base, filters);
		}
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for gradeChangeLog`);
	}
}

// ============================================
// Course Audit Log
// ============================================

export function buildCourseAuditLogRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	// Copy and reset events name the other course under the event type
	// (`links.copied_from`), and Canvas includes that course in `linked.courses`.
	const list = (endpoint: string): WithPageTransform => ({
		method: 'GET',
		endpoint,
		qs: getParamObject('options'),
		dataKey: 'events',
		pageTransform: linkedIfAsked(getParam, {
			course: 'courses',
			copied_from: 'courses',
			copied_to: 'courses',
			reset_from: 'courses',
			reset_to: 'courses',
			user: 'users',
			page_view: 'page_views',
		}),
	});
	switch (operation) {
		case 'getByAccount':
			return list(`/api/v1/audit/course/accounts/${getParam('accountId')}`);
		case 'getByCourse':
			return list(`/api/v1/audit/course/courses/${getParam('courseId')}`);
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for courseAuditLog`);
	}
}
