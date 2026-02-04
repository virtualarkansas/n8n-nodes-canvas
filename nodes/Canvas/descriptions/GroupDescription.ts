import type { INodeProperties } from 'n8n-workflow';

export const groupOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['group'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new group',
				action: 'Create a group',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a group',
				action: 'Delete a group',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single group',
				action: 'Get a group',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many groups',
				action: 'Get many groups',
			},
			{
				name: 'Invite',
				value: 'invite',
				description: 'Send invitations to join a group',
				action: 'Invite users to a group',
			},
			{
				name: 'List Users',
				value: 'listUsers',
				description: 'List users in a group',
				action: 'List users in a group',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a group',
				action: 'Update a group',
			},
		],
		default: 'getAll',
	},
];

export const groupFields: INodeProperties[] = [
	// ----------------------------------
	//         group: shared
	// ----------------------------------
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['get', 'update', 'delete', 'listUsers', 'invite'],
			},
		},
		description: 'The ID of the group',
	},

	// ----------------------------------
	//         group: getAll
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['getAll'],
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
			{
				name: 'User (Self)',
				value: 'self',
			},
		],
		description: 'The context to list groups from',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['getAll'],
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
				resource: ['group'],
				operation: ['getAll'],
				context: ['course'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         group: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['create'],
			},
		},
		description: 'The name of the group',
	},
	{
		displayName: 'Group Category ID',
		name: 'groupCategoryId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['create'],
			},
		},
		description: 'The ID of the group category (optional - creates community group if not specified)',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'A description of the group',
			},
			{
				displayName: 'Is Public',
				name: 'is_public',
				type: 'boolean',
				default: false,
				description: 'Whether the group is public (applies only to community groups)',
			},
			{
				displayName: 'Join Level',
				name: 'join_level',
				type: 'options',
				options: [
					{ name: 'Invitation Only', value: 'invitation_only' },
					{ name: 'Parent Context Auto Join', value: 'parent_context_auto_join' },
					{ name: 'Parent Context Request', value: 'parent_context_request' },
				],
				default: 'invitation_only',
				description: 'How users can join the group',
			},
			{
				displayName: 'SIS Group ID',
				name: 'sis_group_id',
				type: 'string',
				default: '',
				description: 'The SIS ID for the group',
			},
			{
				displayName: 'Storage Quota MB',
				name: 'storage_quota_mb',
				type: 'number',
				default: 0,
				description: 'Storage quota for the group in megabytes',
			},
		],
	},

	// ----------------------------------
	//         group: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Avatar ID',
				name: 'avatar_id',
				type: 'string',
				default: '',
				description: 'The ID of an avatar image to use for the group',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'A description of the group',
			},
			{
				displayName: 'Is Public',
				name: 'is_public',
				type: 'boolean',
				default: false,
				description: 'Whether the group is public (cannot revert public groups to private)',
			},
			{
				displayName: 'Join Level',
				name: 'join_level',
				type: 'options',
				options: [
					{ name: 'Invitation Only', value: 'invitation_only' },
					{ name: 'Parent Context Auto Join', value: 'parent_context_auto_join' },
					{ name: 'Parent Context Request', value: 'parent_context_request' },
				],
				default: 'invitation_only',
				description: 'How users can join the group',
			},
			{
				displayName: 'Members',
				name: 'members',
				type: 'string',
				default: '',
				description: 'Comma-separated list of user IDs to set as group members',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the group',
			},
			{
				displayName: 'Override SIS Stickiness',
				name: 'override_sis_stickiness',
				type: 'boolean',
				default: false,
				description: 'Whether to override SIS stickiness for the update',
			},
			{
				displayName: 'SIS Group ID',
				name: 'sis_group_id',
				type: 'string',
				default: '',
				description: 'The SIS ID for the group',
			},
			{
				displayName: 'Storage Quota MB',
				name: 'storage_quota_mb',
				type: 'number',
				default: 0,
				description: 'Storage quota for the group in megabytes',
			},
		],
	},

	// ----------------------------------
	//         group: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Context Type',
				name: 'context_type',
				type: 'options',
				options: [
					{ name: 'Account', value: 'Account' },
					{ name: 'Course', value: 'Course' },
				],
				default: 'Course',
				description: 'Filter groups by context type (for user self context)',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Tabs', value: 'tabs' },
				],
				default: [],
				description: 'Additional information to include with each group',
			},
			{
				displayName: 'Only Own Groups',
				name: 'only_own_groups',
				type: 'boolean',
				default: false,
				description: 'Whether to only return groups the user belongs to',
			},
		],
	},

	// ----------------------------------
	//         group: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Permissions', value: 'permissions' },
					{ name: 'Tabs', value: 'tabs' },
				],
				default: [],
				description: 'Additional information to include with the group',
			},
		],
	},

	// ----------------------------------
	//         group: listUsers - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['listUsers'],
			},
		},
		options: [
			{
				displayName: 'Exclude Inactive',
				name: 'exclude_inactive',
				type: 'boolean',
				default: false,
				description: 'Whether to exclude inactive users from the results',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar URL', value: 'avatar_url' },
				],
				default: [],
				description: 'Additional information to include with each user',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Search for users by name or login ID',
			},
		],
	},

	// ----------------------------------
	//         group: invite
	// ----------------------------------
	{
		displayName: 'Invitees',
		name: 'invitees',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['invite'],
			},
		},
		description: 'Comma-separated list of email addresses to invite',
	},
];
