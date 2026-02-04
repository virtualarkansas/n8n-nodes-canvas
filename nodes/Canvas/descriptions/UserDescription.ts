import type { INodeProperties } from 'n8n-workflow';

export const userOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['user'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new user in an account',
				action: 'Create a user',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a user from the system',
				action: 'Delete a user',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single user by ID',
				action: 'Get a user',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many users from an account',
				action: 'Get many users',
			},
			{
				name: 'Get Self',
				value: 'getSelf',
				description: 'Get the currently authenticated user',
				action: 'Get current user',
			},
			{
				name: 'Merge',
				value: 'merge',
				description: 'Merge one user into another',
				action: 'Merge users',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an existing user',
				action: 'Update a user',
			},
		],
		default: 'getAll',
	},
];

export const userFields: INodeProperties[] = [
	// ----------------------------------
	//         user: getAll
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['getAll', 'create'],
			},
		},
		description: 'The ID of the account to list users from',
	},

	// ----------------------------------
	//         user: get
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the user (use "self" for current user)',
	},

	// ----------------------------------
	//         user: merge
	// ----------------------------------
	{
		displayName: 'Source User ID',
		name: 'sourceUserId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['merge'],
			},
		},
		description: 'The ID of the user to merge from (will be deleted)',
	},
	{
		displayName: 'Destination User ID',
		name: 'destinationUserId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['merge'],
			},
		},
		description: 'The ID of the user to merge into (will be preserved)',
	},

	// ----------------------------------
	//         user: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['create'],
			},
		},
		description: 'The full name of the user',
	},
	{
		displayName: 'Unique ID',
		name: 'uniqueId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['create'],
			},
		},
		description: 'The unique login identifier for the user (e.g., email address)',
	},

	// ----------------------------------
	//         user: getAll - Additional Fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Enrollment Type',
				name: 'enrollmentType',
				type: 'options',
				options: [
					{ name: 'Designer', value: 'designer' },
					{ name: 'Observer', value: 'observer' },
					{ name: 'Student', value: 'student' },
					{ name: 'TA', value: 'ta' },
					{ name: 'Teacher', value: 'teacher' },
				],
				default: 'student',
				description: 'Filter by enrollment type',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar URL', value: 'avatar_url' },
					{ name: 'Email', value: 'email' },
					{ name: 'Enrollments', value: 'enrollments' },
					{ name: 'Last Login', value: 'last_login' },
					{ name: 'Locale', value: 'locale' },
					{ name: 'UUID', value: 'uuid' },
				],
				default: [],
				description: 'Additional data to include in the response',
			},
			{
				displayName: 'Include Deleted Users',
				name: 'includeDeletedUsers',
				type: 'boolean',
				default: false,
				description: 'Whether to include deleted users in the results',
			},
			{
				displayName: 'Search Term',
				name: 'searchTerm',
				type: 'string',
				default: '',
				description: 'Filter by partial name or email match',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Created At', value: 'created_at' },
					{ name: 'Email', value: 'email' },
					{ name: 'Last Login', value: 'last_login' },
					{ name: 'SIS ID', value: 'sis_id' },
					{ name: 'Username', value: 'username' },
				],
				default: 'username',
				description: 'Field to sort by',
			},
			{
				displayName: 'Sort Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
			},
		],
	},

	// ----------------------------------
	//         user: get - Additional Fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['get', 'getSelf'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar URL', value: 'avatar_url' },
					{ name: 'Email', value: 'email' },
					{ name: 'Last Login', value: 'last_login' },
					{ name: 'Locale', value: 'locale' },
					{ name: 'UUID', value: 'uuid' },
				],
				default: [],
				description: 'Additional data to include in the response',
			},
		],
	},

	// ----------------------------------
	//         user: create - Additional Fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'The email address of the user',
			},
			{
				displayName: 'Force Self Registration',
				name: 'forceSelfRegistration',
				type: 'boolean',
				default: false,
				description: 'Whether to send the user a self-registration email',
			},
			{
				displayName: 'Locale',
				name: 'locale',
				type: 'string',
				default: '',
				description: 'The user\'s preferred language/locale (e.g., en, es, fr)',
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'User\'s initial password',
			},
			{
				displayName: 'Send Confirmation',
				name: 'sendConfirmation',
				type: 'boolean',
				default: true,
				description: 'Whether to send a confirmation email to the user',
			},
			{
				displayName: 'Short Name',
				name: 'shortName',
				type: 'string',
				default: '',
				description: 'User\'s display name (shown in discussions, etc.)',
			},
			{
				displayName: 'SIS User ID',
				name: 'sisUserId',
				type: 'string',
				default: '',
				description: 'SIS ID for the user',
			},
			{
				displayName: 'Sortable Name',
				name: 'sortableName',
				type: 'string',
				default: '',
				description: 'Name used for sorting (e.g., "Doe, John")',
			},
			{
				displayName: 'Terms of Use',
				name: 'termsOfUse',
				type: 'boolean',
				default: false,
				description: 'Whether the user has accepted terms of use',
			},
			{
				displayName: 'Time Zone',
				name: 'timeZone',
				type: 'string',
				default: '',
				description: 'User\'s time zone (e.g., America/Denver)',
			},
		],
	},

	// ----------------------------------
	//         user: update - Update Fields
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Avatar Token',
				name: 'avatarToken',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'Token from avatar options for setting user avatar',
			},
			{
				displayName: 'Avatar URL',
				name: 'avatarUrl',
				type: 'string',
				default: '',
				description: 'URL of an external avatar image',
			},
			{
				displayName: 'Bio',
				name: 'bio',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'User\'s biography/about text',
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'User\'s email address',
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{ name: 'Suspend', value: 'suspend' },
					{ name: 'Unsuspend', value: 'unsuspend' },
				],
				default: 'suspend',
				description: 'Suspend or unsuspend the user',
			},
			{
				displayName: 'Locale',
				name: 'locale',
				type: 'string',
				default: '',
				description: 'User\'s preferred language/locale (e.g., en, es, fr)',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'User\'s full name',
			},
			{
				displayName: 'Pronouns',
				name: 'pronouns',
				type: 'string',
				default: '',
				description: 'User\'s preferred pronouns',
			},
			{
				displayName: 'Short Name',
				name: 'shortName',
				type: 'string',
				default: '',
				description: 'User\'s display name',
			},
			{
				displayName: 'Sortable Name',
				name: 'sortableName',
				type: 'string',
				default: '',
				description: 'Name used for sorting (e.g., "Doe, John")',
			},
			{
				displayName: 'Time Zone',
				name: 'timeZone',
				type: 'string',
				default: '',
				description: 'User\'s time zone (e.g., America/Denver)',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'User\'s title (e.g., Dr., Professor)',
			},
		],
	},
];
