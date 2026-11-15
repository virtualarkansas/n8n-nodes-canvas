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
				description: 'Abort a report that has not finished yet',
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
				description: 'Get the status of a report, including the download URL once it is complete',
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
				description: 'List available report types with their parameters and last run',
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
		placeholder: 'provisioning_csv',
		displayOptions: {
			show: {
				resource: ['accountReport'],
				operation: ['create', 'get', 'getAll', 'delete', 'abort'],
			},
		},
		description:
			'The report name as returned in the "report" property of List Available (e.g. "provisioning_csv", "grade_export_csv", "sis_export_csv", "last_user_access_csv")',
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
					{ name: 'Parameters HTML', value: 'parameters_html' },
				],
				default: [],
				description:
					'Additional information to include with each report type: an HTML description with example output, and the HTML form Canvas shows for the report parameters',
			},
		],
	},

	// ----------------------------------
	//         accountReport: create
	// ----------------------------------
	{
		displayName: 'Report Parameters',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Parameter',
		default: {},
		displayOptions: {
			show: {
				resource: ['accountReport'],
				operation: ['create'],
			},
		},
		description:
			'Parameters differ per report; List Available shows which ones a report accepts. Parameters a report does not know are ignored by Canvas.',
		options: [
			{
				displayName: 'Accounts',
				name: 'accounts',
				type: 'boolean',
				default: true,
				description: 'Whether to include the accounts file (provisioning and SIS export reports)',
			},
			{
				displayName: 'Admins',
				name: 'admins',
				type: 'boolean',
				default: true,
				description: 'Whether to include the admins file (provisioning and SIS export reports)',
			},
			{
				displayName: 'Course ID',
				name: 'course_id',
				type: 'string',
				default: '',
				description: 'Limit the report to a specific course',
			},
			{
				displayName: 'Courses',
				name: 'courses',
				type: 'boolean',
				default: true,
				description: 'Whether to include the courses file (provisioning and SIS export reports)',
			},
			{
				displayName: 'Created by SIS',
				name: 'created_by_sis',
				type: 'boolean',
				default: true,
				description: 'Whether to only include objects that were created by a SIS import',
			},
			{
				displayName: 'Cross-Listings',
				name: 'xlist',
				type: 'boolean',
				default: true,
				description:
					'Whether to include the cross-listed sections file (provisioning and SIS export reports)',
			},
			{
				displayName: 'End At',
				name: 'end_at',
				type: 'dateTime',
				default: '',
				description: 'End date for the report data (e.g. submissions before this date)',
			},
			{
				displayName: 'Enrollment Filter',
				name: 'enrollment_filter',
				type: 'multiOptions',
				options: [
					{ name: 'Designer', value: 'DesignerEnrollment' },
					{ name: 'Observer', value: 'ObserverEnrollment' },
					{ name: 'Student', value: 'StudentEnrollment' },
					{ name: 'TA', value: 'TaEnrollment' },
					{ name: 'Teacher', value: 'TeacherEnrollment' },
				],
				default: [],
				description: 'Only include enrollments of these types (provisioning report)',
			},
			{
				displayName: 'Enrollment State',
				name: 'enrollment_state',
				type: 'multiOptions',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'All', value: 'all' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Creation Pending', value: 'creation_pending' },
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Invited', value: 'invited' },
					{ name: 'Rejected', value: 'rejected' },
				],
				default: [],
				description:
					'Enrollment states to include (Students With No Submissions report). Defaults to all.',
			},
			{
				displayName: 'Enrollment States',
				name: 'enrollment_states',
				type: 'multiOptions',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Creation Pending', value: 'creation_pending' },
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Invited', value: 'invited' },
					{ name: 'Rejected', value: 'rejected' },
				],
				default: [],
				description: 'Only include enrollments in these states (provisioning report)',
			},
			{
				displayName: 'Enrollment Term ID',
				name: 'enrollment_term_id',
				type: 'string',
				default: '',
				description:
					'Limit the report to an enrollment term. Accepts SIS IDs in the form "sis_term_id:XYZ". An unknown term is rejected.',
			},
			{
				displayName: 'Enrollments',
				name: 'enrollments',
				type: 'boolean',
				default: true,
				description: 'Whether to include the enrollments file (provisioning and SIS export reports)',
			},
			{
				displayName: 'Exclude Deleted and Expired',
				name: 'exclude_deleted_and_expired',
				type: 'boolean',
				default: true,
				description: 'Whether to leave out deleted and expired access tokens (User Access Tokens report)',
			},
			{
				displayName: 'Group Categories',
				name: 'group_categories',
				type: 'boolean',
				default: true,
				description:
					'Whether to include the group categories file (provisioning and SIS export reports)',
			},
			{
				displayName: 'Group Memberships',
				name: 'group_membership',
				type: 'boolean',
				default: true,
				description:
					'Whether to include the group memberships file (provisioning and SIS export reports)',
			},
			{
				displayName: 'Groups',
				name: 'groups',
				type: 'boolean',
				default: true,
				description: 'Whether to include the groups file (provisioning and SIS export reports)',
			},
			{
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: true,
				description: 'Whether to include deleted objects in the report',
			},
			{
				displayName: 'Include Enrollment State',
				name: 'include_enrollment_state',
				type: 'boolean',
				default: true,
				description:
					'Whether to add the enrollment state as a column (Students With No Submissions report)',
			},
			{
				displayName: 'No Enrollments',
				name: 'no_enrollments',
				type: 'boolean',
				default: true,
				description:
					'Whether to only include ePortfolios of users without enrollments (ePortfolio report)',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Courses', value: 'courses' },
					{ name: 'Outcomes', value: 'outcomes' },
					{ name: 'Users', value: 'users' },
				],
				default: 'users',
				description: 'What to sort the rows by (Outcome Results report)',
			},
			{
				displayName: 'Other Parameters (JSON)',
				name: 'extra_parameters',
				type: 'json',
				default: '{}',
				description:
					'Any other report parameters as a JSON object, for reports that take parameters not listed here (e.g. reports added by plugins)',
			},
			{
				displayName: 'Sections',
				name: 'sections',
				type: 'boolean',
				default: true,
				description: 'Whether to include the sections file (provisioning and SIS export reports)',
			},
			{
				displayName: 'Skip Message',
				name: 'skip_message',
				type: 'boolean',
				default: true,
				description:
					'Whether to skip the Canvas inbox message that is otherwise sent to you when the report is ready',
			},
			{
				displayName: 'Start At',
				name: 'start_at',
				type: 'dateTime',
				default: '',
				description: 'Start date for the report data (e.g. submissions after this date)',
			},
			{
				displayName: 'Terms',
				name: 'terms',
				type: 'boolean',
				default: true,
				description: 'Whether to include the terms file (provisioning and SIS export reports)',
			},
			{
				displayName: 'User Observers',
				name: 'user_observers',
				type: 'boolean',
				default: true,
				description:
					'Whether to include the observer links file (provisioning and SIS export reports)',
			},
			{
				displayName: 'Users',
				name: 'users',
				type: 'boolean',
				default: true,
				description: 'Whether to include the users file (provisioning and SIS export reports)',
			},
		],
	},
];
