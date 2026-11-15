import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';
import { mapFields, toList } from './shared';

// ============================================
// Enrollment
// ============================================

export function buildEnrollmentRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const enrollmentPath = (): string =>
		`/api/v1/courses/${getParam('courseId')}/enrollments/${getParam('enrollmentId')}`;

	switch (operation) {
		case 'getAll': {
			const listBy = getParam('listBy', 'course');
			let endpoint: string;

			switch (listBy) {
				case 'course':
					endpoint = `/api/v1/courses/${getParam('courseId')}/enrollments`;
					break;
				case 'section':
					endpoint = `/api/v1/sections/${getParam('sectionId')}/enrollments`;
					break;
				case 'user':
					endpoint = `/api/v1/users/${getParam('userId')}/enrollments`;
					break;
				default:
					throw new ApplicationError(`Unknown enrollment listBy value: ${listBy}`);
			}

			const filters = getParamObject('filters');
			const qs = mapFields(filters, {
				enrollmentTermId: 'enrollment_term_id',
				gradingPeriodId: 'grading_period_id',
				include: 'include',
				role: 'role',
				state: 'state',
				type: 'type',
				userId: 'user_id',
			});
			// Comma-separated in the UI, arrays in Canvas.
			for (const [uiName, canvasName] of [
				['roleIds', 'role_id'],
				['sisAccountIds', 'sis_account_id'],
				['sisCourseIds', 'sis_course_id'],
				['sisSectionIds', 'sis_section_id'],
				['sisUserIds', 'sis_user_id'],
			]) {
				const values = toList(filters[uiName]);
				if (values.length > 0) {
					qs[canvasName] = values;
				}
			}

			return { method: 'GET', endpoint, qs };
		}
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${getParam('accountId')}/enrollments/${getParam('enrollmentId')}`,
			};
		case 'create':
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${getParam('courseId')}/enrollments`,
				body: {
					enrollment: {
						user_id: getParam('userId'),
						type: getParam('enrollmentType'),
						...mapFields(getParamObject('additionalFields'), {
							associatedUserId: 'associated_user_id',
							courseSectionId: 'course_section_id',
							endAt: 'end_at',
							enrollmentState: 'enrollment_state',
							limitPrivilegesToCourseSection: 'limit_privileges_to_course_section',
							notify: 'notify',
							roleId: 'role_id',
							selfEnrolled: 'self_enrolled',
							selfEnrollmentCode: 'self_enrollment_code',
							startAt: 'start_at',
						}),
					},
				},
			};
		case 'conclude':
			return { method: 'DELETE', endpoint: enrollmentPath(), qs: { task: 'conclude' } };
		case 'deactivate':
			return { method: 'DELETE', endpoint: enrollmentPath(), qs: { task: 'deactivate' } };
		case 'delete':
			return { method: 'DELETE', endpoint: enrollmentPath(), qs: { task: 'delete' } };
		case 'reactivate':
			return { method: 'PUT', endpoint: `${enrollmentPath()}/reactivate` };
		case 'acceptInvitation':
			return { method: 'POST', endpoint: `${enrollmentPath()}/accept` };
		case 'rejectInvitation':
			return { method: 'POST', endpoint: `${enrollmentPath()}/reject` };
		case 'bulkEnroll': {
			const userIds = toList(getParam('userIds'));
			const courseIds = toList(getParam('courseIds'));
			// Canvas answers a request without users or courses with a server error.
			if (userIds.length === 0 || courseIds.length === 0) {
				throw new ApplicationError('Enter at least one user ID and at least one course ID');
			}
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${getParam('accountId')}/bulk_enrollment`,
				body: {
					user_ids: userIds,
					course_ids: courseIds,
					...mapFields(getParamObject('additionalFields'), {
						enrollmentType: 'enrollment_type',
						roleId: 'enrollment_role_id',
					}),
				},
			};
		}
		case 'setLastAttended':
			return {
				method: 'PUT',
				endpoint: `/api/v1/courses/${getParam('courseId')}/users/${getParam('userId')}/last_attended`,
				body: { date: getParam('date') },
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for enrollment`);
	}
}

// ============================================
// Enrollment Term
// ============================================

function buildEnrollmentTermOverrides(getParamObject: GetParamObject): Record<string, object> | undefined {
	const overridesData = getParamObject('overrides');
	const overrideItems = overridesData.override as Array<{
		enrollmentType: string;
		startAt?: string;
		endAt?: string;
	}> | undefined;

	if (!overrideItems || overrideItems.length === 0) {
		return undefined;
	}

	const overrides: Record<string, object> = {};
	for (const item of overrideItems) {
		const override: Record<string, string> = {};
		if (item.startAt) {
			override.start_at = item.startAt;
		}
		if (item.endAt) {
			override.end_at = item.endAt;
		}
		overrides[item.enrollmentType] = override;
	}

	return overrides;
}

const TERM_FIELDS: Record<string, string> = {
	name: 'name',
	startAt: 'start_at',
	endAt: 'end_at',
	sisTermId: 'sis_term_id',
};

export function buildEnrollmentTermRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');

	switch (operation) {
		case 'getAll':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/terms`,
				qs: mapFields(getParamObject('filters'), {
					include: 'include',
					termName: 'term_name',
					workflowState: 'workflow_state',
				}),
				// Canvas wraps the list: { "enrollment_terms": [...] }
				dataKey: 'enrollment_terms',
			};
		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/terms/${getParam('termId')}`,
			};
		case 'create': {
			const overrides = buildEnrollmentTermOverrides(getParamObject);
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${accountId}/terms`,
				body: {
					enrollment_term: {
						name: getParam('name'),
						...mapFields(getParamObject('additionalFields'), TERM_FIELDS),
						...(overrides ? { overrides } : {}),
					},
				},
			};
		}
		case 'update': {
			const fields = getParamObject('updateFields');
			const overrides = buildEnrollmentTermOverrides(getParamObject);
			// Query string, not body: Canvas reads a JSON `false` in the body as "not given".
			const qs = mapFields(fields, { overrideSisStickiness: 'override_sis_stickiness' });
			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}/terms/${getParam('termId')}`,
				body: {
					enrollment_term: {
						// An empty name is not sent; empty dates or SIS ID clear the value.
						...mapFields(fields, { name: 'name' }),
						...mapFields(fields, { startAt: 'start_at', endAt: 'end_at', sisTermId: 'sis_term_id' }, true),
						...(overrides ? { overrides } : {}),
					},
				},
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}
		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/accounts/${accountId}/terms/${getParam('termId')}`,
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for enrollmentTerm`);
	}
}
