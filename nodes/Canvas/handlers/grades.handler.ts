import { ApplicationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { collectionRows, isBlank, toList } from './shared';

// ============================================
// CUSTOM GRADEBOOK COLUMN
// ============================================

export function handleCustomGradebookColumnResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const columnId = getParam('columnId');

	switch (operation) {
		case 'create':
			return {
				endpoint: `/api/v1/courses/${courseId}/custom_gradebook_columns`,
				method: 'POST',
				body: {
					column: {
						title: getParam('title'),
						...getParamObject('additionalFields'),
					},
				},
			};

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/custom_gradebook_columns/${columnId}`,
				method: 'DELETE',
			};

		// Canvas has no route for a single column; Get Many returns every column of the course.
		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/custom_gradebook_columns`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getColumnData':
			return {
				endpoint: `/api/v1/courses/${courseId}/custom_gradebook_columns/${columnId}/data`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'reorder': {
			const orderIds = toList(getParam('order'));
			if (orderIds.length === 0) {
				throw new ApplicationError(
					'At least one column ID is required for customGradebookColumn reorder',
				);
			}
			return {
				endpoint: `/api/v1/courses/${courseId}/custom_gradebook_columns/reorder`,
				method: 'POST',
				body: { order: orderIds },
			};
		}

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/custom_gradebook_columns/${columnId}`,
				method: 'PUT',
				body: { column: getParamObject('updateFields') },
			};

		case 'updateColumnData':
			return {
				endpoint: `/api/v1/courses/${courseId}/custom_gradebook_columns/${columnId}/data/${getParam('userId')}`,
				method: 'PUT',
				// An empty content deletes the entry.
				body: { column_data: { content: getParam('content') } },
			};

		case 'bulkUpdateData': {
			const dataEntries = collectionRows(getParamObject('columnData'), 'dataEntry', 'Column Data');

			if (dataEntries.length === 0) {
				throw new ApplicationError(
					'At least one data entry is required for customGradebookColumn bulkUpdateData',
				);
			}

			// Canvas: PUT /courses/:course_id/custom_gradebook_column_data (not under .../custom_gradebook_columns).
			return {
				endpoint: `/api/v1/courses/${courseId}/custom_gradebook_column_data`,
				method: 'PUT',
				body: {
					column_data: dataEntries.map((entry) => ({
						column_id: String(entry.column_id ?? '').trim(),
						user_id: String(entry.user_id ?? '').trim(),
						// An empty string deletes the entry.
						content: isBlank(entry.content) ? '' : String(entry.content),
					})),
				},
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for customGradebookColumn`);
	}
}

// ============================================
// GRADING PERIOD
// ============================================

/**
 * One row of the Batch Update collection as Canvas expects it. Only what was
 * filled in is sent: an existing period (ID set) keeps every attribute that is left empty.
 */
function gradingPeriodAttributes(entry: IDataObject): IDataObject {
	const period: IDataObject = {};
	for (const key of ['id', 'title', 'start_date', 'end_date', 'close_date']) {
		const value = entry[key];
		if (!isBlank(value)) {
			period[key] = typeof value === 'string' ? value.trim() : value;
		}
	}
	if (!isBlank(entry.weight)) {
		// Anything that is not a number is passed on as typed, for Canvas to reject.
		const weight = Number(entry.weight);
		period.weight = Number.isNaN(weight) ? String(entry.weight) : weight;
	}
	return period;
}

export function handleGradingPeriodResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		// Canvas wraps grading periods as { grading_periods: [...] }, also a single one.
		case 'get':
			return {
				endpoint: `/api/v1/courses/${getParam('courseId')}/grading_periods/${getParam('gradingPeriodId')}`,
				method: 'GET',
				dataKey: 'grading_periods',
			};

		case 'getAll': {
			const context = getParam('context');
			let endpoint: string;

			if (context === 'account') {
				endpoint = `/api/v1/accounts/${getParam('accountId')}/grading_periods`;
			} else {
				endpoint = `/api/v1/courses/${getParam('courseId')}/grading_periods`;
			}

			return {
				endpoint,
				method: 'GET',
				dataKey: 'grading_periods',
			};
		}

		// Only reaches grading periods owned by the course (legacy); Canvas answers 404 for
		// a period of a grading period set, which is changed through batchUpdate.
		case 'update':
			return {
				endpoint: `/api/v1/courses/${getParam('courseId')}/grading_periods/${getParam('gradingPeriodId')}`,
				method: 'PUT',
				body: {
					grading_periods: [getParamObject('updateFields')],
				},
				dataKey: 'grading_periods',
			};

		case 'delete': {
			const context = getParam('context');
			let endpoint: string;

			if (context === 'account') {
				endpoint = `/api/v1/accounts/${getParam('accountId')}/grading_periods/${getParam('gradingPeriodId')}`;
			} else {
				endpoint = `/api/v1/courses/${getParam('courseId')}/grading_periods/${getParam('gradingPeriodId')}`;
			}

			return {
				endpoint,
				method: 'DELETE',
			};
		}

		case 'batchUpdate': {
			// Always the route of the set. The course route cannot create periods any more and,
			// when it refuses, leaves an empty course-level set behind that shadows the set of the
			// course's term.
			const endpoint = `/api/v1/grading_period_sets/${getParam('gradingPeriodSetId')}/grading_periods/batch_update`;

			const gradingPeriodEntries = collectionRows(
				getParamObject('gradingPeriods'),
				'gradingPeriod',
				'Grading Periods',
			);

			if (gradingPeriodEntries.length === 0) {
				throw new ApplicationError(
					'At least one grading period is required for gradingPeriod batchUpdate',
				);
			}

			return {
				endpoint,
				method: 'PATCH',
				body: {
					grading_periods: gradingPeriodEntries.map(gradingPeriodAttributes),
				},
				dataKey: 'grading_periods',
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for gradingPeriod`);
	}
}

// ============================================
// GRADING PERIOD SET
// ============================================

export function handleGradingPeriodSetResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');

	switch (operation) {
		case 'create': {
			// `enrollment_term_ids[]` is a request argument of its own, not part of the set.
			const { enrollment_term_ids: termIds, ...setFields } = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				grading_period_set: {
					title: getParam('title'),
					...setFields,
				},
			};
			const enrollmentTermIds = toList(termIds);
			if (enrollmentTermIds.length > 0) {
				body.enrollment_term_ids = enrollmentTermIds;
			}

			return {
				endpoint: `/api/v1/accounts/${accountId}/grading_period_sets`,
				method: 'POST',
				body,
				dataKey: 'grading_period_set',
			};
		}

		case 'delete':
			return {
				endpoint: `/api/v1/accounts/${accountId}/grading_period_sets/${getParam('gradingPeriodSetId')}`,
				method: 'DELETE',
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/accounts/${accountId}/grading_period_sets`,
				method: 'GET',
				dataKey: 'grading_period_sets',
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			// Canvas replaces the terms first and only then looks at the set fields, so a request
			// without set fields would fail with a 400 after the terms have already been changed.
			if (Object.keys(updateFields).length === 0) {
				throw new ApplicationError(
					'At least one update field (Title, Weighted, Display Totals for All Grading Periods) is required for gradingPeriodSet update',
				);
			}

			return {
				endpoint: `/api/v1/accounts/${accountId}/grading_period_sets/${getParam('gradingPeriodSetId')}`,
				method: 'PATCH',
				body: {
					// Always sent: Canvas replaces the terms of the set with this list on every update.
					enrollment_term_ids: toList(getParam('enrollmentTermIds')),
					grading_period_set: updateFields,
				},
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for gradingPeriodSet`);
	}
}

// ============================================
// GRADING STANDARD
// ============================================

/** Rows of the Grading Scheme collection as `grading_scheme_entry[]`. */
function gradingSchemeEntries(collection: Record<string, unknown>): IDataObject[] {
	return collectionRows(collection, 'gradeEntry', 'Grading Scheme').map((entry) => ({
		name: entry.name,
		value: entry.value,
	}));
}

export function handleGradingStandardResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const context = getParam('context');
	const baseEndpoint = context === 'account'
		? `/api/v1/accounts/${getParam('accountId')}`
		: `/api/v1/courses/${getParam('courseId')}`;

	switch (operation) {
		case 'create': {
			const gradeEntries = gradingSchemeEntries(getParamObject('gradingScheme'));

			if (gradeEntries.length === 0) {
				throw new ApplicationError(
					'At least one grade entry is required for gradingStandard create',
				);
			}

			return {
				endpoint: `${baseEndpoint}/grading_standards`,
				method: 'POST',
				body: {
					title: getParam('title'),
					...getParamObject('additionalFields'),
					grading_scheme_entry: gradeEntries,
				},
			};
		}

		case 'delete':
			return {
				endpoint: `${baseEndpoint}/grading_standards/${getParam('gradingStandardId')}`,
				method: 'DELETE',
			};

		case 'get':
			return {
				endpoint: `${baseEndpoint}/grading_standards/${getParam('gradingStandardId')}`,
				method: 'GET',
			};

		case 'getAll':
			return {
				endpoint: `${baseEndpoint}/grading_standards`,
				method: 'GET',
			};

		case 'update': {
			const body: Record<string, unknown> = { ...getParamObject('updateFields') };
			const gradeEntries = gradingSchemeEntries(getParamObject('gradingScheme'));
			if (gradeEntries.length > 0) {
				body.grading_scheme_entry = gradeEntries;
			}
			return {
				endpoint: `${baseEndpoint}/grading_standards/${getParam('gradingStandardId')}`,
				method: 'PUT',
				body,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for gradingStandard`);
	}
}

// ============================================
// LATE POLICY
// ============================================

export function handleLatePolicyResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');

	switch (operation) {
		case 'create': {
			const fields = getParamObject('additionalFields');
			return {
				endpoint: `/api/v1/courses/${courseId}/late_policy`,
				method: 'POST',
				// Canvas rejects an empty late_policy object. Its own default interval creates
				// the policy with every deduction switched off.
				body: {
					late_policy: Object.keys(fields).length > 0 ? fields : { late_submission_interval: 'day' },
				},
				dataKey: 'late_policy',
			};
		}

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/late_policy`,
				method: 'GET',
				dataKey: 'late_policy',
			};

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/late_policy`,
				method: 'PATCH',
				body: { late_policy: getParamObject('updateFields') },
				// Canvas answers 204; return the policy as it is afterwards.
				thenGet: `/api/v1/courses/${courseId}/late_policy`,
				dataKey: 'late_policy',
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for latePolicy`);
	}
}

// ============================================
// MODERATED GRADING
// ============================================

export function handleModeratedGradingResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const assignmentId = getParam('assignmentId');
	const basePath = `/api/v1/courses/${courseId}/assignments/${assignmentId}`;

	switch (operation) {
		case 'listModeratedStudents':
			return {
				endpoint: `${basePath}/moderated_students`,
				method: 'GET',
			};

		case 'selectStudentsForModeration': {
			const studentIds = toList(getParam('studentIds'));
			if (studentIds.length === 0) {
				throw new ApplicationError(
					'At least one student ID is required for moderatedGrading selectStudentsForModeration',
				);
			}
			return {
				endpoint: `${basePath}/moderated_students`,
				method: 'POST',
				body: { student_ids: studentIds },
			};
		}

		case 'getProvisionalGradeStatus': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			// Anonymous IDs have an endpoint of their own.
			let endpoint = `${basePath}/provisional_grades/status`;

			if (getParam('identificationMethod') === 'anonymousId') {
				endpoint = `${basePath}/anonymous_provisional_grades/status`;
				qs.anonymous_id = getParam('anonymousId');
			} else {
				qs.student_id = getParam('studentId');
			}
			if (!isBlank(options.last_updated_at)) {
				qs.last_updated_at = options.last_updated_at;
			}

			return {
				endpoint,
				method: 'GET',
				qs,
			};
		}

		case 'selectProvisionalGrade':
			return {
				endpoint: `${basePath}/provisional_grades/${getParam('provisionalGradeId')}/select`,
				method: 'PUT',
			};

		case 'bulkSelectProvisionalGrades': {
			// Canvas works out the student of each provisional grade itself.
			const provisionalGradeIds = toList(getParam('provisionalGradeIds'));

			if (provisionalGradeIds.length === 0) {
				throw new ApplicationError(
					'At least one provisional grade ID is required for moderatedGrading bulkSelectProvisionalGrades',
				);
			}

			return {
				endpoint: `${basePath}/provisional_grades/bulk_select`,
				method: 'PUT',
				body: { provisional_grade_ids: provisionalGradeIds },
			};
		}

		case 'publishProvisionalGrades':
			return {
				endpoint: `${basePath}/provisional_grades/publish`,
				method: 'POST',
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for moderatedGrading`);
	}
}
