import { ApplicationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Learning Object Dates
// ============================================

const LEARNING_OBJECT_PATHS: Record<string, string> = {
	assignment: 'assignments',
	discussionTopic: 'discussion_topics',
	module: 'modules',
	page: 'pages',
	quiz: 'quizzes',
};

export function buildLearningObjectDateRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const segment = LEARNING_OBJECT_PATHS[getParam('objectType', 'assignment')];
	if (!segment) {
		throw new ApplicationError(`Unknown object type "${getParam('objectType')}" for learningObjectDate`);
	}
	const endpoint = `/api/v1/courses/${getParam('courseId')}/${segment}/${encodeURIComponent(getParam('objectId'))}/date_details`;

	switch (operation) {
		case 'get':
			// The overrides inside the response are paginated; collect them all.
			return { method: 'GET', endpoint, qs: getParamObject('options'), mergePagedArray: 'overrides' };
		case 'update': {
			const fields = getParamObject('updateFields');
			const body: IDataObject = {};
			for (const key of ['due_at', 'unlock_at', 'lock_at', 'only_visible_to_overrides']) {
				if (fields[key] !== undefined && fields[key] !== '') {
					body[key] = fields[key] as IDataObject[keyof IDataObject];
				}
			}
			for (const key of (fields.clear as string[] | undefined) ?? []) {
				body[key] = null;
			}
			if (fields.assignment_overrides !== undefined) {
				let overrides: unknown = fields.assignment_overrides;
				if (typeof overrides === 'string') {
					try {
						overrides = JSON.parse(overrides);
					} catch {
						throw new ApplicationError('Assignment Overrides must be a JSON array, e.g. [{"course_section_id": 12, "due_at": "2026-05-01T23:59:00Z"}]');
					}
				}
				if (!Array.isArray(overrides)) {
					throw new ApplicationError('Assignment Overrides must be a JSON array');
				}
				body.assignment_overrides = overrides as IDataObject[];
			}
			if (Object.keys(body).length === 0) {
				throw new ApplicationError('At least one field is required to update the dates of a learning object');
			}
			// Canvas answers 204 No Content; return the dates as they are afterwards.
			return { method: 'PUT', endpoint, body, thenGet: endpoint, mergePagedArray: 'overrides' };
		}
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for learningObjectDate`);
	}
}

// ============================================
// What-If Grades
// ============================================

export function buildWhatIfGradeRequest(operation: string, getParam: GetParam): IRequestConfig {
	switch (operation) {
		case 'update': {
			const clear = getParam('clearScore', 'false') === 'true';
			const score = getParam('studentEnteredScore', '0');
			if (!clear && !Number.isFinite(Number(score))) {
				throw new ApplicationError(`The what-if score must be a number, got "${score}"`);
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/submissions/${getParam('submissionId')}/what_if_grades`,
				body: { student_entered_score: clear ? null : Number(score) },
			};
		}
		case 'reset':
			return { method: 'PUT', endpoint: `/api/v1/courses/${getParam('courseId')}/what_if_grades/reset` };
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for whatIfGrade`);
	}
}

// ============================================
// Live Assessments
// ============================================

export function buildLiveAssessmentRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const base = `/api/v1/courses/${getParam('courseId')}/live_assessments`;
	const results = `${base}/${getParam('assessmentId')}/results`;

	switch (operation) {
		case 'create': {
			const additional = getParamObject('additionalFields');
			const assessment: IDataObject = { key: getParam('key'), title: getParam('title') };
			if (additional.outcome_id !== undefined && additional.outcome_id !== '') {
				assessment.links = { outcome: String(additional.outcome_id) };
			}
			return { method: 'POST', endpoint: base, body: { assessments: [assessment] }, dataKey: 'assessments' };
		}
		case 'getAll':
			return { method: 'GET', endpoint: base, dataKey: 'assessments' };
		case 'createResults': {
			const entries = ((getParamObject('results').result as IDataObject[] | undefined) ?? []).filter(
				(entry) => entry.user_id !== undefined && entry.user_id !== '',
			);
			if (entries.length === 0) {
				throw new ApplicationError('At least one result with a User ID is required for liveAssessment createResults');
			}
			return {
				method: 'POST',
				endpoint: results,
				body: {
					results: entries.map((entry) => ({
						passed: entry.passed !== false,
						assessed_at: entry.assessed_at || new Date().toISOString(),
						links: { user: String(entry.user_id) },
					})),
				},
				dataKey: 'results',
			};
		}
		case 'getResults':
			return { method: 'GET', endpoint: results, qs: getParamObject('options'), dataKey: 'results' };
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for liveAssessment`);
	}
}
