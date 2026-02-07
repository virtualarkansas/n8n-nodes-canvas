import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Helper: resolve context base path for rubric (account/course)
// ============================================

function getRubricBasePath(getParam: GetParam): string {
	const context = getParam('context');
	if (context === 'account') {
		return `/api/v1/accounts/${getParam('accountId')}`;
	}
	return `/api/v1/courses/${getParam('courseId')}`;
}

// ============================================
// RUBRIC
// ============================================

export function handleRubricResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getRubricBasePath(getParam);
	const rubricId = getParam('rubricId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const criteriaData = getParamObject('criteria');
			const criteriaItems = (criteriaData.criterion as Array<{
				description: string;
				points: number;
				long_description?: string;
			}>) || [];

			// Build rubric criteria object keyed by index
			const criteria: Record<string, Record<string, unknown>> = {};
			criteriaItems.forEach((item, index) => {
				criteria[index.toString()] = {
					description: item.description,
					points: item.points,
					...(item.long_description ? { long_description: item.long_description } : {}),
				};
			});

			// Build body with rubric and optional rubric_association
			const body: Record<string, unknown> = {
				rubric: {
					title: getParam('title'),
					criteria,
					...(additionalFields.free_form_criterion_comments !== undefined
						? { free_form_criterion_comments: additionalFields.free_form_criterion_comments }
						: {}),
				},
			};

			// Build rubric_association if any association fields are present
			const associationFields: Record<string, unknown> = {};
			if (additionalFields.rubric_association_association_id) {
				associationFields.association_id = additionalFields.rubric_association_association_id;
			}
			if (additionalFields.rubric_association_association_type) {
				associationFields.association_type = additionalFields.rubric_association_association_type;
			}
			if (additionalFields.rubric_association_use_for_grading !== undefined) {
				associationFields.use_for_grading = additionalFields.rubric_association_use_for_grading;
			}
			if (additionalFields.rubric_association_hide_score_total !== undefined) {
				associationFields.hide_score_total = additionalFields.rubric_association_hide_score_total;
			}
			if (additionalFields.rubric_association_purpose) {
				associationFields.purpose = additionalFields.rubric_association_purpose;
			}
			if (Object.keys(associationFields).length > 0) {
				body.rubric_association = associationFields;
			}

			return {
				method: 'POST',
				endpoint: `${basePath}/rubrics`,
				body,
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/rubrics/${rubricId}`,
			};

		case 'get': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (options.include && Array.isArray(options.include) && (options.include as string[]).length > 0) {
				qs['include[]'] = options.include;
			}
			if (options.style) {
				qs.style = options.style;
			}

			return {
				method: 'GET',
				endpoint: `${basePath}/rubrics/${rubricId}`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${basePath}/rubrics`,
			};

		case 'getUsedLocations':
			return {
				method: 'GET',
				endpoint: `${basePath}/rubrics/${rubricId}/used_locations`,
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			const body: Record<string, unknown> = {
				rubric: {},
			};

			const rubricBody = body.rubric as Record<string, unknown>;
			if (updateFields.title) {
				rubricBody.title = updateFields.title;
			}
			if (updateFields.free_form_criterion_comments !== undefined) {
				rubricBody.free_form_criterion_comments = updateFields.free_form_criterion_comments;
			}
			if (updateFields.skip_updating_points_possible !== undefined) {
				rubricBody.skip_updating_points_possible = updateFields.skip_updating_points_possible;
			}

			return {
				method: 'PUT',
				endpoint: `${basePath}/rubrics/${rubricId}`,
				body,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for rubric`);
	}
}

// ============================================
// OUTCOME
// ============================================

export function handleOutcomeResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'get': {
			const outcomeId = getParam('outcomeId');
			const options = getParamObject('options');
			return {
				method: 'GET',
				endpoint: `/api/v1/outcomes/${outcomeId}`,
				...(Object.keys(options).length > 0 ? { qs: options } : {}),
			};
		}

		case 'getAlignedAssignments': {
			const courseId = getParam('courseId');
			const options = getParamObject('options');
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/outcome_alignments`,
				...(Object.keys(options).length > 0 ? { qs: options } : {}),
			};
		}

		case 'update': {
			const outcomeId = getParam('outcomeId');
			const updateFields = getParamObject('updateFields');
			return {
				method: 'PUT',
				endpoint: `/api/v1/outcomes/${outcomeId}`,
				body: updateFields,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for outcome`);
	}
}

// ============================================
// Helper: resolve context base path for outcome group (account/course/global)
// ============================================

function getOutcomeGroupBasePath(getParam: GetParam): string {
	const context = getParam('context');
	if (context === 'account') {
		return `/api/v1/accounts/${getParam('accountId')}`;
	}
	if (context === 'global') {
		return '/api/v1/global';
	}
	return `/api/v1/courses/${getParam('courseId')}`;
}

// ============================================
// OUTCOME GROUP
// ============================================

export function handleOutcomeGroupResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getOutcomeGroupBasePath(getParam);
	const groupId = getParam('outcomeGroupId');

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: `${basePath}/outcome_groups/${groupId}/subgroups`,
				body: { title: getParam('title'), ...getParamObject('additionalFields') },
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/outcome_groups/${groupId}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/outcome_groups/${groupId}`,
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${basePath}/outcome_groups`,
			};

		case 'getRoot':
			return {
				method: 'GET',
				endpoint: `${basePath}/root_outcome_group`,
			};

		case 'import': {
			const sourceOutcomeGroupId = getParam('sourceOutcomeGroupId');
			const options = getParamObject('options');
			return {
				method: 'POST',
				endpoint: `${basePath}/outcome_groups/${groupId}/import`,
				body: {
					source_outcome_group_id: sourceOutcomeGroupId,
					...(options.async !== undefined ? { async: options.async } : {}),
				},
			};
		}

		case 'listOutcomes': {
			const options = getParamObject('options');
			return {
				method: 'GET',
				endpoint: `${basePath}/outcome_groups/${groupId}/outcomes`,
				...(Object.keys(options).length > 0 ? { qs: options } : {}),
			};
		}

		case 'listSubgroups':
			return {
				method: 'GET',
				endpoint: `${basePath}/outcome_groups/${groupId}/subgroups`,
			};

		case 'update':
			return {
				method: 'PUT',
				endpoint: `${basePath}/outcome_groups/${groupId}`,
				body: getParamObject('updateFields'),
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for outcomeGroup`);
	}
}

// ============================================
// Helper: resolve context base path for outcome import (account/course)
// ============================================

function getOutcomeImportBasePath(getParam: GetParam): string {
	const context = getParam('context');
	if (context === 'account') {
		return `/api/v1/accounts/${getParam('accountId')}`;
	}
	return `/api/v1/courses/${getParam('courseId')}`;
}

// ============================================
// OUTCOME IMPORT
// ============================================

export function handleOutcomeImportResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getOutcomeImportBasePath(getParam);

	switch (operation) {
		case 'create': {
			const csvData = getParam('csvData');
			const additionalFields = getParamObject('additionalFields');
			const body: Record<string, unknown> = {
				attachment: csvData,
				...additionalFields,
			};
			return {
				method: 'POST',
				endpoint: `${basePath}/outcome_imports`,
				body,
			};
		}

		case 'getStatus': {
			const importId = getParam('importId');
			return {
				method: 'GET',
				endpoint: `${basePath}/outcome_imports/${importId}`,
			};
		}

		case 'getCreatedGroupIds': {
			const importId = getParam('importId');
			return {
				method: 'GET',
				endpoint: `${basePath}/outcome_imports/${importId}/created_group_ids`,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for outcomeImport`);
	}
}

// ============================================
// OUTCOME RESULT
// ============================================

export function handleOutcomeResultResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');

	switch (operation) {
		case 'getAll': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (options.user_ids) {
				qs['user_ids[]'] = (options.user_ids as string).split(',').map((id) => id.trim());
			}
			if (options.outcome_ids) {
				qs['outcome_ids[]'] = (options.outcome_ids as string).split(',').map((id) => id.trim());
			}
			if (options.include && Array.isArray(options.include) && (options.include as string[]).length > 0) {
				qs['include[]'] = options.include;
			}
			if (options.include_hidden !== undefined) {
				qs.include_hidden = options.include_hidden;
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/outcome_results`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'getRollups': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (options.user_ids) {
				qs['user_ids[]'] = (options.user_ids as string).split(',').map((id) => id.trim());
			}
			if (options.outcome_ids) {
				qs['outcome_ids[]'] = (options.outcome_ids as string).split(',').map((id) => id.trim());
			}
			if (options.include && Array.isArray(options.include) && (options.include as string[]).length > 0) {
				qs['include[]'] = options.include;
			}
			if (options.exclude && Array.isArray(options.exclude) && (options.exclude as string[]).length > 0) {
				qs['exclude[]'] = options.exclude;
			}
			if (options.aggregate) {
				qs.aggregate = options.aggregate;
			}
			if (options.aggregate_stat) {
				qs.aggregate_stat = options.aggregate_stat;
			}
			if (options.sort_by) {
				qs.sort_by = options.sort_by;
			}
			if (options.sort_order) {
				qs.sort_order = options.sort_order;
			}
			if (options.sort_outcome_id) {
				qs.sort_outcome_id = options.sort_outcome_id;
			}
			if (options.add_defaults !== undefined) {
				qs.add_defaults = options.add_defaults;
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/outcome_rollups`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'getContributingScores': {
			const outcomeId = getParam('outcomeId');
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (options.user_ids) {
				qs['user_ids[]'] = (options.user_ids as string).split(',').map((id) => id.trim());
			}
			if (options.only_assignment_alignments !== undefined) {
				qs.only_assignment_alignments = options.only_assignment_alignments;
			}
			if (options.show_unpublished_assignments !== undefined) {
				qs.show_unpublished_assignments = options.show_unpublished_assignments;
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/outcome_rollups/${outcomeId}/contributing_scores`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for outcomeResult`);
	}
}

// ============================================
// Helper: resolve context base path for proficiency rating (account/course)
// ============================================

function getProficiencyRatingBasePath(getParam: GetParam): string {
	const context = getParam('context');
	if (context === 'account') {
		return `/api/v1/accounts/${getParam('accountId')}`;
	}
	return `/api/v1/courses/${getParam('courseId')}`;
}

// ============================================
// PROFICIENCY RATING
// ============================================

export function handleProficiencyRatingResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getProficiencyRatingBasePath(getParam);

	switch (operation) {
		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/outcome_proficiency`,
			};

		case 'set': {
			const ratingsData = getParamObject('ratings');
			const ratingItems = (ratingsData.rating as Array<{
				description: string;
				points: number;
				mastery: boolean;
				color: string;
			}>) || [];

			if (ratingItems.length === 0) {
				throw new ApplicationError(
					'At least one rating is required for proficiencyRating set',
				);
			}

			return {
				method: 'PUT',
				endpoint: `${basePath}/outcome_proficiency`,
				body: {
					ratings: ratingItems.map((r) => ({
						description: r.description,
						points: r.points,
						mastery: r.mastery,
						color: r.color,
					})),
				},
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for proficiencyRating`);
	}
}
