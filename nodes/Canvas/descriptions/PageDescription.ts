import type { INodeProperties } from 'n8n-workflow';

export const pageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['page'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new page',
				action: 'Create a page',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a page',
				action: 'Delete a page',
			},
			{
				name: 'Duplicate',
				value: 'duplicate',
				description: 'Duplicate a page',
				action: 'Duplicate a page',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single page',
				action: 'Get a page',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many pages',
				action: 'Get many pages',
			},
			{
				name: 'List Revisions',
				value: 'listRevisions',
				description: 'List all revisions of a page',
				action: 'List revisions of a page',
			},
			{
				name: 'Revert',
				value: 'revert',
				description: 'Revert a page to a previous revision',
				action: 'Revert a page to a previous revision',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a page',
				action: 'Update a page',
			},
		],
		default: 'getAll',
	},
];

export const pageFields: INodeProperties[] = [
	// ----------------------------------
	//         page: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['page'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         page: get, update, delete, duplicate, listRevisions
	// ----------------------------------
	{
		displayName: 'Page URL or ID',
		name: 'pageUrl',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['page'],
				operation: ['get', 'update', 'delete', 'duplicate', 'listRevisions'],
			},
		},
		description: 'The URL slug or ID of the page. Use "page_id:123" format to specify by ID.',
	},

	// ----------------------------------
	//         page: revert
	// ----------------------------------
	{
		displayName: 'Page URL or ID',
		name: 'pageUrl',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['page'],
				operation: ['revert'],
			},
		},
		description: 'The URL slug or ID of the page. Use "page_id:123" format to specify by ID.',
	},
	{
		displayName: 'Revision ID',
		name: 'revisionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['page'],
				operation: ['revert'],
			},
		},
		description: 'The ID of the revision to revert to',
	},

	// ----------------------------------
	//         page: create
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['page'],
				operation: ['create'],
			},
		},
		description: 'The title of the page',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['page'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Body',
				name: 'body',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				description: 'The HTML content of the page',
			},
			{
				displayName: 'Editing Roles',
				name: 'editing_roles',
				type: 'multiOptions',
				options: [
					{ name: 'Members', value: 'members' },
					{ name: 'Public', value: 'public' },
					{ name: 'Students', value: 'students' },
					{ name: 'Teachers', value: 'teachers' },
				],
				default: [],
				description: 'Which user roles are allowed to edit this page',
			},
			{
				displayName: 'Front Page',
				name: 'front_page',
				type: 'boolean',
				default: false,
				description: 'Whether to set this page as the front page of the course',
			},
			{
				displayName: 'Notify of Update',
				name: 'notify_of_update',
				type: 'boolean',
				default: false,
				description: 'Whether to send a notification about the page creation',
			},
			{
				displayName: 'Publish At',
				name: 'publish_at',
				type: 'dateTime',
				default: '',
				description: 'Schedule the page to be published at a specific date/time',
			},
			{
				displayName: 'Published',
				name: 'published',
				type: 'boolean',
				default: false,
				description: 'Whether the page is published and visible to students',
			},
		],
	},

	// ----------------------------------
	//         page: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['page'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Body',
				name: 'body',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				description: 'The HTML content of the page',
			},
			{
				displayName: 'Editing Roles',
				name: 'editing_roles',
				type: 'multiOptions',
				options: [
					{ name: 'Members', value: 'members' },
					{ name: 'Public', value: 'public' },
					{ name: 'Students', value: 'students' },
					{ name: 'Teachers', value: 'teachers' },
				],
				default: [],
				description: 'Which user roles are allowed to edit this page',
			},
			{
				displayName: 'Front Page',
				name: 'front_page',
				type: 'boolean',
				default: false,
				description: 'Whether to set this page as the front page of the course',
			},
			{
				displayName: 'Notify of Update',
				name: 'notify_of_update',
				type: 'boolean',
				default: false,
				description: 'Whether to send a notification about the page update',
			},
			{
				displayName: 'Publish At',
				name: 'publish_at',
				type: 'dateTime',
				default: '',
				description: 'Schedule the page to be published at a specific date/time',
			},
			{
				displayName: 'Published',
				name: 'published',
				type: 'boolean',
				default: false,
				description: 'Whether the page is published and visible to students',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the page',
			},
		],
	},

	// ----------------------------------
	//         page: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['page'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Body', value: 'body' },
				],
				default: [],
				description: 'Additional information to include with each page',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
				description: 'The sort order for the pages',
			},
			{
				displayName: 'Published',
				name: 'published',
				type: 'boolean',
				default: false,
				description: 'Whether to filter by published status',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Partial match for page title',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Created At', value: 'created_at' },
					{ name: 'Title', value: 'title' },
					{ name: 'Updated At', value: 'updated_at' },
				],
				default: 'title',
				description: 'The field to sort pages by',
			},
		],
	},

	// ----------------------------------
	//         page: listRevisions - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['page'],
				operation: ['listRevisions'],
			},
		},
		options: [
			{
				displayName: 'Summary Only',
				name: 'summary',
				type: 'boolean',
				default: false,
				description: 'Whether to exclude page content from the revision data',
			},
		],
	},
];
