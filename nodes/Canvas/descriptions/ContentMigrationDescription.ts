import type { INodeProperties } from 'n8n-workflow';

export const contentMigrationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['contentMigration'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a content migration',
				action: 'Create a content migration',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a content migration',
				action: 'Get a content migration',
			},
			{
				name: 'Get Asset ID Mapping',
				value: 'getAssetIdMapping',
				description: 'Get asset ID mapping for a content migration',
				action: 'Get asset ID mapping for a content migration',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many content migrations',
				action: 'Get many content migrations',
			},
			{
				name: 'Get Selective Data',
				value: 'getSelectiveData',
				description: 'Get selective import data for a content migration',
				action: 'Get selective import data for a content migration',
			},
			{
				name: 'List Migrators',
				value: 'listMigrators',
				description: 'List available content migrators',
				action: 'List available content migrators',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a content migration',
				action: 'Update a content migration',
			},
		],
		default: 'getAll',
	},
];

export const contentMigrationFields: INodeProperties[] = [
	// ----------------------------------
	//         contentMigration: shared
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: ['create', 'get', 'getAll', 'getSelectiveData', 'listMigrators', 'update'],
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
				name: 'Group',
				value: 'group',
			},
			{
				name: 'User',
				value: 'user',
			},
		],
		description: 'The type of context for the content migration',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: ['create', 'get', 'getAll', 'getSelectiveData', 'listMigrators', 'update'],
				contextType: ['account'],
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
				resource: ['contentMigration'],
				operation: ['create', 'get', 'getAll', 'getAssetIdMapping', 'getSelectiveData', 'listMigrators', 'update'],
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
				resource: ['contentMigration'],
				operation: ['create', 'get', 'getAll', 'getSelectiveData', 'listMigrators', 'update'],
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
				resource: ['contentMigration'],
				operation: ['create', 'get', 'getAll', 'getSelectiveData', 'listMigrators', 'update'],
				contextType: ['user'],
			},
		},
		description: 'The ID of the user',
	},

	// ----------------------------------
	//         contentMigration: get, update, getSelectiveData, getAssetIdMapping
	// ----------------------------------
	{
		displayName: 'Content Migration ID',
		name: 'contentMigrationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: ['get', 'getAssetIdMapping', 'getSelectiveData', 'update'],
			},
		},
		description: 'The ID of the content migration',
	},

	// ----------------------------------
	//         contentMigration: getAssetIdMapping - specific context
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: ['getAssetIdMapping'],
			},
			hide: {
				contextType: ['course'],
			},
		},
		description: 'The ID of the course (asset ID mapping is only available for courses)',
	},

	// ----------------------------------
	//         contentMigration: create
	// ----------------------------------
	{
		displayName: 'Migration Type',
		name: 'migrationType',
		type: 'options',
		required: true,
		default: 'canvas_cartridge_importer',
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: ['create'],
			},
		},
		options: [
			{
				name: 'Canvas Cartridge',
				value: 'canvas_cartridge_importer',
			},
			{
				name: 'Common Cartridge',
				value: 'common_cartridge_importer',
			},
			{
				name: 'Course Copy',
				value: 'course_copy_importer',
			},
			{
				name: 'Moodle',
				value: 'moodle_converter',
			},
			{
				name: 'QTI',
				value: 'qti_converter',
			},
			{
				name: 'ZIP File',
				value: 'zip_file_importer',
			},
		],
		description: 'The type of content migration to create',
	},
	{
		displayName: 'Source Course ID',
		name: 'sourceCourseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: ['create'],
				migrationType: ['course_copy_importer'],
			},
		},
		description: 'The ID of the source course to copy from',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Content Export ID',
				name: 'content_export_id',
				type: 'string',
				default: '',
				description: 'The ID of a ContentExport to import',
			},
			{
				displayName: 'Date Shift Options - New End Date',
				name: 'date_shift_options_new_end_date',
				type: 'dateTime',
				default: '',
				description: 'The new end date for the course',
			},
			{
				displayName: 'Date Shift Options - New Start Date',
				name: 'date_shift_options_new_start_date',
				type: 'dateTime',
				default: '',
				description: 'The new start date for the course',
			},
			{
				displayName: 'Date Shift Options - Old End Date',
				name: 'date_shift_options_old_end_date',
				type: 'dateTime',
				default: '',
				description: 'The original end date of the source course',
			},
			{
				displayName: 'Date Shift Options - Old Start Date',
				name: 'date_shift_options_old_start_date',
				type: 'dateTime',
				default: '',
				description: 'The original start date of the source course',
			},
			{
				displayName: 'Date Shift Options - Remove Dates',
				name: 'date_shift_options_remove_dates',
				type: 'boolean',
				default: false,
				description: 'Whether to remove dates from the imported content',
			},
			{
				displayName: 'Date Shift Options - Shift Dates',
				name: 'date_shift_options_shift_dates',
				type: 'boolean',
				default: false,
				description: 'Whether to shift dates in the imported content',
			},
			{
				displayName: 'File URL',
				name: 'file_url',
				type: 'string',
				default: '',
				description: 'URL to download a file for import',
			},
			{
				displayName: 'Folder ID',
				name: 'folder_id',
				type: 'string',
				default: '',
				description: 'The folder to unzip the file into (for zip_file_importer)',
			},
			{
				displayName: 'Insert Into Module ID',
				name: 'insert_into_module_id',
				type: 'string',
				default: '',
				description: 'The ID of a module to add imported items to',
			},
			{
				displayName: 'Insert Into Module Position',
				name: 'insert_into_module_position',
				type: 'number',
				default: 0,
				description: 'Position within the module to insert items',
			},
			{
				displayName: 'Insert Into Module Type',
				name: 'insert_into_module_type',
				type: 'options',
				options: [
					{ name: 'Assignment', value: 'assignment' },
					{ name: 'Discussion Topic', value: 'discussion_topic' },
					{ name: 'File', value: 'file' },
					{ name: 'Page', value: 'page' },
					{ name: 'Quiz', value: 'quiz' },
				],
				default: 'assignment',
				description: 'Type of content to insert into the module',
			},
			{
				displayName: 'Move To Assignment Group ID',
				name: 'move_to_assignment_group_id',
				type: 'string',
				default: '',
				description: 'The ID of an assignment group to move imported assignments to',
			},
			{
				displayName: 'Overwrite Quizzes',
				name: 'overwrite_quizzes',
				type: 'boolean',
				default: false,
				description: 'Whether to overwrite existing quizzes with the same identifiers',
			},
			{
				displayName: 'Pre-Attachment Name',
				name: 'pre_attachment_name',
				type: 'string',
				default: '',
				description: 'Name of the file to upload (required for file uploads)',
			},
			{
				displayName: 'Question Bank ID',
				name: 'question_bank_id',
				type: 'string',
				default: '',
				description: 'The ID of an existing question bank to add questions to',
			},
			{
				displayName: 'Question Bank Name',
				name: 'question_bank_name',
				type: 'string',
				default: '',
				description: 'Name of a new question bank to create',
			},
			{
				displayName: 'Selective Import',
				name: 'selective_import',
				type: 'boolean',
				default: false,
				description: 'Whether to perform selective import (get package contents first)',
			},
		],
	},

	// ----------------------------------
	//         contentMigration: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Workflow State',
				name: 'workflow_state',
				type: 'options',
				options: [
					{ name: 'Queued', value: 'queued' },
					{ name: 'Running', value: 'running' },
					{ name: 'Waiting for Select', value: 'waiting_for_select' },
				],
				default: 'queued',
				description: 'The state of the migration workflow',
			},
		],
	},
];
