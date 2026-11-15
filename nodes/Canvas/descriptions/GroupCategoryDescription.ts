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
				description: 'Distribute the students who are in no group of the category evenly among its groups',
				action: 'Assign unassigned members to groups',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a group category (group set), optionally with a number of groups',
				action: 'Create a group category',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a group category and all groups in it',
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
				description: 'List the users who can be in the groups of the category (the students of the course), or only those who are in none of its groups yet',
				action: 'List users in a category',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a group category. Canvas clears Self Signup, Auto Leader and Group Limit unless they are sent again.',
				action: 'Update a group category',
			},
		],
		default: 'getAll',
	},
];

const autoLeader: INodeProperties = {
	displayName: 'Auto Leader',
	name: 'auto_leader',
	type: 'options',
	options: [
		{
			name: 'First',
			value: 'first',
			description: 'The first student to join a group becomes its leader',
		},
		{
			name: 'Random',
			value: 'random',
			description: 'A random member becomes the leader',
		},
	],
	default: 'first',
	description: 'How Canvas picks a leader for each group of the category',
};

const groupLimit: INodeProperties = {
	displayName: 'Group Limit',
	name: 'group_limit',
	type: 'number',
	typeOptions: {
		minValue: 2,
	},
	default: 2,
	description: 'Maximum number of members per group (at least 2). Leave the field out for no limit.',
};

const selfSignup: INodeProperties = {
	displayName: 'Self Signup',
	name: 'self_signup',
	type: 'options',
	options: [
		{
			name: 'Disabled',
			value: '',
			description: 'Students cannot join groups themselves',
		},
		{
			name: 'Enabled',
			value: 'enabled',
			description: 'Students can join any group of the category',
		},
		{
			name: 'Restricted',
			value: 'restricted',
			description: 'Students can only join groups whose members are in their own section',
		},
	],
	default: 'enabled',
	description: 'Whether students can join groups themselves. Only for course group categories.',
};

const sisGroupCategoryId: INodeProperties = {
	displayName: 'SIS Group Category ID',
	name: 'sis_group_category_id',
	type: 'string',
	default: '',
	description: 'The SIS ID of the group category (needs the right to manage SIS data)',
};

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
		description: 'The ID of the group category (or "sis_group_category_id:..." for a SIS ID)',
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
		description: 'Whether the group category belongs to a course or to an account',
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
		description: 'The name of the group category. Must be unique within the course or account.',
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
			autoLeader,
			{
				displayName: 'Create Group Count',
				name: 'create_group_count',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'Number of groups to create in the category (courses only). Without Self Signup Canvas also distributes the students of the course among them.',
			},
			groupLimit,
			{
				displayName: 'Non Collaborative',
				name: 'non_collaborative',
				type: 'boolean',
				default: false,
				description: 'Whether to create a set of differentiation tags instead of ordinary groups (courses only; needs the right to add differentiation tags)',
			},
			selfSignup,
			sisGroupCategoryId,
		],
	},

	// ----------------------------------
	//         groupCategory: update
	// ----------------------------------
	{
		displayName:
			'Canvas replaces the settings of the category: Self Signup, Auto Leader and Group Limit are cleared unless you add them here again with their current values',
		name: 'updateNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['update'],
			},
		},
	},
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
			autoLeader,
			{
				displayName: 'Create Group Count',
				name: 'create_group_count',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'Number of additional groups to create in the category (courses only)',
			},
			groupLimit,
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the group category',
			},
			selfSignup,
			sisGroupCategoryId,
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
					{
						name: 'All',
						value: 'all',
						description: 'Group categories and sets of differentiation tags',
					},
					{
						name: 'Collaborative',
						value: 'collaborative',
						description: 'Ordinary group categories only (what Canvas returns by default)',
					},
					{
						name: 'Non-Collaborative',
						value: 'non_collaborative',
						description: 'Sets of differentiation tags only',
					},
				],
				default: 'collaborative',
				description: 'Whether to return ordinary group categories, sets of differentiation tags, or both',
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
				description: 'Only return users whose name or login matches (at least 3 characters)',
			},
			{
				displayName: 'Unassigned',
				name: 'unassigned',
				type: 'boolean',
				default: false,
				description: 'Whether to return only the users who are in no group of the category. Otherwise Canvas returns every student of the course, in a group or not.',
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
				description: 'Whether to wait for the result. Off: Canvas works in the background and the node outputs a progress record. On: the node outputs one item per group with its new members.',
			},
		],
	},
];
