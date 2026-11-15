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
				name: 'Add Member',
				value: 'addMember',
				description: 'Add a user to a group. A user can only be in one group of a group category: Canvas removes them from another group of the same category.',
				action: 'Add a member to a group',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a group in a group category, or a community group',
				action: 'Create a group',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a group and remove all its members',
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
				description: 'Get the groups of a course, of an account, or of the current user',
				action: 'Get many groups',
			},
			{
				name: 'Get Membership',
				value: 'getMembership',
				description: 'Get the membership of one user in a group',
				action: 'Get a group membership',
			},
			{
				name: 'Invite',
				value: 'invite',
				description: 'Invite people to a group by e-mail address',
				action: 'Invite users to a group',
			},
			{
				name: 'List Memberships',
				value: 'listMemberships',
				description: 'List the memberships of a group, including invitations and join requests',
				action: 'List memberships of a group',
			},
			{
				name: 'List Users',
				value: 'listUsers',
				description: 'List the users who are members of a group',
				action: 'List users in a group',
			},
			{
				name: 'Remove Member',
				value: 'removeMember',
				description: 'Remove a user from a group',
				action: 'Remove a member from a group',
			},
			{
				name: 'Remove Members',
				value: 'removeMembers',
				description: 'Remove several users from a group in one request',
				action: 'Remove several members from a group',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a group or replace its members',
				action: 'Update a group',
			},
			{
				name: 'Update Membership',
				value: 'updateMembership',
				description: 'Accept a join request or invitation, or change moderator rights',
				action: 'Update a group membership',
			},
		],
		default: 'getAll',
	},
];

const joinLevelOptions = [
	{
		name: 'Invitation Only',
		value: 'invitation_only',
		description: 'Users join by invitation',
	},
	{
		name: 'Parent Context Auto Join',
		value: 'parent_context_auto_join',
		description: 'Anyone in the course or account can join',
	},
	{
		name: 'Parent Context Request',
		value: 'parent_context_request',
		description: 'Anyone in the course or account can ask to join',
	},
];

/** Operations that address one membership, by user or by membership ID. */
const singleMembershipOperations = ['getMembership', 'updateMembership', 'removeMember'];

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
				operation: [
					'get',
					'update',
					'delete',
					'listUsers',
					'invite',
					'listMemberships',
					'addMember',
					'removeMembers',
					...singleMembershipOperations,
				],
			},
		},
		description: 'The ID of the group (or "sis_group_id:..." for a SIS ID)',
	},

	// ----------------------------------
	//         group: getAll
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
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
				description: 'The groups of an account',
			},
			{
				name: 'Course',
				value: 'course',
				description: 'The groups of a course',
			},
			{
				name: 'User (Self)',
				value: 'self',
				description: 'The groups the user of the access token belongs to',
			},
		],
		default: 'course',
		description: 'Whose groups to list',
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
				context: ['course', 'account'],
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
						description: 'Groups and differentiation tags',
					},
					{
						name: 'Collaborative',
						value: 'collaborative',
						description: 'Ordinary groups only (what Canvas returns by default)',
					},
					{
						name: 'Non-Collaborative',
						value: 'non_collaborative',
						description: 'Differentiation tags only (needs the right to manage them)',
					},
				],
				default: 'collaborative',
				description: 'Whether to return ordinary groups, differentiation tags, or both',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [{ name: 'Tabs', value: 'tabs' }],
				default: [],
				description: 'Additional information to include with each group',
			},
			{
				displayName: 'Only Own Groups',
				name: 'only_own_groups',
				type: 'boolean',
				default: false,
				description: 'Whether to return only the groups the user of the access token belongs to',
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
				resource: ['group'],
				operation: ['getAll'],
				context: ['self'],
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
				description: 'Only return groups that belong to this kind of context',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [{ name: 'Tabs', value: 'tabs' }],
				default: [],
				description: 'Additional information to include with each group',
			},
		],
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
		description: 'The group category (group set) to create the group in. Without it Canvas creates a community group in the root account.',
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
				description: 'Whether the group is public. Canvas only applies this to community groups.',
			},
			{
				displayName: 'Join Level',
				name: 'join_level',
				type: 'options',
				options: joinLevelOptions,
				default: 'invitation_only',
				description: 'How users can join the group',
			},
			{
				displayName: 'Max Membership',
				name: 'max_membership',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'The maximum number of members of the group',
			},
			{
				displayName: 'SIS Group ID',
				name: 'sis_group_id',
				type: 'string',
				default: '',
				description: 'The SIS ID of the group (needs the right to manage SIS data)',
			},
			{
				displayName: 'Storage Quota MB',
				name: 'storage_quota_mb',
				type: 'number',
				default: 50,
				description: 'The file storage of the group in megabytes. Ignored unless the caller may manage storage quotas.',
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
				description: 'The ID of an image file of the group to use as its avatar',
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
				description: 'Whether the group is public. Only for community groups; a public group cannot be made private again.',
			},
			{
				displayName: 'Join Level',
				name: 'join_level',
				type: 'options',
				options: joinLevelOptions,
				default: 'invitation_only',
				description: 'How users can join the group',
			},
			{
				displayName: 'Max Membership',
				name: 'max_membership',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'The maximum number of members of the group',
			},
			{
				displayName: 'Members',
				name: 'members',
				type: 'string',
				default: '',
				description: 'Comma-separated user IDs that make up the group afterwards. Members who are not listed are removed, and listed users leave any other group of the same category. To add or remove single users use Add Member / Remove Member.',
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
				default: true,
				description: 'Whether fields that were changed in Canvas after a SIS import ("sticky" fields) may be overwritten. Canvas overwrites them unless this is turned off.',
			},
			{
				displayName: 'SIS Group ID',
				name: 'sis_group_id',
				type: 'string',
				default: '',
				description: 'The SIS ID of the group (needs the right to manage SIS data)',
			},
			{
				displayName: 'Storage Quota MB',
				name: 'storage_quota_mb',
				type: 'number',
				default: 50,
				description: 'The file storage of the group in megabytes. Ignored unless the caller may manage storage quotas.',
			},
		],
	},

	// ----------------------------------
	//         group: get
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
	//         group: listUsers
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
				description: 'Whether to leave out users whose enrollment in the course is inactive',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [{ name: 'Avatar URL', value: 'avatar_url' }],
				default: [],
				description: 'Additional information to include with each user',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Only return users whose name or login matches (at least 3 characters)',
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
		placeholder: 'name@email.com, other@email.com',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['invite'],
			},
		},
		description: 'Comma-separated e-mail addresses to invite. Where the account allows open registration, Canvas creates a user for an address it does not know.',
	},

	// ----------------------------------
	//         group: memberships
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['addMember'],
			},
		},
		description: 'The ID of the user to add ("self" for the user of the access token)',
	},
	{
		displayName: 'Identify Membership By',
		name: 'membershipBy',
		type: 'options',
		default: 'user',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: singleMembershipOperations,
			},
		},
		options: [
			{
				name: 'Membership ID',
				value: 'membership',
				description: 'The ID of the group membership',
			},
			{
				name: 'User ID',
				value: 'user',
				description: 'The ID of the member',
			},
		],
		description: 'How to identify the membership',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: singleMembershipOperations,
				membershipBy: ['user'],
			},
		},
		description: 'The ID of the member ("self" for the user of the access token)',
	},
	{
		displayName: 'Membership ID',
		name: 'membershipId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: singleMembershipOperations,
				membershipBy: ['membership'],
			},
		},
		description: 'The ID of the group membership (see List Memberships)',
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['updateMembership'],
			},
		},
		options: [
			{
				displayName: 'Accept',
				name: 'accept',
				type: 'boolean',
				default: true,
				description: 'Whether to accept a pending invitation or join request, making the user a member',
			},
			{
				displayName: 'Moderator',
				name: 'moderator',
				type: 'boolean',
				default: false,
				description: 'Whether the member has moderator rights in the group',
			},
		],
	},
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['removeMembers'],
			},
		},
		description: 'Comma-separated IDs of the users to remove from the group',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['listMemberships'],
			},
		},
		options: [
			{
				displayName: 'Filter States',
				name: 'filter_states',
				type: 'multiOptions',
				options: [
					{ name: 'Accepted', value: 'accepted' },
					{ name: 'Invited', value: 'invited' },
					{ name: 'Requested', value: 'requested' },
				],
				default: [],
				description: 'Only return memberships in these states. Without it Canvas returns all three.',
			},
		],
	},
];
