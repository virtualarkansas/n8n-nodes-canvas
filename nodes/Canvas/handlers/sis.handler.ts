import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// SIS Import
// ============================================

export function buildSisImportRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const qs: Record<string, unknown> = {};

			// All create params go as query string for multipart upload
			if (additionalFields.import_type) {
				qs.import_type = additionalFields.import_type;
			}
			if (additionalFields.extension) {
				qs.extension = additionalFields.extension;
			}
			if (additionalFields.batch_mode !== undefined) {
				qs.batch_mode = additionalFields.batch_mode;
			}
			if (additionalFields.batch_mode_term_id) {
				qs.batch_mode_term_id = additionalFields.batch_mode_term_id;
			}
			if (additionalFields.batch_mode_enrollment_drop_status) {
				qs.batch_mode_enrollment_drop_status = additionalFields.batch_mode_enrollment_drop_status;
			}
			if (additionalFields.multi_term_batch_mode !== undefined) {
				qs.multi_term_batch_mode = additionalFields.multi_term_batch_mode;
			}
			if (additionalFields.skip_deletes !== undefined) {
				qs.skip_deletes = additionalFields.skip_deletes;
			}
			if (additionalFields.override_sis_stickiness !== undefined) {
				qs.override_sis_stickiness = additionalFields.override_sis_stickiness;
			}
			if (additionalFields.add_sis_stickiness !== undefined) {
				qs.add_sis_stickiness = additionalFields.add_sis_stickiness;
			}
			if (additionalFields.clear_sis_stickiness !== undefined) {
				qs.clear_sis_stickiness = additionalFields.clear_sis_stickiness;
			}
			if (additionalFields.update_sis_id_if_login_claimed !== undefined) {
				qs.update_sis_id_if_login_claimed = additionalFields.update_sis_id_if_login_claimed;
			}
			if (additionalFields.diffing_data_set_identifier) {
				qs.diffing_data_set_identifier = additionalFields.diffing_data_set_identifier;
			}
			if (additionalFields.diffing_remaster_data_set !== undefined) {
				qs.diffing_remaster_data_set = additionalFields.diffing_remaster_data_set;
			}
			if (additionalFields.diffing_drop_status) {
				qs.diffing_drop_status = additionalFields.diffing_drop_status;
			}
			if (additionalFields.diffing_user_remove_status) {
				qs.diffing_user_remove_status = additionalFields.diffing_user_remove_status;
			}
			if (additionalFields.change_threshold) {
				qs.change_threshold = additionalFields.change_threshold;
			}
			if (additionalFields.diff_row_count_threshold) {
				qs.diff_row_count_threshold = additionalFields.diff_row_count_threshold;
			}

			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${accountId}/sis_imports`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/sis_imports/${getParam('importId')}`,
			};

		case 'getAll': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (options.created_since) {
				qs.created_since = options.created_since;
			}
			if (options.created_before) {
				qs.created_before = options.created_before;
			}
			if (
				options.workflow_state &&
				Array.isArray(options.workflow_state) &&
				(options.workflow_state as string[]).length > 0
			) {
				qs['workflow_state[]'] = options.workflow_state;
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/sis_imports`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'getCurrent':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/sis_imports/importing`,
			};

		case 'abort':
			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}/sis_imports/${getParam('importId')}/abort`,
			};

		case 'abortAllPending':
			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}/sis_imports/abort_all_pending`,
			};

		case 'restoreStates': {
			const options = getParamObject('options');
			const body: Record<string, unknown> = {};

			if (options.batch_mode !== undefined) {
				body.batch_mode = options.batch_mode;
			}
			if (options.undelete_only !== undefined) {
				body.undelete_only = options.undelete_only;
			}
			if (options.unconclude_only !== undefined) {
				body.unconclude_only = options.unconclude_only;
			}

			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${accountId}/sis_imports/${getParam('importId')}/restore_states`,
				...(Object.keys(body).length > 0 ? { body } : {}),
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for sisImport`);
	}
}

// ============================================
// SIS Import Error
// ============================================

export function buildSisImportErrorRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');

	switch (operation) {
		case 'getAll': {
			const importId = getParam('importId');
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (options.failure !== undefined) {
				qs.failure = options.failure;
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/sis_imports/${importId}/errors`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'getAllForAccount': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (options.failure !== undefined) {
				qs.failure = options.failure;
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/sis_import_errors`,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for sisImportError`);
	}
}

// ============================================
// SIS Integration
// ============================================

export function buildSisIntegrationRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	switch (operation) {
		case 'getAssignments': {
			const context = getParam('context');
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (options.starts_before) {
				qs.starts_before = options.starts_before;
			}
			if (options.ends_after) {
				qs.ends_after = options.ends_after;
			}
			if (
				options.include &&
				Array.isArray(options.include) &&
				(options.include as string[]).length > 0
			) {
				qs['include[]'] = options.include;
			}

			let endpoint: string;
			if (context === 'account') {
				const accountId = getParam('accountId');
				endpoint = `/api/v1/accounts/${accountId}/sis/assignments`;
			} else {
				const courseId = getParam('courseId');
				endpoint = `/api/v1/courses/${courseId}/sis/assignments`;
			}

			return {
				method: 'GET',
				endpoint,
				...(Object.keys(qs).length > 0 ? { qs } : {}),
			};
		}

		case 'disablePostToSis': {
			const courseId = getParam('courseId');
			const options = getParamObject('options');
			const body: Record<string, unknown> = {};

			if (options.grading_period_id) {
				body.grading_period_id = options.grading_period_id;
			}

			return {
				method: 'PUT',
				endpoint: `/api/v1/courses/${courseId}/sis/assignments`,
				...(Object.keys(body).length > 0 ? { body } : {}),
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for sisIntegration`);
	}
}
