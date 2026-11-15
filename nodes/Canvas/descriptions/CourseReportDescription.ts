import type { INodeProperties } from 'n8n-workflow';

export const courseReportOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['courseReport'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Start generating a course report',
				action: 'Create a course report',
			},
			{
				name: 'Get Last Status',
				value: 'getLastStatus',
				description: 'Get the status of the last report of a given type started by the current user',
				action: 'Get last report status',
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				description: 'Get the status of a specific report, with the download URL once it is complete',
				action: 'Get report status',
			},
		],
		default: 'create',
	},
];

export const courseReportFields: INodeProperties[] = [
	// ----------------------------------
	//         courseReport: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['courseReport'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Report Type',
		name: 'reportType',
		type: 'options',
		required: true,
		default: 'course_pace_docx',
		options: [
			{
				name: 'Course Pace (DOCX)',
				value: 'course_pace_docx',
				description:
					'Word documents with the course pace of the selected sections and student enrollments (a ZIP file when there are several)',
			},
		],
		displayOptions: {
			show: {
				resource: ['courseReport'],
			},
		},
		description:
			'The type of report. Canvas currently offers a single course-level report; account-level reports (grades, provisioning, ...) are in the Account Report resource.',
	},

	// ----------------------------------
	//         courseReport: getStatus
	// ----------------------------------
	{
		displayName: 'Report ID',
		name: 'reportId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['courseReport'],
				operation: ['getStatus'],
			},
		},
		description: 'The ID of the report. Only the user who started a report can read it.',
	},

	// ----------------------------------
	//         courseReport: create - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['courseReport'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Enrollment IDs',
				name: 'enrollment_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of student enrollment IDs to include in the report',
			},
			{
				displayName: 'Section IDs',
				name: 'section_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of section IDs to include in the report',
			},
		],
	},
];
