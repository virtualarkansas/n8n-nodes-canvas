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
				description: 'Create a new course report',
				action: 'Create a course report',
			},
			{
				name: 'Get Last Status',
				value: 'getLastStatus',
				description: 'Get the status of the last report of a given type',
				action: 'Get last report status',
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				description: 'Get the status of a specific report',
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
		default: 'student_assignment_data_csv',
		options: [
			{
				name: 'Grade Export',
				value: 'grade_export_csv',
				description: 'Export grades for all students',
			},
			{
				name: 'LTI Report',
				value: 'lti_report_csv',
				description: 'Export LTI integration data',
			},
			{
				name: 'Outcome Export',
				value: 'outcome_export_csv',
				description: 'Export learning outcome results',
			},
			{
				name: 'Outcome Results',
				value: 'outcome_results_csv',
				description: 'Export detailed outcome results',
			},
			{
				name: 'Provisioning',
				value: 'provisioning_csv',
				description: 'Export provisioning data',
			},
			{
				name: 'Quiz Student Analysis',
				value: 'quiz_student_analysis_csv',
				description: 'Export quiz analysis per student',
			},
			{
				name: 'SIS Export',
				value: 'sis_export_csv',
				description: 'Export SIS-compatible data',
			},
			{
				name: 'Student Assignment Data',
				value: 'student_assignment_data_csv',
				description: 'Export student assignment submission data',
			},
			{
				name: 'Student Competency',
				value: 'student_competency_csv',
				description: 'Export student competency ratings',
			},
			{
				name: 'Students with No Submissions',
				value: 'students_with_no_submissions_csv',
				description: 'List students who have not submitted any work',
			},
			{
				name: 'Unpublished Changes',
				value: 'unpublished_changes_csv',
				description: 'Export list of unpublished content changes',
			},
			{
				name: 'User Access Tokens',
				value: 'user_access_tokens_csv',
				description: 'Export user access token information',
			},
			{
				name: 'Zero Activity',
				value: 'zero_activity_csv',
				description: 'List students with zero activity',
			},
		],
		displayOptions: {
			show: {
				resource: ['courseReport'],
			},
		},
		description: 'The type of report to generate',
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
		description: 'The ID of the report',
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
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: false,
				description: 'Whether to include deleted objects in the report',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Alphabetical', value: 'alphabetical' },
					{ name: 'Created At', value: 'created_at' },
					{ name: 'SIS ID', value: 'sis_id' },
				],
				default: 'created_at',
				description: 'The order to sort the report results',
			},
			{
				displayName: 'Section IDs',
				name: 'section_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of section IDs to filter the report by',
			},
			{
				displayName: 'Skip Message',
				name: 'skip_message',
				type: 'boolean',
				default: false,
				description: 'Whether to suppress the completion notification message',
			},
		],
	},
];
