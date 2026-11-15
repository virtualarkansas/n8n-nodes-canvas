import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam } from '../types/Canvas.types';

// ============================================
// Web Zip Export (offline course exports)
// ============================================

export function buildWebZipExportRequest(operation: string, getParam: GetParam): IRequestConfig {
	const basePath = `/api/v1/courses/${getParam('courseId')}/web_zip_exports`;

	switch (operation) {
		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/${getParam('webZipExportId')}`,
			};
		case 'getAll':
			return {
				method: 'GET',
				endpoint: basePath,
			};
		default:
			throw new ApplicationError(`Operation ${operation} not implemented for webZipExport`);
	}
}
