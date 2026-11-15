import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam } from '../types/Canvas.types';

// ============================================
// Content Security Policy Settings
// ============================================

export function buildCspSettingRequest(operation: string, getParam: GetParam): IRequestConfig {
	const accountBase = `/api/v1/accounts/${getParam('accountId')}/csp_settings`;
	const contextBase =
		getParam('contextType', 'account') === 'course'
			? `/api/v1/courses/${getParam('courseId')}/csp_settings`
			: accountBase;

	switch (operation) {
		case 'get':
			return { method: 'GET', endpoint: contextBase };
		case 'setStatus':
			return { method: 'PUT', endpoint: contextBase, body: { status: getParam('status') } };
		case 'lock':
			return {
				method: 'PUT',
				endpoint: `${accountBase}/lock`,
				body: { settings_locked: getParam('settingsLocked') === 'true' },
				// Canvas answers this call with the lock state from before the change.
				thenGet: accountBase,
			};
		case 'addDomain':
			return { method: 'POST', endpoint: `${accountBase}/domains`, body: { domain: getParam('domain').trim() } };
		case 'addDomains': {
			const domains = getParam('domains')
				.split(/[\s,]+/)
				.map((domain) => domain.trim())
				.filter((domain) => domain !== '');
			if (domains.length === 0) {
				throw new ApplicationError('At least one domain is required for cspSetting addDomains');
			}
			return { method: 'POST', endpoint: `${accountBase}/domains/batch_create`, body: { domains } };
		}
		case 'removeDomain':
			return { method: 'DELETE', endpoint: `${accountBase}/domains`, qs: { domain: getParam('domain').trim() } };
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for cspSetting`);
	}
}

// ============================================
// Developer Key Account Binding
// ============================================

export function buildDeveloperKeyAccountBindingRequest(
	operation: string,
	getParam: GetParam,
): IRequestConfig {
	switch (operation) {
		case 'set':
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${getParam('accountId')}/developer_keys/${getParam('developerKeyId')}/developer_key_account_bindings`,
				body: { developer_key_account_binding: { workflow_state: getParam('workflowState', 'on') } },
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for developerKeyAccountBinding`);
	}
}
