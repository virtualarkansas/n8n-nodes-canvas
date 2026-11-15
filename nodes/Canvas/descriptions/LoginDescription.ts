import type { INodeProperties } from 'n8n-workflow';

const declaredUserType: INodeProperties = {
	displayName: 'Declared User Type',
	name: 'declaredUserType',
	type: 'options',
	options: [
		{ name: 'Administrative', value: 'administrative' },
		{ name: 'Observer', value: 'observer' },
		{ name: 'Staff', value: 'staff' },
		{ name: 'Student', value: 'student' },
		{ name: 'Student Other', value: 'student_other' },
		{ name: 'Teacher', value: 'teacher' },
	],
	default: 'student',
	description:
		'The declared intention for this login. Informational only: it does not change what the user may do in Canvas.',
};

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
				description: 'Get the logins of a user, optionally limited to one root account',
				action: 'Get many logins',
			},
			{
				name: 'Reset Password',
				value: 'resetPassword',
				description: 'Send the password recovery email to the user with a given email address',
				action: 'Start password recovery for a login',
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
			{
				name: 'Account',
				value: 'account',
				description: 'The logins of a user in one root account',
			},
			{
				name: 'User',
				value: 'user',
				description: 'All logins of a user',
			},
		],
		default: 'user',
		displayOptions: {
			show: {
				resource: ['login'],
				operation: ['getAll'],
			},
		},
		description: 'Whether to list all logins of the user or only those in one root account',
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
				operation: ['getAll'],
				listBy: ['account'],
			},
		},
		description: 'The ID of the root account (sub-accounts are refused by Canvas)',
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
			},
		},
		description: 'The ID of the user whose logins to list (use "self" for the current user)',
	},

	// ----------------------------------
	//         login: create, update
	// ----------------------------------
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
		},
		description: 'The ID of the root account the login belongs to',
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
	//         login: delete
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
				operation: ['delete'],
			},
		},
		description: 'The ID of the user whose login to delete. A user must keep at least one login.',
	},
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
	//         login: resetPassword
	// ----------------------------------
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['login'],
				operation: ['resetPassword'],
			},
		},
		description:
			'The email address or login ID of the user. Canvas emails the password reset link to them; an unknown address is answered with "not found".',
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
				description:
					'The authentication provider this login is used with: its ID or its type (e.g. "canvas", "saml")',
			},
			declaredUserType,
			{
				displayName: 'Integration ID',
				name: 'integrationId',
				type: 'string',
				default: '',
				description: 'Integration ID for third-party systems (requires the "manage SIS" permission)',
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'The password for this login. Canvas generates a temporary one when left out.',
			},
			{
				displayName: 'SIS User ID',
				name: 'sisUserId',
				type: 'string',
				default: '',
				description: 'SIS ID for the login (requires the "manage SIS" permission)',
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
				description:
					'The authentication provider this login is used with: its ID or its type (e.g. "canvas", "saml"). Leave empty to detach the login from its provider.',
			},
			declaredUserType,
			{
				displayName: 'Integration ID',
				name: 'integrationId',
				type: 'string',
				default: '',
				description: 'Integration ID for third-party systems. Leave empty to clear it.',
			},
			{
				displayName: 'Old Password',
				name: 'oldPassword',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'Current password (required when changing the password of your own login)',
			},
			{
				displayName: 'Override SIS Stickiness',
				name: 'overrideSisStickiness',
				type: 'boolean',
				default: true,
				description:
					'Whether to change fields that an SIS import may later overwrite (Canvas default: true). When turned off, fields marked as changed in Canvas ("sticky") are left alone.',
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description:
					'New password for this login. Admins can only set the password of another user when "Password setting by admins" is enabled on the account.',
			},
			{
				displayName: 'SIS User ID',
				name: 'sisUserId',
				type: 'string',
				default: '',
				description: 'SIS ID for the login. Leave empty to clear it.',
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
				description: 'Suspend or re-activate the login',
			},
		],
	},
];
