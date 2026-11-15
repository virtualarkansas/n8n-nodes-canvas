import { ApplicationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { isBlankOrWhitespace, toList } from './shared';

// ============================================
// Gradebook (bulk actions)
// ============================================

export function buildGradebookRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');

	switch (operation) {
		case 'applyScoreToUngraded': {
			const assignmentIds = toList(getParam('assignmentIds'));
			const studentIds = toList(getParam('studentIds'));
			if (assignmentIds.length === 0) {
				throw new ApplicationError('Enter at least one assignment ID for gradebook applyScoreToUngraded');
			}
			if (studentIds.length === 0) {
				throw new ApplicationError('Enter at least one student ID for gradebook applyScoreToUngraded');
			}

			const body: Record<string, unknown> = {
				assignment_ids: assignmentIds,
				student_ids: studentIds,
				...getParamObject('options'),
			};
			// Canvas wants exactly one of the two.
			if (getParam('grade', 'percent') === 'excused') {
				body.excused = true;
			} else {
				const percent = Number(getParam('percent'));
				if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
					throw new ApplicationError('Percent must be a number between 0 and 100');
				}
				body.percent = percent;
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/courses/${courseId}/apply_score_to_ungraded_submissions`,
				body,
			};
		}

		case 'updateFinalGradeOverrides': {
			const rows = getParamObject('overrideScores').score;
			const entries = (Array.isArray(rows) ? (rows as IDataObject[]) : []).filter(
				(row) => !isBlankOrWhitespace(row.student_id),
			);
			if (entries.length === 0) {
				throw new ApplicationError(
					'Add at least one override score with a student ID for gradebook updateFinalGradeOverrides',
				);
			}
			const overrideScores = entries.map((row) => {
				// Canvas removes an override when the score is null. Anything that is not a number
				// would be stored as 0 by Canvas, so it is refused here.
				let score: number | null = null;
				if (row.remove !== true) {
					score = isBlankOrWhitespace(row.override_score)
						? Number.NaN
						: Number(row.override_score);
					if (!Number.isFinite(score)) {
						throw new ApplicationError(
							`Override score "${String(row.override_score ?? '')}" of student ${String(row.student_id)} is not a number`,
						);
					}
				}
				return { student_id: String(row.student_id).trim(), override_score: score };
			});

			const body: Record<string, unknown> = { override_scores: overrideScores };
			const gradingPeriodId = getParamObject('options').grading_period_id;
			if (!isBlankOrWhitespace(gradingPeriodId)) {
				body.grading_period_id = String(gradingPeriodId).trim();
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/courses/${courseId}/update_final_grade_overrides`,
				body,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for gradebook`);
	}
}
