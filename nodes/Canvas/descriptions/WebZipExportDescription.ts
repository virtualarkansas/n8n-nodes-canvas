import type { INodeProperties } from 'n8n-workflow';

export const webZipExportOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['webZipExport'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get an offline (web zip) export of a course',
				action: 'Get a web zip export',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many offline (web zip) exports the current user started in a course',
				action: 'Get many web zip exports',
			},
		],
		default: 'getAll',
	},
];

export const webZipExportFields: INodeProperties[] = [
	{
		displayName:
			'Offline exports are the "Export Course Content" downloads of the Modules page. Canvas has no API to start one; these operations report the exports the user of the token started, with the file ("zip_attachment") once an export is finished. The account and the course need "Offline Course Export" to be enabled, otherwise Canvas answers "not found".',
		name: 'webZipExportNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['webZipExport'],
			},
		},
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['webZipExport'],
			},
		},
		description: 'The ID of the course. Also accepts SIS IDs in the form "sis_course_id:XYZ".',
	},
	{
		displayName: 'Web Zip Export ID',
		name: 'webZipExportId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['webZipExport'],
				operation: ['get'],
			},
		},
		description: 'The ID of the offline export',
	},
];
