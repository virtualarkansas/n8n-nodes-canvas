import { ApplicationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

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

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/custom_gradebook_columns/${columnId}`,
				method: 'GET',
			};

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
			const orderIds = getParam('order').split(',').map((id) => parseInt(id.trim(), 10));
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
				body: { column_data: { content: getParam('content') } },
			};

		case 'bulkUpdateData': {
			const columnDataObj = getParamObject('columnData');
			const dataEntries = (columnDataObj.dataEntry as Array<{
				column_id: string;
				user_id: string;
				content: string;
			}>) || [];

			if (dataEntries.length === 0) {
				throw new ApplicationError(
					'At least one data entry is required for customGradebookColumn bulkUpdateData',
				);
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/custom_gradebook_columns`,
				method: 'PUT',
				body: {
					column_data: dataEntries.map((entry) => ({
						column_id: entry.column_id,
						user_id: entry.user_id,
						content: entry.content,
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

export function handleGradingPeriodResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'get':
			return {
				endpoint: `/api/v1/courses/${getParam('courseId')}/grading_periods/${getParam('gradingPeriodId')}`,
				method: 'GET',
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
			};
		}

		case 'update': {
			const additionalFields = getParamObject('additionalFields');
			return {
				endpoint: `/api/v1/courses/${getParam('courseId')}/grading_periods/${getParam('gradingPeriodId')}`,
				method: 'PATCH',
				body: {
					grading_periods: [{
						start_date: getParam('startDate'),
						end_date: getParam('endDate'),
						...additionalFields,
					}],
				},
			};
		}

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
			const batchContext = getParam('batchContext');
			let endpoint: string;

			if (batchContext === 'gradingPeriodSet') {
				endpoint = `/api/v1/grading_period_sets/${getParam('gradingPeriodSetId')}/grading_periods/batch_update`;
			} else {
				endpoint = `/api/v1/courses/${getParam('courseId')}/grading_periods/batch_update`;
			}

			const gradingPeriodsObj = getParamObject('gradingPeriods');
			const gradingPeriodEntries = (gradingPeriodsObj.gradingPeriod as Array<{
				id?: string;
				title: string;
				start_date: string;
				end_date: string;
				close_date: string;
				weight?: number;
			}>) || [];

			if (gradingPeriodEntries.length === 0) {
				throw new ApplicationError(
					'At least one grading period is required for gradingPeriod batchUpdate',
				);
			}

			const body: IDataObject = {
				set_id: getParam('setId'),
				grading_periods: gradingPeriodEntries.map((entry) => {
					const period: IDataObject = {
						title: entry.title,
						start_date: entry.start_date,
						end_date: entry.end_date,
						close_date: entry.close_date,
					};
					if (entry.id) {
						period.id = entry.id;
					}
					if (entry.weight !== undefined && entry.weight !== 0) {
						period.weight = entry.weight;
					}
					return period;
				}),
			};

			return {
				endpoint,
				method: 'PATCH',
				body,
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
			const additionalFields = getParamObject('additionalFields');
			const body: IDataObject = {
				grading_period_set: {
					title: getParam('title'),
					...additionalFields,
				},
			};

			// Handle enrollment_term_ids as comma-separated string to array
			if (additionalFields.enrollment_term_ids && typeof additionalFields.enrollment_term_ids === 'string') {
				const termIds = (additionalFields.enrollment_term_ids as string).split(',').map((id) => id.trim());
				(body.grading_period_set as IDataObject).enrollment_term_ids = termIds;
			}

			return {
				endpoint: `/api/v1/accounts/${accountId}/grading_period_sets`,
				method: 'POST',
				body,
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
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const body: IDataObject = {
				grading_period_set: { ...updateFields },
			};

			// Handle enrollment_term_ids as comma-separated string to array
			if (updateFields.enrollment_term_ids && typeof updateFields.enrollment_term_ids === 'string') {
				const termIds = (updateFields.enrollment_term_ids as string).split(',').map((id) => id.trim());
				(body.grading_period_set as IDataObject).enrollment_term_ids = termIds;
			}

			return {
				endpoint: `/api/v1/accounts/${accountId}/grading_period_sets/${getParam('gradingPeriodSetId')}`,
				method: 'PATCH',
				body,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for gradingPeriodSet`);
	}
}

// ============================================
// GRADING STANDARD
// ============================================

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
			const gradingSchemeObj = getParamObject('gradingScheme');
			const gradeEntries = (gradingSchemeObj.gradeEntry as Array<{
				name: string;
				value: number;
			}>) || [];

			if (gradeEntries.length === 0) {
				throw new ApplicationError(
					'At least one grade entry is required for gradingStandard create',
				);
			}

			const additionalFields = getParamObject('additionalFields');

			return {
				endpoint: `${baseEndpoint}/grading_standards`,
				method: 'POST',
				body: {
					title: getParam('title'),
					grading_scheme_entry: gradeEntries.map((entry) => ({
						name: entry.name,
						value: entry.value,
					})),
					...additionalFields,
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

		case 'update':
			return {
				endpoint: `${baseEndpoint}/grading_standards/${getParam('gradingStandardId')}`,
				method: 'PUT',
				body: getParamObject('updateFields'),
			};

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
		case 'create':
			return {
				endpoint: `/api/v1/courses/${courseId}/late_policy`,
				method: 'POST',
				body: { late_policy: getParamObject('additionalFields') },
			};

		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/late_policy`,
				method: 'GET',
			};

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/late_policy`,
				method: 'PATCH',
				body: { late_policy: getParamObject('updateFields') },
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
			const studentIds = getParam('studentIds').split(',').map((id) => id.trim());
			return {
				endpoint: `${basePath}/moderated_students`,
				method: 'POST',
				body: { student_ids: studentIds },
			};
		}

		case 'getProvisionalGradeStatus': {
			const identificationMethod = getParam('identificationMethod');
			const qs: IDataObject = {};

			if (identificationMethod === 'studentId') {
				qs.student_id = getParam('studentId');
			} else {
				qs.anonymous_id = getParam('anonymousId');
			}

			return {
				endpoint: `${basePath}/provisional_grades/status`,
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
			const selectionsObj = getParamObject('provisionalGradeSelections');
			const selections = (selectionsObj.selection as Array<{
				student_id: string;
				provisional_grade_id: string;
			}>) || [];

			if (selections.length === 0) {
				throw new ApplicationError(
					'At least one selection is required for moderatedGrading bulkSelectProvisionalGrades',
				);
			}

			return {
				endpoint: `${basePath}/provisional_grades/bulk_select`,
				method: 'PUT',
				body: selections.reduce((acc: IDataObject, sel) => {
					acc[sel.student_id] = sel.provisional_grade_id;
					return acc;
				}, {}),
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
