import type { INodeProperties } from 'n8n-workflow';

const accountIncludeOptions = [
	{ name: 'Course Count', value: 'course_count' },
	{ name: 'LTI GUID', value: 'lti_guid' },
	{ name: 'Registration Settings', value: 'registration_settings' },
	{ name: 'Services', value: 'services' },
	{ name: 'Sub-Account Count', value: 'sub_account_count' },
];

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['account'],
			},
		},
		options: [
			{
				name: 'Create Sub-Account',
				value: 'createSubAccount',
				description: 'Create a new sub-account under a parent account',
				action: 'Create a sub account',
			},
			{
				name: 'Delete Sub-Account',
				value: 'deleteSubAccount',
				description: 'Delete a sub-account that has no courses and no sub-accounts',
				action: 'Delete a sub account',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single account',
				action: 'Get an account',
			},
			{
				name: 'Get Courses',
				value: 'getCourses',
				description: 'List the courses of an account and its sub-accounts, with filters',
				action: 'Get courses of an account',
			},
			{
				name: 'Get Help Links',
				value: 'getHelpLinks',
				description: 'Get the help menu links of an account',
				action: 'Get help links of an account',
			},
			{
				name: 'Get Manually Created Courses Account',
				value: 'getManuallyCreatedCoursesAccount',
				description:
					'Get the sub-account of the root account in which Canvas puts the courses users create themselves ("Manually-Created Courses")',
				action: 'Get the manually created courses account',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the accounts the current user can see, manage or create courses in',
				action: 'Get many accounts',
			},
			{
				name: 'Get Permissions',
				value: 'getPermissions',
				description: 'Check which permissions the current user has in an account',
				action: 'Get permissions in an account',
			},
			{
				name: 'Get Settings',
				value: 'getSettings',
				description: 'Get the settings of an account that are exposed through the API',
				action: 'Get settings of an account',
			},
			{
				name: 'Get Sub-Accounts',
				value: 'getSubAccounts',
				description: 'Get sub-accounts of an account',
				action: 'Get sub accounts',
			},
			{
				name: 'Get Terms of Service',
				value: 'getTermsOfService',
				description: 'Get the terms of service of an account',
				action: 'Get terms of service of an account',
			},
			{
				name: 'Restore User',
				value: 'restoreUser',
				description: 'Restore a user that was deleted from a root account',
				action: 'Restore a deleted user',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an account',
				action: 'Update an account',
			},
		],
		default: 'getAll',
	},
];

export const accountFields: INodeProperties[] = [
	// ----------------------------------
	//         account: shared
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['account'],
				operation: [
					'createSubAccount',
					'deleteSubAccount',
					'get',
					'getCourses',
					'getHelpLinks',
					'getPermissions',
					'getSettings',
					'getSubAccounts',
					'getTermsOfService',
					'restoreUser',
					'update',
				],
			},
		},
		description:
			'The ID of the account. Also accepts "self" (the root account of the Canvas URL) and SIS IDs in the form "sis_account_id:XYZ". For Create/Delete Sub-Account this is the parent account.',
	},

	// ----------------------------------
	//         account: get
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'includes',
				type: 'multiOptions',
				options: accountIncludeOptions,
				default: [],
				description: 'Additional information to include with the account',
			},
		],
	},

	// ----------------------------------
	//         account: getAll
	// ----------------------------------
	{
		displayName: 'Accounts to List',
		name: 'accountScope',
		type: 'options',
		options: [
			{
				name: 'Accounts I Can Create Courses In',
				value: 'courseCreation',
				description: 'Accounts where the current user is allowed to create courses',
			},
			{
				name: 'Accounts I Can Manage Courses In',
				value: 'manageable',
				description:
					'Accounts (and all their sub-accounts) where the current user is an admin who can create or manage courses',
			},
			{
				name: 'Accounts I Can See',
				value: 'all',
				description: 'Accounts the current user is an admin of. Empty for teachers and students.',
			},
			{
				name: 'Accounts of Courses I Teach',
				value: 'courseAdmin',
				description:
					'Accounts the current user can see through teacher, TA or designer enrollments (ID, name and state only)',
			},
		],
		default: 'all',
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['getAll'],
			},
		},
		description: 'Which list of accounts to return',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['getAll'],
				accountScope: ['all'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: accountIncludeOptions,
				default: [],
				description: 'Additional information to include with each account',
			},
		],
	},

	// ----------------------------------
	//         account: getSubAccounts
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['getSubAccounts'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Course Count', value: 'course_count' },
					{ name: 'Sub-Account Count', value: 'sub_account_count' },
				],
				default: [],
				description: 'Additional information to include with each sub-account',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'ID', value: 'id' },
					{ name: 'Name', value: 'name' },
				],
				default: 'id',
				description: 'Sort sub-accounts by this field. Ignored when Recursive is on.',
			},
			{
				displayName: 'Recursive',
				name: 'recursive',
				type: 'boolean',
				default: false,
				description: 'Whether to retrieve the entire account tree instead of just direct children',
			},
		],
	},

	// ----------------------------------
	//         account: getCourses
	// ----------------------------------
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['getCourses'],
			},
		},
		options: [
			{
				displayName: 'Blueprint',
				name: 'blueprint',
				type: 'boolean',
				default: true,
				description:
					'Whether to return only blueprint courses (on) or only courses that are not blueprints (off)',
			},
			{
				displayName: 'Blueprint Associated',
				name: 'blueprint_associated',
				type: 'boolean',
				default: true,
				description:
					'Whether to return only courses that inherit content from a blueprint course (on) or only courses that do not (off)',
			},
			{
				displayName: 'Completed',
				name: 'completed',
				type: 'boolean',
				default: true,
				description:
					'Whether to return only concluded courses, including courses whose term has ended (on), or only courses that are not concluded (off)',
			},
			{
				displayName: 'Ends After',
				name: 'ends_after',
				type: 'dateTime',
				default: '',
				description:
					'Only return courses that end (or whose term ends) on or after this date, and courses without any end date',
			},
			{
				displayName: 'Enrollment State',
				name: 'enrollment_workflow_state',
				type: 'multiOptions',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Creation Pending', value: 'creation_pending' },
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Invited', value: 'invited' },
					{ name: 'Pending', value: 'pending' },
					{ name: 'Rejected', value: 'rejected' },
				],
				default: [],
				description:
					'Only return courses that have at least one enrollment in one of these states. Canvas does not accept "inactive" here.',
			},
			{
				displayName: 'Enrollment Term ID',
				name: 'enrollment_term_id',
				type: 'string',
				default: '',
				description: 'Only return courses of this term. Accepts SIS IDs in the form "sis_term_id:XYZ".',
			},
			{
				displayName: 'Enrollment Type',
				name: 'enrollment_type',
				type: 'multiOptions',
				options: [
					{ name: 'Designer', value: 'designer' },
					{ name: 'Observer', value: 'observer' },
					{ name: 'Student', value: 'student' },
					{ name: 'TA', value: 'ta' },
					{ name: 'Teacher', value: 'teacher' },
				],
				default: [],
				description: 'Only return courses that have at least one user enrolled with one of these types',
			},
			{
				displayName: 'Homeroom',
				name: 'homeroom',
				type: 'boolean',
				default: true,
				description: 'Whether to return only homeroom courses (Canvas for Elementary)',
			},
			{
				displayName: 'Public',
				name: 'public',
				type: 'boolean',
				default: true,
				description:
					'Whether to return only public courses (on) or only courses whose public option was explicitly switched off (off). Courses that were never made public are in neither list.',
			},
			{
				displayName: 'Published',
				name: 'published',
				type: 'boolean',
				default: true,
				description:
					'Whether to return only published courses (on) or only courses that are not published (off)',
			},
			{
				displayName: 'Search By',
				name: 'search_by',
				type: 'options',
				options: [
					{
						name: 'Course',
						value: 'course',
						description: 'Match course names, course codes and SIS IDs',
					},
					{ name: 'Teacher', value: 'teacher', description: 'Match the names of teachers' },
				],
				default: 'course',
				description: 'What the search term is matched against',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Partial course name, course code or full ID to match (at least 2 characters)',
			},
			{
				displayName: 'Starts Before',
				name: 'starts_before',
				type: 'dateTime',
				default: '',
				description:
					'Only return courses that start (or whose term starts) on or before this date, and courses without any start date',
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'multiOptions',
				options: [
					{ name: 'All (Including Deleted)', value: 'all' },
					{ name: 'Available (Published)', value: 'available' },
					{ name: 'Claimed (Unpublished)', value: 'claimed' },
					{ name: 'Completed (Concluded)', value: 'completed' },
					{ name: 'Created (Unpublished)', value: 'created' },
					{ name: 'Deleted', value: 'deleted' },
				],
				default: [],
				description:
					'Only return courses in these states. By default every state except deleted is returned.',
			},
			{
				displayName: 'Sub-Account IDs',
				name: 'by_subaccounts',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of sub-account IDs. Only courses in one of these sub-accounts are returned.',
			},
			{
				displayName: 'Teacher User IDs',
				name: 'by_teachers',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of user IDs. Only courses taught by one of these users are returned.',
			},
			{
				displayName: 'With Enrollments',
				name: 'with_enrollments',
				type: 'boolean',
				default: true,
				description:
					'Whether to return only courses with at least one enrollment (on) or only courses without any enrollment (off)',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['getCourses'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Account Name', value: 'account_name' },
					{ name: 'Concluded', value: 'concluded' },
					{ name: 'Course Progress', value: 'course_progress' },
					{ name: 'Post Manually', value: 'post_manually' },
					{ name: 'Storage Quota Used (MB)', value: 'storage_quota_used_mb' },
					{ name: 'Syllabus Body', value: 'syllabus_body' },
					{ name: 'Teachers', value: 'teachers' },
					{ name: 'Term', value: 'term' },
					{ name: 'Total Students', value: 'total_students' },
				],
				default: [],
				description: 'Additional information to include with each course',
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
				description: 'Sort direction. Only applies together with Sort.',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Account Name', value: 'account_name' },
					{ name: 'Course Name', value: 'course_name' },
					{ name: 'Course Status', value: 'course_status' },
					{ name: 'SIS Course ID', value: 'sis_course_id' },
					{ name: 'Teacher', value: 'teacher' },
					{ name: 'Term', value: 'term' },
				],
				default: 'course_name',
				description: 'The column to sort the courses by. Without it, courses are sorted by ID.',
			},
		],
	},

	// ----------------------------------
	//         account: getPermissions
	// ----------------------------------
	{
		displayName: 'Permissions',
		name: 'permissions',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'manage_account_settings,become_user',
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['getPermissions'],
			},
		},
		description:
			'Comma-separated list of permission names to check for the current user (e.g. "manage_sis,read_reports"). The result has one true/false property per permission.',
	},

	// ----------------------------------
	//         account: deleteSubAccount
	// ----------------------------------
	{
		displayName: 'Sub-Account ID',
		name: 'subAccountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['deleteSubAccount'],
			},
		},
		description:
			'The numeric ID of the sub-account to delete. It must not contain courses or sub-accounts.',
	},

	// ----------------------------------
	//         account: restoreUser
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['restoreUser'],
			},
		},
		description: 'The ID of the deleted user to restore. The account must be a root account.',
	},

	// ----------------------------------
	//         account: createSubAccount
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['createSubAccount'],
			},
		},
		description: 'The name of the sub-account',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['createSubAccount'],
			},
		},
		options: [
			{
				displayName: 'Default Group Storage Quota (MB)',
				name: 'default_group_storage_quota_mb',
				type: 'number',
				default: 50,
				description: 'The default group storage quota in megabytes',
			},
			{
				displayName: 'Default Storage Quota (MB)',
				name: 'default_storage_quota_mb',
				type: 'number',
				default: 500,
				description: 'The default course storage quota in megabytes',
			},
			{
				displayName: 'Default User Storage Quota (MB)',
				name: 'default_user_storage_quota_mb',
				type: 'number',
				default: 50,
				description: 'The default user storage quota in megabytes',
			},
			{
				displayName: 'SIS Account ID',
				name: 'sis_account_id',
				type: 'string',
				default: '',
				description: 'The SIS identifier for the sub-account',
			},
		],
	},

	// ----------------------------------
	//         account: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Course Template ID',
				name: 'course_template_id',
				type: 'string',
				default: '',
				description:
					'The ID of a course marked as a template, used for new courses in this account. Use 0 for "no template"; leave empty to inherit from the parent account.',
			},
			{
				displayName: 'Default Group Storage Quota (MB)',
				name: 'default_group_storage_quota_mb',
				type: 'number',
				default: 50,
				description: 'The default group storage quota in megabytes',
			},
			{
				displayName: 'Default Storage Quota (MB)',
				name: 'default_storage_quota_mb',
				type: 'number',
				default: 500,
				description: 'The default course storage quota in megabytes',
			},
			{
				displayName: 'Default Time Zone',
				name: 'default_time_zone',
				type: 'string',
				default: '',
				description:
					'The default time zone for the account (IANA or Rails format, e.g., "America/New_York")',
			},
			{
				displayName: 'Default User Storage Quota (MB)',
				name: 'default_user_storage_quota_mb',
				type: 'number',
				default: 50,
				description: 'The default user storage quota in megabytes',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The display name of the account',
			},
			{
				displayName: 'Parent Account ID',
				name: 'parent_account_id',
				type: 'string',
				default: '',
				description: 'The ID of the parent account to move this sub-account under',
			},
			{
				displayName: 'Services (JSON)',
				name: 'services',
				type: 'json',
				default: '{}',
				description:
					'Services to switch on or off, as a JSON object of service name to true/false (e.g. {"avatars": true}). Use Get with Include: Services to see the names.',
			},
			{
				displayName: 'Settings (JSON)',
				name: 'settings',
				type: 'json',
				default: '{}',
				description:
					'Account settings as a JSON object, e.g. {"restrict_student_past_view": {"value": true, "locked": false}}. Canvas accepts restrict_student_past_view, restrict_student_future_view, restrict_student_future_listing, restrict_quantitative_data, lock_all_announcements, conditional_release, enable_course_paces, sis_assignment_name_length_input, suppress_notifications and password_policy.',
			},
			{
				displayName: 'SIS Account ID',
				name: 'sis_account_id',
				type: 'string',
				default: '',
				description:
					'The SIS identifier for the account (sub-accounts only; requires the Manage SIS permission)',
			},
		],
	},
];
