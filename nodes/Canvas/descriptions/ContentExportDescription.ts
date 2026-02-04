import type { INodeProperties } from 'n8n-workflow';

export const contentExportOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['contentExport'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a content export',
				action: 'Create a content export',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a content export',
				action: 'Get a content export',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many content exports',
				action: 'Get many content exports',
			},
		],
		default: 'getAll',
	},
];

export const contentExportFields: INodeProperties[] = [
	// ----------------------------------
	//         contentExport: shared
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['contentExport'],
				operation: ['create', 'get', 'getAll'],
			},
		},
		options: [
			{
				name: 'Course',
				value: 'course',
			},
			{
				name: 'Group',
				value: 'group',
			},
			{
				name: 'User',
				value: 'user',
			},
		],
		description: 'The type of context to export content from',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentExport'],
				operation: ['create', 'get', 'getAll'],
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
				resource: ['contentExport'],
				operation: ['create', 'get', 'getAll'],
				contextType: ['group'],
			},
		},
		description: 'The ID of the group',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentExport'],
				operation: ['create', 'get', 'getAll'],
				contextType: ['user'],
			},
		},
		description: 'The ID of the user',
	},

	// ----------------------------------
	//         contentExport: get
	// ----------------------------------
	{
		displayName: 'Content Export ID',
		name: 'contentExportId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentExport'],
				operation: ['get'],
			},
		},
		description: 'The ID of the content export',
	},

	// ----------------------------------
	//         contentExport: create
	// ----------------------------------
	{
		displayName: 'Export Type',
		name: 'exportType',
		type: 'options',
		required: true,
		default: 'common_cartridge',
		displayOptions: {
			show: {
				resource: ['contentExport'],
				operation: ['create'],
			},
		},
		options: [
			{
				name: 'Common Cartridge',
				value: 'common_cartridge',
			},
			{
				name: 'QTI',
				value: 'qti',
			},
			{
				name: 'ZIP',
				value: 'zip',
			},
		],
		description: 'The type of export to create',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['contentExport'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Select Announcements',
				name: 'select_announcements',
				type: 'string',
				default: '',
				description: 'Comma-separated list of announcement IDs to export',
			},
			{
				displayName: 'Select Assignments',
				name: 'select_assignments',
				type: 'string',
				default: '',
				description: 'Comma-separated list of assignment IDs to export',
			},
			{
				displayName: 'Select Attachments',
				name: 'select_attachments',
				type: 'string',
				default: '',
				description: 'Comma-separated list of attachment IDs to export',
			},
			{
				displayName: 'Select Calendar Events',
				name: 'select_calendar_events',
				type: 'string',
				default: '',
				description: 'Comma-separated list of calendar event IDs to export',
			},
			{
				displayName: 'Select Discussion Topics',
				name: 'select_discussion_topics',
				type: 'string',
				default: '',
				description: 'Comma-separated list of discussion topic IDs to export',
			},
			{
				displayName: 'Select Files',
				name: 'select_files',
				type: 'string',
				default: '',
				description: 'Comma-separated list of file IDs to export',
			},
			{
				displayName: 'Select Folders',
				name: 'select_folders',
				type: 'string',
				default: '',
				description: 'Comma-separated list of folder IDs to export',
			},
			{
				displayName: 'Select Module Items',
				name: 'select_module_items',
				type: 'string',
				default: '',
				description: 'Comma-separated list of module item IDs to export',
			},
			{
				displayName: 'Select Modules',
				name: 'select_modules',
				type: 'string',
				default: '',
				description: 'Comma-separated list of module IDs to export',
			},
			{
				displayName: 'Select Pages',
				name: 'select_pages',
				type: 'string',
				default: '',
				description: 'Comma-separated list of page IDs to export',
			},
			{
				displayName: 'Select Quizzes',
				name: 'select_quizzes',
				type: 'string',
				default: '',
				description: 'Comma-separated list of quiz IDs to export',
			},
			{
				displayName: 'Select Rubrics',
				name: 'select_rubrics',
				type: 'string',
				default: '',
				description: 'Comma-separated list of rubric IDs to export',
			},
			{
				displayName: 'Skip Notifications',
				name: 'skip_notifications',
				type: 'boolean',
				default: false,
				description: 'Whether to skip sending notifications about the export',
			},
		],
	},
];
