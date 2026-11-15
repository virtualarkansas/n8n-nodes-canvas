import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Brand Config: shared themes (shared brand configs)
// ============================================

export function buildBrandConfigRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const sharedId = getParam('sharedBrandConfigId');

	switch (operation) {
		case 'share':
			return {
				method: 'POST',
				endpoint: `/api/v1/accounts/${getParam('accountId')}/shared_brand_configs`,
				body: {
					shared_brand_config: {
						name: getParam('name'),
						brand_config_md5: getParam('brandConfigMd5').trim(),
					},
				},
			};

		case 'updateShared': {
			const fields = getParamObject('updateFields');
			const changes: Record<string, unknown> = {};
			if (fields.name !== undefined && fields.name !== '') {
				changes.name = fields.name;
			}
			if (fields.brand_config_md5 !== undefined && String(fields.brand_config_md5).trim() !== '') {
				changes.brand_config_md5 = String(fields.brand_config_md5).trim();
			}
			if (Object.keys(changes).length === 0) {
				throw new ApplicationError('Add at least one field to update: Name or Brand Config MD5');
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/accounts/${getParam('accountId')}/shared_brand_configs/${sharedId}`,
				body: { shared_brand_config: changes },
			};
		}

		case 'unshare':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/shared_brand_configs/${sharedId}`,
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for brandConfig`);
	}
}
