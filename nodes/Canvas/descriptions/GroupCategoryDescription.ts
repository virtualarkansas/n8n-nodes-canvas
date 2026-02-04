import type { INodeProperties } from 'n8n-workflow';

export const groupCategoryOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['groupCategory'],
			},
		},
		options: [
			{
				name: 'Assign Unassigned Members',
				value: 'assignUnassignedMembers',
				description: 'Assign unassigned members to groups in a category',
				action: 'Assign unassigned members to groups',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new group category',
				action: 'Create a group category',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a group category',
				action: 'Delete a group category',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single group category',
				action: 'Get a group category',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many group categories',
				action: 'Get many group categories',
			},
			{
				name: 'List Groups',
				value: 'listGroups',
				description: 'List groups in a group category',
				action: 'List groups in a category',
			},
			{
				name: 'List Users',
				value: 'listUsers',
				description: 'List users in a group category',
				action: 'List users in a category',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a group category',
				action: 'Update a group category',
			},
		],
		default: 'getAll',
	},
];

export const groupCategoryFields: INodeProperties[] = [
	// ----------------------------------
	//         groupCategory: shared
	// ----------------------------------
	{
		displayName: 'Group Category ID',
		name: 'groupCategoryId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['get', 'update', 'delete', 'listGroups', 'listUsers', 'assignUnassignedMembers'],
			},
		},
		description: 'The ID of the group category',
	},

	// ----------------------------------
	//         groupCategory: getAll, create
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['getAll', 'create'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
			},
			{
				name: 'Course',
				value: 'course',
			},
		],
		description: 'The context for the group category',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['getAll', 'create'],
				context: ['account'],
			},
		},
		description: 'The ID of the account',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['getAll', 'create'],
				context: ['course'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         groupCategory: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['create'],
			},
		},
		description: 'The name of the group category',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Auto Leader',
				name: 'auto_leader',
				type: 'options',
				options: [
					{ name: 'First', value: 'first' },
					{ name: 'Random', value: 'random' },
				],
				default: 'first',
				description: 'How to automatically assign a group leader',
			},
			{
				displayName: 'Create Group Count',
				name: 'create_group_count',
				type: 'number',
				default: 0,
				description: 'Number of groups to create automatically',
			},
			{
				displayName: 'Group Limit',
				name: 'group_limit',
				type: 'number',
				default: 0,
				description: 'Maximum number of members per group (0 for unlimited)',
			},
			{
				displayName: 'Non Collaborative',
				name: 'non_collaborative',
				type: 'boolean',
				default: false,
				description: 'Whether the group category is non-collaborative (differentiation tags)',
			},
			{
				displayName: 'Self Signup',
				name: 'self_signup',
				type: 'options',
				options: [
					{ name: 'Disabled', value: '' },
					{ name: 'Enabled', value: 'enabled' },
					{ name: 'Restricted', value: 'restricted' },
				],
				default: '',
				description: 'Whether students can sign up for groups themselves',
			},
			{
				displayName: 'SIS Group Category ID',
				name: 'sis_group_category_id',
				type: 'string',
				default: '',
				description: 'The SIS ID for the group category',
			},
		],
	},

	// ----------------------------------
	//         groupCategory: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Auto Leader',
				name: 'auto_leader',
				type: 'options',
				options: [
					{ name: 'First', value: 'first' },
					{ name: 'Random', value: 'random' },
				],
				default: 'first',
				description: 'How to automatically assign a group leader',
			},
			{
				displayName: 'Create Group Count',
				name: 'create_group_count',
				type: 'number',
				default: 0,
				description: 'Number of groups to create automatically',
			},
			{
				displayName: 'Group Limit',
				name: 'group_limit',
				type: 'number',
				default: 0,
				description: 'Maximum number of members per group (0 for unlimited)',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the group category',
			},
			{
				displayName: 'Self Signup',
				name: 'self_signup',
				type: 'options',
				options: [
					{ name: 'Disabled', value: '' },
					{ name: 'Enabled', value: 'enabled' },
					{ name: 'Restricted', value: 'restricted' },
				],
				default: '',
				description: 'Whether students can sign up for groups themselves',
			},
			{
				displayName: 'SIS Group Category ID',
				name: 'sis_group_category_id',
				type: 'string',
				default: '',
				description: 'The SIS ID for the group category',
			},
		],
	},

	// ----------------------------------
	//         groupCategory: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Collaboration State',
				name: 'collaboration_state',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Collaborative', value: 'collaborative' },
					{ name: 'Non-Collaborative', value: 'non_collaborative' },
				],
				default: 'all',
				description: 'Filter by collaboration state',
			},
		],
	},

	// ----------------------------------
	//         groupCategory: listUsers - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['listUsers'],
			},
		},
		options: [
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Search for users by name (minimum 3 characters)',
			},
			{
				displayName: 'Unassigned',
				name: 'unassigned',
				type: 'boolean',
				default: false,
				description: 'Whether to only return users not assigned to any group in this category',
			},
		],
	},

	// ----------------------------------
	//         groupCategory: assignUnassignedMembers - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['assignUnassignedMembers'],
			},
		},
		options: [
			{
				displayName: 'Sync',
				name: 'sync',
				type: 'boolean',
				default: false,
				description: 'Whether to run synchronously (defaults to asynchronous)',
			},
		],
	},
];
