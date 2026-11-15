import { ApplicationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

/**
 * IDs typed as "1, 2,3" (or handed over as an array / a single number by an
 * expression) as a clean list. Canvas wants real arrays for `ids[]` arguments.
 */
function toIdList(value: unknown): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	const parts = Array.isArray(value) ? value : String(value).split(',');
	return parts.map((part) => String(part).trim()).filter((part) => part !== '');
}

/** True for values a user left empty in a (fixed) collection. */
function isBlank(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

/** Rows of a `multipleValues` fixed collection. */
function collectionRows(collection: unknown, key: string): IDataObject[] {
	if (collection === null || typeof collection !== 'object') {
		return [];
	}
	const rows = (collection as Record<string, unknown>)[key];
	return Array.isArray(rows) ? (rows as IDataObject[]) : [];
}

/** Copy the keys that were filled in. */
function pick(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const key of keys) {
		if (!isBlank(source[key])) {
			out[key] = source[key];
		}
	}
	return out;
}

/** Canvas reads Ruby hashes keyed by position for rubric criteria and ratings, not arrays. */
function byIndex(rows: Array<Record<string, unknown>>): Record<string, Record<string, unknown>> {
	const out: Record<string, Record<string, unknown>> = {};
	rows.forEach((row, index) => {
		out[String(index)] = row;
	});
	return out;
}

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

/**
 * `rubric[criteria]` from the Criteria collection.
 *
 * Canvas takes the points of a criterion from its ratings (the highest one), so a
 * criterion without ratings would be worth 0 points. When no ratings are given the
 * two ratings the Canvas rubric editor starts with are sent instead.
 */
function rubricCriteria(collection: Record<string, unknown>): Record<string, Record<string, unknown>> {
	const criteria = collectionRows(collection, 'criterion').map((item) => {
		const criterion: Record<string, unknown> = {
			description: item.description,
			...pick(item, ['id', 'long_description', 'learning_outcome_id', 'mastery_points']),
		};
		if (item.criterion_use_range === true) {
			criterion.criterion_use_range = true;
		}
		if (item.ignore_for_scoring === true) {
			criterion.ignore_for_scoring = true;
		}

		const ratings = collectionRows(item.ratings, 'rating').map((rating) => ({
			description: rating.description,
			points: rating.points ?? 0,
			...pick(rating, ['id', 'long_description']),
		}));
		if (ratings.length === 0) {
			const points = Number(item.points ?? 0);
			ratings.push({ description: 'Full Marks', points }, { description: 'No Marks', points: 0 });
		}
		criterion.ratings = byIndex(ratings);
		return criterion;
	});
	return byIndex(criteria);
}

/**
 * `rubric_association` from the association fields of Create / Update.
 * Without an association a rubric exists but is listed nowhere in Canvas and cannot be
 * read or deleted through the API, so Create bookmarks it in its course by default.
 */
function rubricAssociation(
	fields: Record<string, unknown>,
	courseId: string,
	defaultToCourse: boolean,
): Record<string, unknown> | undefined {
	const association: Record<string, unknown> = {};
	let type = fields.rubric_association_association_type as string | undefined;
	let id = fields.rubric_association_association_id as string | number | undefined;

	if (isBlank(id) && (type === 'Course' || (isBlank(type) && defaultToCourse))) {
		if (!/^\d+$/.test(courseId)) {
			throw new ApplicationError(
				'The rubric is added to the rubric list of its course, which needs the numeric course ID. ' +
					'Use the numeric Course ID, or set Association ID and Association Type yourself.',
			);
		}
		type = 'Course';
		id = courseId;
	}
	if (isBlank(id) && !isBlank(type)) {
		throw new ApplicationError(`An Association ID is required to associate the rubric with an ${String(type)}`);
	}
	if (!isBlank(id)) {
		association.association_id = typeof id === 'string' ? id.trim() : id;
		association.association_type = isBlank(type) ? 'Assignment' : type;
		association.purpose = isBlank(fields.rubric_association_purpose)
			? association.association_type === 'Assignment'
				? 'grading'
				: 'bookmark'
			: fields.rubric_association_purpose;
	} else if (!isBlank(fields.rubric_association_purpose)) {
		association.purpose = fields.rubric_association_purpose;
	}
	if (fields.rubric_association_use_for_grading !== undefined) {
		association.use_for_grading = fields.rubric_association_use_for_grading;
	}
	if (fields.rubric_association_hide_score_total !== undefined) {
		association.hide_score_total = fields.rubric_association_hide_score_total;
	}
	return Object.keys(association).length > 0 ? association : undefined;
}

/** `rubric[...]` for Create and Update, which Canvas handles with the same code. */
function rubricBody(
	getParam: GetParam,
	getParamObject: GetParamObject,
	fields: Record<string, unknown>,
	defaultToCourse: boolean,
): Record<string, unknown> {
	const rubric: Record<string, unknown> = {
		title: getParam('title'),
		criteria: rubricCriteria(getParamObject('criteria')),
	};
	// Canvas only understands "1" as true here.
	if (fields.free_form_criterion_comments !== undefined) {
		rubric.free_form_criterion_comments = fields.free_form_criterion_comments === true ? '1' : '0';
	}

	const body: Record<string, unknown> = { rubric };
	const association = rubricAssociation(fields, getParam('courseId'), defaultToCourse);
	if (association) {
		body.rubric_association = association;
	}
	return body;
}

/** `rubric_assessment` for Create / Update Assessment: one `criterion_<id>` entry per assessed criterion. */
function rubricAssessment(getParam: GetParam, getParamObject: GetParamObject): Record<string, unknown> {
	const assessment: Record<string, unknown> = {
		user_id: getParam('userId'),
		assessment_type: getParam('assessmentType', 'grading'),
	};
	for (const row of collectionRows(getParamObject('criterionAssessments'), 'criterion')) {
		const criterionId = String(row.criterion_id ?? '').trim();
		if (criterionId === '') {
			continue;
		}
		const entry: Record<string, unknown> = pick(row, ['points', 'rating_id', 'comments']);
		if (row.save_comment === true) {
			entry.save_comment = '1';
		}
		assessment[`criterion_${criterionId}`] = entry;
	}
	return assessment;
}

// ============================================
// RUBRIC
// ============================================

export function handleRubricResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const rubricId = getParam('rubricId');
	// Canvas only has routes for writing rubrics, associations and assessments in a course.
	const coursePath = `/api/v1/courses/${getParam('courseId')}`;

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: `${coursePath}/rubrics`,
				body: rubricBody(getParam, getParamObject, getParamObject('additionalFields'), true),
			};

		case 'update': {
			const options = getParamObject('options');
			if (collectionRows(getParamObject('criteria'), 'criterion').length === 0) {
				throw new ApplicationError(
					'At least one criterion is required for rubric update: Canvas replaces the whole rubric, so an update without criteria would empty it',
				);
			}
			const body = rubricBody(getParam, getParamObject, options, false);
			if (!isBlank(options.rubric_association_id)) {
				body.rubric_association_id = options.rubric_association_id;
			}
			// A request argument of its own (not part of `rubric`), read as text by Canvas.
			if (options.skip_updating_points_possible !== undefined) {
				body.skip_updating_points_possible = options.skip_updating_points_possible === true ? 'true' : 'false';
			}
			return {
				method: 'PUT',
				endpoint: `${coursePath}/rubrics/${rubricId}`,
				body,
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${coursePath}/rubrics/${rubricId}`,
			};

		case 'get': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};
			// Canvas accepts at most one assessment scope and one association scope.
			const include = [options.include_assessments, options.include_associations].filter(
				(value) => !isBlank(value) && value !== 'none',
			);
			if (include.length > 0) {
				qs.include = include;
			}
			if (options.style) {
				qs.style = options.style;
			}

			return {
				method: 'GET',
				endpoint: `${getRubricBasePath(getParam)}/rubrics/${rubricId}`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${getRubricBasePath(getParam)}/rubrics`,
			};

		case 'getUsedLocations':
			return {
				method: 'GET',
				endpoint: `${getRubricBasePath(getParam)}/rubrics/${rubricId}/used_locations`,
			};

		case 'createAssociation':
			return {
				method: 'POST',
				endpoint: `${coursePath}/rubric_associations`,
				body: {
					rubric_association: {
						rubric_id: rubricId,
						association_type: getParam('associationType', 'Assignment'),
						association_id: getParam('associationId'),
						...getParamObject('additionalFields'),
					},
				},
			};

		case 'updateAssociation':
			return {
				method: 'PUT',
				endpoint: `${coursePath}/rubric_associations/${getParam('rubricAssociationId')}`,
				body: { rubric_association: getParamObject('updateFields') },
			};

		case 'deleteAssociation':
			return {
				method: 'DELETE',
				endpoint: `${coursePath}/rubric_associations/${getParam('rubricAssociationId')}`,
			};

		case 'createAssessment':
		case 'updateAssessment': {
			const options = getParamObject('options');
			const assessmentsPath = `${coursePath}/rubric_associations/${getParam('rubricAssociationId')}/rubric_assessments`;
			return {
				method: operation === 'createAssessment' ? 'POST' : 'PUT',
				endpoint:
					operation === 'createAssessment'
						? assessmentsPath
						: `${assessmentsPath}/${getParam('rubricAssessmentId')}`,
				body: {
					rubric_assessment: rubricAssessment(getParam, getParamObject),
					...pick(options, ['provisional', 'final', 'graded_anonymously']),
				},
			};
		}

		case 'deleteAssessment':
			return {
				method: 'DELETE',
				endpoint: `${coursePath}/rubric_associations/${getParam('rubricAssociationId')}/rubric_assessments/${getParam('rubricAssessmentId')}`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for rubric`);
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

/** `ratings[]` of an outcome from the Ratings collection. */
function outcomeRatings(collection: Record<string, unknown>): IDataObject[] {
	return collectionRows(collection, 'rating').map((rating) => ({
		description: rating.description,
		points: rating.points ?? 0,
	}));
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
		// Canvas creates an outcome by linking a new one into an outcome group.
		case 'create': {
			const body: Record<string, unknown> = {
				title: getParam('title'),
				...getParamObject('additionalFields'),
			};
			const ratings = outcomeRatings(getParamObject('ratings'));
			if (ratings.length > 0) {
				body.ratings = ratings;
			}
			return {
				method: 'POST',
				endpoint: `${getOutcomeGroupBasePath(getParam)}/outcome_groups/${getParam('outcomeGroupId')}/outcomes`,
				body,
			};
		}

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
			const body: Record<string, unknown> = { ...getParamObject('updateFields') };
			const ratings = outcomeRatings(getParamObject('ratings'));
			if (ratings.length > 0) {
				body.ratings = ratings;
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/outcomes/${outcomeId}`,
				body,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for outcome`);
	}
}

// ============================================
// OUTCOME GROUP
// ============================================

/**
 * Canvas abbreviates outcomes and groups unless told otherwise, and treats any
 * style it is sent (even "abbrev") as a request for the full form. So the
 * style arguments are only sent for "full".
 */
function fullStyles(options: Record<string, unknown>, keys: string[]): Record<string, unknown> {
	const qs: Record<string, unknown> = {};
	for (const key of keys) {
		if (options[key] === 'full') {
			qs[key] = 'full';
		}
	}
	return qs;
}

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

		// Not offered for the global context: Canvas has no route to list all global groups.
		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${basePath}/outcome_groups`,
			};

		case 'getAllLinks': {
			const qs = fullStyles(getParamObject('options'), ['outcome_style', 'outcome_group_style']);
			return {
				method: 'GET',
				endpoint: `${basePath}/outcome_group_links`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

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

		case 'linkOutcome': {
			const options = getParamObject('options');
			return {
				method: 'PUT',
				endpoint: `${basePath}/outcome_groups/${groupId}/outcomes/${getParam('outcomeId')}`,
				...(isBlank(options.move_from) ? {} : { body: { move_from: options.move_from } }),
			};
		}

		case 'unlinkOutcome':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/outcome_groups/${groupId}/outcomes/${getParam('outcomeId')}`,
			};

		case 'listOutcomes': {
			const qs = fullStyles(getParamObject('options'), ['outcome_style']);
			return {
				method: 'GET',
				endpoint: `${basePath}/outcome_groups/${groupId}/outcomes`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
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
			const groupId = getParamObject('additionalFields').learning_outcome_group_id;
			// Canvas reads the CSV from the request body itself (or from a multipart upload), never
			// from a JSON field, so the text is handed to the request layer as the body: a string
			// is sent as it is. No `extension` argument: with it Canvas loses the uploaded body.
			return {
				method: 'POST',
				endpoint: `${basePath}/outcome_imports${isBlank(groupId) ? '' : `/group/${String(groupId).trim()}`}`,
				qs: { import_type: 'instructure_csv' },
				body: getParam('csvData') as unknown as Record<string, unknown>,
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

/** Filters shared by the outcome result endpoints. */
function outcomeResultFilters(options: Record<string, unknown>): Record<string, unknown> {
	const qs: Record<string, unknown> = {};
	const userIds = toIdList(options.user_ids);
	if (userIds.length > 0) {
		qs.user_ids = userIds;
	}
	const outcomeIds = toIdList(options.outcome_ids);
	if (outcomeIds.length > 0) {
		qs.outcome_ids = outcomeIds;
	}
	for (const key of ['outcome_group_id', 'section_id']) {
		if (!isBlank(options[key])) {
			qs[key] = options[key];
		}
	}
	return qs;
}

export function handleOutcomeResultResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');

	switch (operation) {
		// { outcome_results: [...] }: one item per result, all pages.
		case 'getAll': {
			const options = getParamObject('options');
			const qs = outcomeResultFilters(options);
			if (options.include_hidden !== undefined) {
				qs.include_hidden = options.include_hidden;
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/outcome_results`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
				dataKey: 'outcome_results',
			};
		}

		// { rollups: [...] }: one item per student (or one for the course), all pages.
		case 'getRollups': {
			const options = getParamObject('options');
			const qs = outcomeResultFilters(options);

			if (Array.isArray(options.exclude) && options.exclude.length > 0) {
				qs.exclude = options.exclude;
			}
			for (const key of ['aggregate', 'aggregate_stat', 'sort_by', 'sort_order', 'sort_outcome_id']) {
				if (!isBlank(options[key])) {
					qs[key] = options[key];
				}
			}
			if (options.add_defaults !== undefined) {
				qs.add_defaults = options.add_defaults;
			}
			// Canvas only cuts the student rollups into pages when they are sorted by student or by
			// an outcome score. Unsorted, every page repeats all rollups (while announcing a next page).
			if (isBlank(qs.aggregate) && isBlank(qs.sort_by)) {
				qs.sort_by = 'student';
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/outcome_rollups`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
				dataKey: 'rollups',
			};
		}

		case 'getContributingScores': {
			const outcomeId = getParam('outcomeId');
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			const userIds = toIdList(options.user_ids);
			if (userIds.length > 0) {
				qs.user_ids = userIds;
			}
			if (options.only_assignment_alignments !== undefined) {
				qs.only_assignment_alignments = options.only_assignment_alignments;
			}
			if (options.show_unpublished_assignments !== undefined) {
				qs.show_unpublished_assignments = options.show_unpublished_assignments;
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${courseId}/outcomes/${outcomeId}/contributing_scores`,
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
			const ratingItems = collectionRows(getParamObject('ratings'), 'rating');

			if (ratingItems.length === 0) {
				throw new ApplicationError(
					'At least one rating is required for proficiencyRating set',
				);
			}

			return {
				method: 'POST',
				endpoint: `${basePath}/outcome_proficiency`,
				body: {
					ratings: ratingItems.map((r) => ({
						description: r.description,
						points: r.points,
						mastery: r.mastery === true,
						// Canvas stores six hex digits without the "#" of the color picker.
						color: String(r.color ?? '').trim().replace(/^#/, ''),
					})),
				},
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for proficiencyRating`);
	}
}
