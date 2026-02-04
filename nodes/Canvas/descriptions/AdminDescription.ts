import type { INodeProperties } from 'n8n-workflow';

export const adminOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['admin'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Make a user an admin for an account',
				action: 'Create an admin',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Remove admin rights from a user',
				action: 'Delete an admin',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many account admins',
				action: 'Get many admins',
			},
		],
		default: 'getAll',
	},
];

export const adminFields: INodeProperties[] = [
	// ----------------------------------
	//         admin: shared
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['admin'],
				operation: ['create', 'delete', 'getAll'],
			},
		},
		description: 'The ID of the account',
	},

	// ----------------------------------
	//         admin: create
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['admin'],
				operation: ['create'],
			},
		},
		description: 'The ID of the user to promote to admin',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['admin'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Role ID',
				name: 'role_id',
				type: 'string',
				default: '',
				description: 'The ID of the role to assign (defaults to AccountAdmin)',
			},
			{
				displayName: 'Send Confirmation',
				name: 'send_confirmation',
				type: 'boolean',
				default: true,
				description: 'Whether to send a notification email to the new admin',
			},
		],
	},

	// ----------------------------------
	//         admin: delete
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['admin'],
				operation: ['delete'],
			},
		},
		description: 'The ID of the user to remove admin rights from',
	},
	{
		displayName: 'Role ID',
		name: 'roleId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['admin'],
				operation: ['delete'],
			},
		},
		description: 'The ID of the admin role to remove',
	},

	// ----------------------------------
	//         admin: getAll
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['admin'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: false,
				description: 'Whether to include deleted admins in the results',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Search by partial name or full ID (minimum 2 characters)',
			},
			{
				displayName: 'User IDs',
				name: 'user_id',
				type: 'string',
				default: '',
				description: 'Comma-separated list of user IDs to filter by',
			},
		],
	},
];
