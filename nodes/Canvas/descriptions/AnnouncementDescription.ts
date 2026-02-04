import type { INodeProperties } from 'n8n-workflow';

export const announcementOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['announcement'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new announcement',
				action: 'Create an announcement',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an announcement',
				action: 'Delete an announcement',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single announcement',
				action: 'Get an announcement',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many announcements',
				action: 'Get many announcements',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an announcement',
				action: 'Update an announcement',
			},
		],
		default: 'getAll',
	},
];

export const announcementFields: INodeProperties[] = [
	// ----------------------------------
	//         announcement: shared
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
				resource: ['announcement'],
				operation: ['create', 'delete', 'get', 'update'],
			},
		},
		description: 'Whether this is a course or group announcement',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['announcement'],
				operation: ['create', 'delete', 'get', 'update'],
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
				resource: ['announcement'],
				operation: ['create', 'delete', 'get', 'update'],
				contextType: ['group'],
			},
		},
		description: 'The ID of the group',
	},
	{
		displayName: 'Announcement ID',
		name: 'announcementId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['announcement'],
				operation: ['delete', 'get', 'update'],
			},
		},
		description: 'The ID of the announcement',
	},

	// ----------------------------------
	//         announcement: create
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['announcement'],
				operation: ['create'],
			},
		},
		description: 'The title of the announcement',
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['announcement'],
				operation: ['create'],
			},
		},
		description: 'The body content of the announcement (supports HTML)',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['announcement'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Allow Rating',
				name: 'allow_rating',
				type: 'boolean',
				default: false,
				description: 'Whether users can rate entries in this announcement',
			},
			{
				displayName: 'Delayed Post At',
				name: 'delayed_post_at',
				type: 'dateTime',
				default: '',
				description: 'The datetime to publish the announcement (ISO 8601 format)',
			},
			{
				displayName: 'Lock At',
				name: 'lock_at',
				type: 'dateTime',
				default: '',
				description: 'The datetime to lock the announcement (ISO 8601 format)',
			},
			{
				displayName: 'Lock Comment',
				name: 'lock_comment',
				type: 'boolean',
				default: false,
				description: 'Whether to lock comments on this announcement',
			},
			{
				displayName: 'Only Graders Can Rate',
				name: 'only_graders_can_rate',
				type: 'boolean',
				default: false,
				description: 'Whether only graders can rate entries',
			},
			{
				displayName: 'Podcast Enabled',
				name: 'podcast_enabled',
				type: 'boolean',
				default: false,
				description: 'Whether this announcement has an associated podcast feed',
			},
			{
				displayName: 'Podcast Has Student Posts',
				name: 'podcast_has_student_posts',
				type: 'boolean',
				default: false,
				description: 'Whether the podcast feed includes student posts',
			},
			{
				displayName: 'Published',
				name: 'published',
				type: 'boolean',
				default: true,
				description: 'Whether the announcement is published',
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
				description: 'Comma-separated list of section IDs to limit this announcement to',
			},
		],
	},

	// ----------------------------------
	//         announcement: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['announcement'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Allow Rating',
				name: 'allow_rating',
				type: 'boolean',
				default: false,
				description: 'Whether users can rate entries in this announcement',
			},
			{
				displayName: 'Delayed Post At',
				name: 'delayed_post_at',
				type: 'dateTime',
				default: '',
				description: 'The datetime to publish the announcement (ISO 8601 format)',
			},
			{
				displayName: 'Lock At',
				name: 'lock_at',
				type: 'dateTime',
				default: '',
				description: 'The datetime to lock the announcement (ISO 8601 format)',
			},
			{
				displayName: 'Lock Comment',
				name: 'lock_comment',
				type: 'boolean',
				default: false,
				description: 'Whether to lock comments on this announcement',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The body content of the announcement (supports HTML)',
			},
			{
				displayName: 'Only Graders Can Rate',
				name: 'only_graders_can_rate',
				type: 'boolean',
				default: false,
				description: 'Whether only graders can rate entries',
			},
			{
				displayName: 'Podcast Enabled',
				name: 'podcast_enabled',
				type: 'boolean',
				default: false,
				description: 'Whether this announcement has an associated podcast feed',
			},
			{
				displayName: 'Podcast Has Student Posts',
				name: 'podcast_has_student_posts',
				type: 'boolean',
				default: false,
				description: 'Whether the podcast feed includes student posts',
			},
			{
				displayName: 'Published',
				name: 'published',
				type: 'boolean',
				default: true,
				description: 'Whether the announcement is published',
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
				description: 'Comma-separated list of section IDs to limit this announcement to',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the announcement',
			},
		],
	},

	// ----------------------------------
	//         announcement: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['announcement'],
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
				description: 'Additional information to include with the announcement',
			},
		],
	},

	// ----------------------------------
	//         announcement: getAll
	// ----------------------------------
	{
		displayName: 'Context Codes',
		name: 'contextCodes',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['announcement'],
				operation: ['getAll'],
			},
		},
		description: 'Comma-separated list of context codes (e.g., course_123, course_456)',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['announcement'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Active Only',
				name: 'active_only',
				type: 'boolean',
				default: false,
				description: 'Whether to return only active announcements that have been published',
			},
			{
				displayName: 'Available After',
				name: 'available_after',
				type: 'dateTime',
				default: '',
				description: 'Only return announcements having locked_at nil or after this date',
			},
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				description: 'Only return announcements posted before this date (defaults to 28 days from start date)',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Sections', value: 'sections' },
					{ name: 'Sections User Count', value: 'sections_user_count' },
				],
				default: [],
				description: 'Additional information to include with each announcement',
			},
			{
				displayName: 'Latest Only',
				name: 'latest_only',
				type: 'boolean',
				default: false,
				description: 'Whether to return only the latest announcement for each associated context',
			},
			{
				displayName: 'Start Date',
				name: 'start_date',
				type: 'dateTime',
				default: '',
				description: 'Only return announcements posted since this date (inclusive)',
			},
		],
	},
];
