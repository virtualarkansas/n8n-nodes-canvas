import type { INodeProperties } from 'n8n-workflow';

export const loginOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['login'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new login for an existing user',
				action: 'Create a login',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a login credential',
				action: 'Delete a login',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many logins for a user or account',
				action: 'Get many logins',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an existing login',
				action: 'Update a login',
			},
		],
		default: 'getAll',
	},
];

export const loginFields: INodeProperties[] = [
	// ----------------------------------
	//         login: getAll
	// ----------------------------------
	{
		displayName: 'List By',
		name: 'listBy',
		type: 'options',
		required: true,
		options: [
			{ name: 'Account', value: 'account' },
			{ name: 'User', value: 'user' },
		],
		default: 'user',
		displayOptions: {
			show: {
				resource: ['login'],
				operation: ['getAll'],
			},
		},
		description: 'List logins by account or by user',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['login'],
				operation: ['getAll', 'create', 'update'],
				listBy: ['account'],
			},
		},
		description: 'The ID of the account',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['login'],
				operation: ['create', 'update'],
			},
			hide: {
				operation: ['getAll'],
			},
		},
		description: 'The ID of the account',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['login'],
				operation: ['getAll'],
				listBy: ['user'],
			},
		},
		description: 'The ID of the user (use "self" for current user)',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['login'],
				operation: ['delete'],
			},
		},
		description: 'The ID of the user whose login to delete',
	},

	// ----------------------------------
	//         login: create
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['login'],
				operation: ['create'],
			},
		},
		description: 'The ID of the user to create a login for',
	},
	{
		displayName: 'Unique ID',
		name: 'uniqueId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['login'],
				operation: ['create'],
			},
		},
		description: 'The unique identifier for the login (e.g., username or email)',
	},

	// ----------------------------------
	//         login: update, delete
	// ----------------------------------
	{
		displayName: 'Login ID',
		name: 'loginId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['login'],
				operation: ['update', 'delete'],
			},
		},
		description: 'The ID of the login to modify',
	},

	// ----------------------------------
	//         login: create - Additional Fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['login'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Authentication Provider ID',
				name: 'authenticationProviderId',
				type: 'string',
				default: '',
				description: 'The ID of the authentication provider for this login',
			},
			{
				displayName: 'Declared User Type',
				name: 'declaredUserType',
				type: 'options',
				options: [
					{ name: 'Admin', value: 'admin' },
					{ name: 'Observer', value: 'observer' },
					{ name: 'Staff', value: 'staff' },
					{ name: 'Student', value: 'student' },
					{ name: 'Student Other', value: 'student_other' },
					{ name: 'Teacher', value: 'teacher' },
				],
				default: 'student',
				description: 'The declared type of user for this login',
			},
			{
				displayName: 'Integration ID',
				name: 'integrationId',
				type: 'string',
				default: '',
				description: 'Integration ID for third-party systems',
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'The password for this login',
			},
			{
				displayName: 'SIS User ID',
				name: 'sisUserId',
				type: 'string',
				default: '',
				description: 'SIS ID for the login',
			},
		],
	},

	// ----------------------------------
	//         login: update - Update Fields
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['login'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Authentication Provider ID',
				name: 'authenticationProviderId',
				type: 'string',
				default: '',
				description: 'The ID of the authentication provider for this login',
			},
			{
				displayName: 'Declared User Type',
				name: 'declaredUserType',
				type: 'options',
				options: [
					{ name: 'Admin', value: 'admin' },
					{ name: 'Observer', value: 'observer' },
					{ name: 'Staff', value: 'staff' },
					{ name: 'Student', value: 'student' },
					{ name: 'Student Other', value: 'student_other' },
					{ name: 'Teacher', value: 'teacher' },
				],
				default: 'student',
				description: 'The declared type of user for this login',
			},
			{
				displayName: 'Integration ID',
				name: 'integrationId',
				type: 'string',
				default: '',
				description: 'Integration ID for third-party systems',
			},
			{
				displayName: 'Old Password',
				name: 'oldPassword',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'Current password (required when changing password for self)',
			},
			{
				displayName: 'Override SIS Stickiness',
				name: 'overrideSisStickiness',
				type: 'boolean',
				default: false,
				description: 'Whether to override SIS stickiness when updating SIS-managed logins',
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'New password for this login',
			},
			{
				displayName: 'SIS User ID',
				name: 'sisUserId',
				type: 'string',
				default: '',
				description: 'SIS ID for the login',
			},
			{
				displayName: 'Unique ID',
				name: 'uniqueId',
				type: 'string',
				default: '',
				description: 'New unique identifier for the login',
			},
			{
				displayName: 'Workflow State',
				name: 'workflowState',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Suspended', value: 'suspended' },
				],
				default: 'active',
				description: 'The workflow state of the login',
			},
		],
	},
];
