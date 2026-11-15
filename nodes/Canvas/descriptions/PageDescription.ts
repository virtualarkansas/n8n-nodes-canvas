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
				description: 'Duplicate a page of a course',
				action: 'Duplicate a page',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single page',
				action: 'Get a page',
			},
			{
				name: 'Get Front Page',
				value: 'getFrontPage',
				description: 'Get the front page of a course or group',
				action: 'Get the front page',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many pages',
				action: 'Get many pages',
			},
			{
				name: 'Get Revision',
				value: 'getRevision',
				description: 'Get one revision of a page (or its latest revision), with or without the content',
				action: 'Get a revision of a page',
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
				description: 'Update a page (a page URL that does not exist yet is created)',
				action: 'Update a page',
			},
			{
				name: 'Update Front Page',
				value: 'updateFrontPage',
				description: 'Update the front page of a course or group, or create it when there is none',
				action: 'Update the front page',
			},
		],
		default: 'getAll',
	},
];

/** Operations available for group wikis as well as course wikis. */
const contextOperations = [
	'create',
	'delete',
	'get',
	'getAll',
	'getFrontPage',
	'getRevision',
	'listRevisions',
	'revert',
	'update',
	'updateFrontPage',
];

const bodyField: INodeProperties = {
	displayName: 'Body',
	name: 'body',
	type: 'string',
	typeOptions: {
		rows: 6,
	},
	default: '',
	description: 'The HTML content of the page',
};

const editingRolesField: INodeProperties = {
	displayName: 'Editing Roles',
	name: 'editing_roles',
	type: 'multiOptions',
	options: [
		{ name: 'Members', value: 'members', description: 'Group members (group wikis only)' },
		{ name: 'Public', value: 'public' },
		{ name: 'Students', value: 'students' },
		{ name: 'Teachers', value: 'teachers' },
	],
	default: [],
	description: 'Which user roles are allowed to edit this page. At least one role is required when this field is set.',
};

const notifyField: INodeProperties = {
	displayName: 'Notify of Update',
	name: 'notify_of_update',
	type: 'boolean',
	default: false,
	description: 'Whether participants should be notified that the page changed',
};

const publishAtField: INodeProperties = {
	displayName: 'Publish At',
	name: 'publish_at',
	type: 'dateTime',
	default: '',
	description: 'Schedule a date/time to publish the page automatically (requires the Scheduled Page Publication feature). Only applies to unpublished pages.',
};

const publishedField: INodeProperties = {
	displayName: 'Published',
	name: 'published',
	type: 'boolean',
	default: false,
	description: 'Whether the page is published and visible to students. The front page cannot be unpublished.',
};

const studentTodoField: INodeProperties = {
	displayName: 'Student To-Do Date',
	name: 'student_todo_at',
	type: 'dateTime',
	default: '',
	description: 'Add the page to the students\' to-do list (planner) on this date. Course pages only.',
};

const studentPlannerCheckboxField: INodeProperties = {
	displayName: 'Student To-Do Enabled',
	name: 'student_planner_checkbox',
	type: 'boolean',
	default: true,
	description: 'Whether the page stays on the students\' to-do list. Turn off to remove an existing to-do date.',
};

const titleField: INodeProperties = {
	displayName: 'Title',
	name: 'title',
	type: 'string',
	default: '',
	description: 'The title of the page. Changing it also changes the page URL.',
};

export const pageFields: INodeProperties[] = [
	// ----------------------------------
	//         page: context
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['page'],
				operation: contextOperations,
			},
		},
		options: [
			{ name: 'Course', value: 'course' },
			{ name: 'Group', value: 'group' },
		],
		description: 'Whether the page belongs to a course or to a group',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['page'],
				operation: contextOperations,
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
				resource: ['page'],
				operation: contextOperations,
				contextType: ['group'],
			},
		},
		description: 'The ID of the group',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['page'],
				operation: ['duplicate'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         page: get, update, delete, duplicate, revisions
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
				operation: ['get', 'update', 'delete', 'duplicate', 'listRevisions', 'getRevision', 'revert'],
			},
		},
		description: 'The URL slug of the page (e.g. "my-page-title") or its numeric ID. Use "page_id:123" when the slug itself is a number.',
	},

	// ----------------------------------
	//         page: revert, getRevision
	// ----------------------------------
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
		description: 'The ID of the revision to revert to (see List Revisions)',
	},
	{
		displayName: 'Revision ID',
		name: 'revisionId',
		type: 'string',
		default: 'latest',
		displayOptions: {
			show: {
				resource: ['page'],
				operation: ['getRevision'],
			},
		},
		description: 'The ID of the revision, or "latest" for the current one. Reading older revisions requires edit rights on the page.',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['page'],
				operation: ['getRevision'],
			},
		},
		options: [
			{
				displayName: 'Summary Only',
				name: 'summary',
				type: 'boolean',
				default: false,
				description: 'Whether to leave the page content (title, body) out of the result',
			},
		],
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
		description: 'The title of the page. Canvas derives the page URL from it.',
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
			bodyField,
			editingRolesField,
			{
				displayName: 'Front Page',
				name: 'front_page',
				type: 'boolean',
				default: false,
				description: 'Whether to set this page as the front page. The page must be published.',
			},
			notifyField,
			publishAtField,
			publishedField,
			studentTodoField,
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
			bodyField,
			editingRolesField,
			{
				displayName: 'Front Page',
				name: 'front_page',
				type: 'boolean',
				default: false,
				description: 'Whether this page is the front page. The page must be published.',
			},
			notifyField,
			publishAtField,
			publishedField,
			studentTodoField,
			studentPlannerCheckboxField,
			titleField,
		],
	},

	// ----------------------------------
	//         page: updateFrontPage
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
				operation: ['updateFrontPage'],
			},
		},
		options: [bodyField, editingRolesField, notifyField, publishedField, titleField],
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
				default: true,
				description: 'Whether to return only published pages (on) or only unpublished pages (off). Leave this option out to return both.',
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
];
