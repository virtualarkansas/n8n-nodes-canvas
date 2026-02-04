import type { INodeProperties } from 'n8n-workflow';

export const accountReportOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['accountReport'],
			},
		},
		options: [
			{
				name: 'Abort',
				value: 'abort',
				description: 'Abort a running report',
				action: 'Abort a report',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Start a new report',
				action: 'Create a report',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a report',
				action: 'Delete a report',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the status of a report',
				action: 'Get a report',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many reports of a specific type',
				action: 'Get many reports',
			},
			{
				name: 'List Available',
				value: 'listAvailable',
				description: 'List available report types',
				action: 'List available reports',
			},
		],
		default: 'listAvailable',
	},
];

export const accountReportFields: INodeProperties[] = [
	// ----------------------------------
	//         accountReport: shared
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accountReport'],
				operation: ['listAvailable', 'create', 'get', 'getAll', 'delete', 'abort'],
			},
		},
		description: 'The ID of the account',
	},

	// ----------------------------------
	//         accountReport: create, get, getAll, delete, abort
	// ----------------------------------
	{
		displayName: 'Report Type',
		name: 'reportType',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accountReport'],
				operation: ['create', 'get', 'getAll', 'delete', 'abort'],
			},
		},
		description: 'The type of report (e.g., "student_assignment_data_csv", "grade_export_csv", "sis_export_csv")',
	},

	// ----------------------------------
	//         accountReport: get, delete, abort
	// ----------------------------------
	{
		displayName: 'Report ID',
		name: 'reportId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accountReport'],
				operation: ['get', 'delete', 'abort'],
			},
		},
		description: 'The ID of the report',
	},

	// ----------------------------------
	//         accountReport: listAvailable
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['accountReport'],
				operation: ['listAvailable'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Description HTML', value: 'description_html' },
					{ name: 'Params HTML', value: 'params_html' },
				],
				default: [],
				description: 'Additional information to include with each report type',
			},
		],
	},

	// ----------------------------------
	//         accountReport: create
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['accountReport'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Course ID',
				name: 'course_id',
				type: 'string',
				default: '',
				description: 'Limit the report to a specific course',
			},
			{
				displayName: 'End At',
				name: 'end_at',
				type: 'dateTime',
				default: '',
				description: 'End date for the report data',
			},
			{
				displayName: 'Enrollment State',
				name: 'enrollment_state',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'All', value: 'all' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Invited', value: 'invited' },
				],
				default: 'all',
				description: 'Filter by enrollment state',
			},
			{
				displayName: 'Enrollment Term ID',
				name: 'enrollment_term_id',
				type: 'string',
				default: '',
				description: 'Limit the report to a specific enrollment term',
			},
			{
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: false,
				description: 'Whether to include deleted objects in the report',
			},
			{
				displayName: 'Include Users',
				name: 'users',
				type: 'boolean',
				default: false,
				description: 'Whether to include user data in the report',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
				description: 'Sort order for the report data',
			},
			{
				displayName: 'Skip Message',
				name: 'skip_message',
				type: 'boolean',
				default: false,
				description: 'Whether to suppress the completion notification',
			},
			{
				displayName: 'Start At',
				name: 'start_at',
				type: 'dateTime',
				default: '',
				description: 'Start date for the report data',
			},
		],
	},
];
