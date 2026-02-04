import type { INodeProperties } from 'n8n-workflow';

export const discussionTopicOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new discussion topic',
				action: 'Create a discussion topic',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a discussion topic',
				action: 'Delete a discussion topic',
			},
			{
				name: 'Duplicate',
				value: 'duplicate',
				description: 'Duplicate a discussion topic',
				action: 'Duplicate a discussion topic',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single discussion topic',
				action: 'Get a discussion topic',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many discussion topics',
				action: 'Get many discussion topics',
			},
			{
				name: 'Reorder Pinned',
				value: 'reorderPinned',
				description: 'Reorder pinned discussion topics',
				action: 'Reorder pinned discussion topics',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a discussion topic',
				action: 'Update a discussion topic',
			},
		],
		default: 'getAll',
	},
];

export const discussionTopicFields: INodeProperties[] = [
	// ----------------------------------
	//         discussionTopic: shared
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		options: [
			{ name: 'Course', value: 'course' },
			{ name: 'Group', value: 'group' },
		],
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['create', 'delete', 'duplicate', 'get', 'getAll', 'reorderPinned', 'update'],
			},
		},
		description: 'Whether this is a course or group discussion topic',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['create', 'delete', 'duplicate', 'get', 'getAll', 'reorderPinned', 'update'],
				contextType: ['course'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['create', 'delete', 'duplicate', 'get', 'getAll', 'reorderPinned', 'update'],
				contextType: ['group'],
			},
		},
		description: 'The ID of the group',
	},
	{
		displayName: 'Topic ID',
		name: 'topicId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['delete', 'duplicate', 'get', 'update'],
			},
		},
		description: 'The ID of the discussion topic',
	},

	// ----------------------------------
	//         discussionTopic: create
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['create'],
			},
		},
		description: 'The title of the discussion topic',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Allow Rating',
				name: 'allow_rating',
				type: 'boolean',
				default: false,
				description: 'Whether users can rate entries in this topic',
			},
			{
				displayName: 'Delayed Post At',
				name: 'delayed_post_at',
				type: 'dateTime',
				default: '',
				description: 'The datetime to publish the topic (ISO 8601 format)',
			},
			{
				displayName: 'Discussion Type',
				name: 'discussion_type',
				type: 'options',
				options: [
					{ name: 'Side Comment', value: 'side_comment' },
					{ name: 'Threaded', value: 'threaded' },
				],
				default: 'side_comment',
				description: 'The type of discussion',
			},
			{
				displayName: 'Group Category ID',
				name: 'group_category_id',
				type: 'string',
				default: '',
				description: 'The ID of the group category for group discussions',
			},
			{
				displayName: 'Is Announcement',
				name: 'is_announcement',
				type: 'boolean',
				default: false,
				description: 'Whether this topic is an announcement',
			},
			{
				displayName: 'Lock At',
				name: 'lock_at',
				type: 'dateTime',
				default: '',
				description: 'The datetime to lock the topic (ISO 8601 format)',
			},
			{
				displayName: 'Lock Comment',
				name: 'lock_comment',
				type: 'boolean',
				default: false,
				description: 'Whether to lock comments on this topic',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The body content of the discussion topic (supports HTML)',
			},
			{
				displayName: 'Only Graders Can Rate',
				name: 'only_graders_can_rate',
				type: 'boolean',
				default: false,
				description: 'Whether only graders can rate entries',
			},
			{
				displayName: 'Pinned',
				name: 'pinned',
				type: 'boolean',
				default: false,
				description: 'Whether to pin this topic to the top',
			},
			{
				displayName: 'Podcast Enabled',
				name: 'podcast_enabled',
				type: 'boolean',
				default: false,
				description: 'Whether this topic has an associated podcast feed',
			},
			{
				displayName: 'Podcast Has Student Posts',
				name: 'podcast_has_student_posts',
				type: 'boolean',
				default: false,
				description: 'Whether the podcast feed includes student posts',
			},
			{
				displayName: 'Position After',
				name: 'position_after',
				type: 'string',
				default: '',
				description: 'The ID of the topic to place this one after',
			},
			{
				displayName: 'Published',
				name: 'published',
				type: 'boolean',
				default: true,
				description: 'Whether the topic is published',
			},
			{
				displayName: 'Require Initial Post',
				name: 'require_initial_post',
				type: 'boolean',
				default: false,
				description: 'Whether users must post before seeing other replies',
			},
			{
				displayName: 'Sort By Rating',
				name: 'sort_by_rating',
				type: 'boolean',
				default: false,
				description: 'Whether to sort entries by rating',
			},
			{
				displayName: 'Specific Sections',
				name: 'specific_sections',
				type: 'string',
				default: '',
				description: 'Comma-separated list of section IDs to limit this topic to',
			},
		],
	},

	// ----------------------------------
	//         discussionTopic: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Allow Rating',
				name: 'allow_rating',
				type: 'boolean',
				default: false,
				description: 'Whether users can rate entries in this topic',
			},
			{
				displayName: 'Delayed Post At',
				name: 'delayed_post_at',
				type: 'dateTime',
				default: '',
				description: 'The datetime to publish the topic (ISO 8601 format)',
			},
			{
				displayName: 'Discussion Type',
				name: 'discussion_type',
				type: 'options',
				options: [
					{ name: 'Side Comment', value: 'side_comment' },
					{ name: 'Threaded', value: 'threaded' },
				],
				default: 'side_comment',
				description: 'The type of discussion',
			},
			{
				displayName: 'Group Category ID',
				name: 'group_category_id',
				type: 'string',
				default: '',
				description: 'The ID of the group category for group discussions',
			},
			{
				displayName: 'Is Announcement',
				name: 'is_announcement',
				type: 'boolean',
				default: false,
				description: 'Whether this topic is an announcement',
			},
			{
				displayName: 'Lock At',
				name: 'lock_at',
				type: 'dateTime',
				default: '',
				description: 'The datetime to lock the topic (ISO 8601 format)',
			},
			{
				displayName: 'Lock Comment',
				name: 'lock_comment',
				type: 'boolean',
				default: false,
				description: 'Whether to lock comments on this topic',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The body content of the discussion topic (supports HTML)',
			},
			{
				displayName: 'Only Graders Can Rate',
				name: 'only_graders_can_rate',
				type: 'boolean',
				default: false,
				description: 'Whether only graders can rate entries',
			},
			{
				displayName: 'Pinned',
				name: 'pinned',
				type: 'boolean',
				default: false,
				description: 'Whether to pin this topic to the top',
			},
			{
				displayName: 'Podcast Enabled',
				name: 'podcast_enabled',
				type: 'boolean',
				default: false,
				description: 'Whether this topic has an associated podcast feed',
			},
			{
				displayName: 'Podcast Has Student Posts',
				name: 'podcast_has_student_posts',
				type: 'boolean',
				default: false,
				description: 'Whether the podcast feed includes student posts',
			},
			{
				displayName: 'Position After',
				name: 'position_after',
				type: 'string',
				default: '',
				description: 'The ID of the topic to place this one after',
			},
			{
				displayName: 'Published',
				name: 'published',
				type: 'boolean',
				default: true,
				description: 'Whether the topic is published',
			},
			{
				displayName: 'Require Initial Post',
				name: 'require_initial_post',
				type: 'boolean',
				default: false,
				description: 'Whether users must post before seeing other replies',
			},
			{
				displayName: 'Sort By Rating',
				name: 'sort_by_rating',
				type: 'boolean',
				default: false,
				description: 'Whether to sort entries by rating',
			},
			{
				displayName: 'Specific Sections',
				name: 'specific_sections',
				type: 'string',
				default: '',
				description: 'Comma-separated list of section IDs to limit this topic to',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the discussion topic',
			},
		],
	},

	// ----------------------------------
	//         discussionTopic: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'All Dates', value: 'all_dates' },
					{ name: 'Overrides', value: 'overrides' },
					{ name: 'Sections', value: 'sections' },
					{ name: 'Sections User Count', value: 'sections_user_count' },
				],
				default: [],
				description: 'Additional information to include with the discussion topic',
			},
		],
	},

	// ----------------------------------
	//         discussionTopic: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Exclude Context Module Locked Topics',
				name: 'exclude_context_module_locked_topics',
				type: 'boolean',
				default: false,
				description: 'Whether to exclude topics locked by context modules',
			},
			{
				displayName: 'Filter By',
				name: 'filter_by',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Unread', value: 'unread' },
				],
				default: 'all',
				description: 'Filter discussion topics by read state',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'All Dates', value: 'all_dates' },
					{ name: 'Overrides', value: 'overrides' },
					{ name: 'Sections', value: 'sections' },
					{ name: 'Sections User Count', value: 'sections_user_count' },
				],
				default: [],
				description: 'Additional information to include with each discussion topic',
			},
			{
				displayName: 'Only Announcements',
				name: 'only_announcements',
				type: 'boolean',
				default: false,
				description: 'Whether to return only announcements',
			},
			{
				displayName: 'Order By',
				name: 'order_by',
				type: 'options',
				options: [
					{ name: 'Position', value: 'position' },
					{ name: 'Recent Activity', value: 'recent_activity' },
					{ name: 'Title', value: 'title' },
				],
				default: 'position',
				description: 'The field to order discussion topics by',
			},
			{
				displayName: 'Scope',
				name: 'scope',
				type: 'options',
				options: [
					{ name: 'Locked', value: 'locked' },
					{ name: 'Pinned', value: 'pinned' },
					{ name: 'Unlocked', value: 'unlocked' },
					{ name: 'Unpinned', value: 'unpinned' },
				],
				default: 'unlocked',
				description: 'Filter by scope',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Search for discussion topics by title',
			},
		],
	},

	// ----------------------------------
	//         discussionTopic: reorderPinned
	// ----------------------------------
	{
		displayName: 'Order',
		name: 'order',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['reorderPinned'],
			},
		},
		description: 'Comma-separated list of topic IDs in the desired order',
	},
];
