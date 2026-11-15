import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Shared helpers
// ============================================

function isBlank(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

function isOn(value: unknown): boolean {
	return value === true || value === 'true';
}

/** "a, b" or an array from an expression -> ['a', 'b']. */
function toList(value: unknown): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	const entries = Array.isArray(value) ? value : String(value).split(',');
	return entries.map((entry) => String(entry).trim()).filter((entry) => entry !== '');
}

// ============================================
// SIS Import
// ============================================

/** Options Canvas reads with a plain true/false test: sending "false" is harmless. */
const SIS_IMPORT_BOOLEAN_OPTIONS = [
	'add_sis_stickiness',
	'batch_mode',
	'clear_sis_stickiness',
	'diffing_remaster_data_set',
	'override_sis_stickiness',
	'skip_deletes',
	'update_sis_id_if_login_claimed',
];

const SIS_IMPORT_VALUE_OPTIONS = [
	'batch_mode_enrollment_drop_status',
	'batch_mode_term_id',
	'diffing_data_set_identifier',
	'diffing_drop_status',
	'diffing_user_remove_status',
	'import_type',
];

/**
 * The import file itself is the request body (Canvas reads everything else
 * from the query string). The shared request code passes a body that is not a
 * plain object on unchanged, which is what lets text and decoded Base64
 * content through.
 */
function sisImportFile(content: string, encoding: string): Record<string, unknown> {
	if (content.trim() === '') {
		throw new ApplicationError(
			'File Content is empty. Enter the CSV text to import (with its header row), or the Base64 content of a zip file.',
		);
	}
	if (encoding === 'base64') {
		const compact = content.replace(/\s/g, '');
		if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact)) {
			throw new ApplicationError(
				'File Content is not valid Base64. Choose "Text" as the encoding to send CSV text as it is.',
			);
		}
		return Buffer.from(compact, 'base64') as unknown as Record<string, unknown>;
	}
	// Canvas reads the files as UTF-8 and tolerates a byte order mark and Windows line ends.
	return content as unknown as Record<string, unknown>;
}

export function buildSisImportRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const accountId = getParam('accountId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const encoding = getParam('fileEncoding', 'text');
			const body = sisImportFile(getParam('fileContent'), encoding);
			const qs: Record<string, unknown> = {
				// Without it Canvas guesses from the content type and treats the file as a zip.
				extension: isBlank(additionalFields.extension)
					? encoding === 'base64'
						? 'zip'
						: 'csv'
					: additionalFields.extension,
			};

			for (const key of SIS_IMPORT_BOOLEAN_OPTIONS) {
				if (additionalFields[key] !== undefined && additionalFields[key] !== '') {
					qs[key] = additionalFields[key];
				}
			}
			for (const key of SIS_IMPORT_VALUE_OPTIONS) {
				if (!isBlank(additionalFields[key])) {
					qs[key] = additionalFields[key];
				}
			}
			// Canvas only checks that this parameter is present: "false" would switch batch mode on.
			if (isOn(additionalFields.multi_term_batch_mode)) {
				qs.multi_term_batch_mode = true;
			}
			// 0 means "no threshold" for both; Canvas would read a 0 as a threshold of zero percent.
			for (const key of ['change_threshold', 'diff_row_count_threshold']) {
				if (!isBlank(additionalFields[key]) && Number(additionalFields[key]) > 0) {
					qs[key] = additionalFields[key];
				}
			}

			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${accountId}/sis_imports`,
				qs,
				body,
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

			if (!isBlank(options.created_since)) {
				qs.created_since = options.created_since;
			}
			if (!isBlank(options.created_before)) {
				qs.created_before = options.created_before;
			}
			const states = toList(options.workflow_state);
			if (states.length > 0) {
				qs.workflow_state = states;
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/sis_imports`,
				qs,
				// Canvas answers { sis_imports: [...] }.
				dataKey: 'sis_imports',
			};
		}

		case 'getCurrent':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/sis_imports/importing`,
				dataKey: 'sis_imports',
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

			for (const key of ['batch_mode', 'undelete_only', 'unconclude_only']) {
				if (options[key] !== undefined && options[key] !== '') {
					body[key] = options[key];
				}
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
	const options = getParamObject('options');
	const qs: Record<string, unknown> = {};

	// Canvas only checks that "failure" is present: "false" would still filter to failures.
	if (isOn(options.failure)) {
		qs.failure = true;
	}

	switch (operation) {
		case 'getAll':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/sis_imports/${getParam('importId')}/errors`,
				qs,
				// Canvas answers { sis_import_errors: [...] }.
				dataKey: 'sis_import_errors',
			};

		case 'getAllForAccount':
			return {
				method: 'GET',
				endpoint: `/api/v1/accounts/${accountId}/sis_import_errors`,
				qs,
				dataKey: 'sis_import_errors',
			};

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
			const context = getParam('context', 'course');
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			const include = toList(options.include);
			if (include.length > 0) {
				qs.include = include;
			}

			// These endpoints live under /api/sis, not /api/v1.
			if (context === 'account') {
				// The date filters select courses, so they only apply to an account.
				if (!isBlank(options.starts_before)) {
					qs.starts_before = options.starts_before;
				}
				if (!isBlank(options.ends_after)) {
					qs.ends_after = options.ends_after;
				}
				return {
					method: 'GET',
					endpoint: `/api/sis/accounts/${getParam('accountId')}/assignments`,
					qs,
				};
			}

			return {
				method: 'GET',
				endpoint: `/api/sis/courses/${getParam('courseId')}/assignments`,
				qs,
			};
		}

		case 'disablePostToSis': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			if (!isBlank(options.grading_period_id)) {
				qs.grading_period_id = options.grading_period_id;
			}

			return {
				method: 'PUT',
				endpoint: `/api/sis/courses/${getParam('courseId')}/disable_post_to_sis`,
				qs,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for sisIntegration`);
	}
}
