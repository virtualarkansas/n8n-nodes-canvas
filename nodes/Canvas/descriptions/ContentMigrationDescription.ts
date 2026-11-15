import type { INodeProperties } from 'n8n-workflow';

const CONTEXT_OPERATIONS = [
	'create',
	'get',
	'getAll',
	'getIssue',
	'getIssues',
	'getSelectiveData',
	'listMigrators',
	'update',
	'updateIssue',
];

/**
 * Settings of a migration. Create and Update take the same ones ("Update a
 * content migration takes the same arguments as create").
 */
const migrationSettingFields: INodeProperties[] = [
	{
		displayName: 'Content Export ID',
		name: 'content_export_id',
		type: 'string',
		default: '',
		description:
			'The ID of a finished content export to import, instead of uploading its file again. For the migration types that need a file.',
	},
	{
		displayName: 'Date Shift Options - Day Substitutions',
		name: 'date_shift_options_day_substitutions',
		type: 'json',
		default: '{}',
		description:
			'Move everything scheduled on one weekday to another, as a JSON object of day numbers (0 = Sunday ... 6 = Saturday), e.g. {"1": 2} moves Monday to Tuesday. Needs Shift Dates.',
	},
	{
		displayName: 'Date Shift Options - New End Date',
		name: 'date_shift_options_new_end_date',
		type: 'dateTime',
		default: '',
		description: 'The new end date for the content/course',
	},
	{
		displayName: 'Date Shift Options - New Start Date',
		name: 'date_shift_options_new_start_date',
		type: 'dateTime',
		default: '',
		description: 'The new start date for the content/course',
	},
	{
		displayName: 'Date Shift Options - Old End Date',
		name: 'date_shift_options_old_end_date',
		type: 'dateTime',
		default: '',
		description: 'The original end date of the source content/course',
	},
	{
		displayName: 'Date Shift Options - Old Start Date',
		name: 'date_shift_options_old_start_date',
		type: 'dateTime',
		default: '',
		description: 'The original start date of the source content/course',
	},
	{
		displayName: 'Date Shift Options - Remove Dates',
		name: 'date_shift_options_remove_dates',
		type: 'boolean',
		default: false,
		description:
			'Whether to remove all dates from the imported content. Cannot be combined with Shift Dates.',
	},
	{
		displayName: 'Date Shift Options - Shift Dates',
		name: 'date_shift_options_shift_dates',
		type: 'boolean',
		default: false,
		description:
			'Whether to shift the dates of the imported content from the old to the new start and end dates',
	},
	{
		displayName: 'File URL',
		name: 'file_url',
		type: 'string',
		default: '',
		description:
			'A URL Canvas downloads the file to import from. Must not require authentication. For the migration types that need a file.',
	},
	{
		displayName: 'Folder ID',
		name: 'folder_id',
		type: 'string',
		default: '',
		description: 'The folder to unzip the file into. Required for the ZIP File migration type.',
	},
	{
		displayName: 'Import Blueprint Settings',
		name: 'import_blueprint_settings',
		type: 'boolean',
		default: false,
		description:
			'Whether to also import the "blueprint course" setting and the locked items of the source. The destination must not be associated with a blueprint and must have no students or observers.',
	},
	{
		displayName: 'Importer Skips',
		name: 'importer_skips',
		type: 'multiOptions',
		options: [
			{ name: 'All Course Settings', value: 'all_course_settings' },
			{ name: 'Visibility Settings', value: 'visibility_settings' },
		],
		default: [],
		description: 'Parts of the source that are not imported even if selected otherwise',
	},
	{
		displayName: 'Insert Into Module ID',
		name: 'insert_into_module_id',
		type: 'string',
		default: '',
		description:
			'The ID of a module in the destination course. Every imported item that can be in a module is added to it.',
	},
	{
		displayName: 'Insert Into Module Position',
		name: 'insert_into_module_position',
		type: 'number',
		default: 1,
		description:
			'The 1-based position in the module at which the imported items are inserted (default: the end). Needs Insert Into Module ID.',
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
		description:
			'Only add imported objects of this type to the module. Needs Insert Into Module ID.',
	},
	{
		displayName: 'Move To Assignment Group ID',
		name: 'move_to_assignment_group_id',
		type: 'string',
		default: '',
		description:
			'The ID of an assignment group in the destination course into which every imported assignment is moved',
	},
	{
		displayName: 'Overwrite Quizzes',
		name: 'overwrite_quizzes',
		type: 'boolean',
		default: false,
		description:
			'Whether to overwrite quizzes that have the same identifiers in the destination and in the content package',
	},
	{
		displayName: 'Pre-Attachment Name',
		name: 'pre_attachment_name',
		type: 'string',
		default: '',
		description:
			'The name of a file you are going to upload yourself. Canvas answers with "pre_attachment.upload_url" and "upload_params"; the migration starts once the file has been posted there (e.g. with an HTTP Request node). Prefer File URL or Content Export ID where possible.',
	},
	{
		displayName: 'Pre-Attachment Size',
		name: 'pre_attachment_size',
		type: 'number',
		default: 0,
		description: 'The size in bytes of the file announced with Pre-Attachment Name',
	},
	{
		displayName: 'Question Bank ID',
		name: 'question_bank_id',
		type: 'string',
		default: '',
		description:
			'The ID of an existing question bank to import questions into when the package does not name one',
	},
	{
		displayName: 'Question Bank Name',
		name: 'question_bank_name',
		type: 'string',
		default: '',
		description:
			'The name of the question bank to import questions into when the package does not name one (created if missing). Question Bank ID wins if both are set.',
	},
	{
		displayName: 'Selective Import',
		name: 'selective_import',
		type: 'boolean',
		default: false,
		description:
			'Whether to stop in the state "waiting_for_select" instead of importing everything. Then list the content with Get Selective Data and start the import with Update and its Copy Properties.',
	},
];

/** Create additionally offers the direct selection that only a course copy supports. */
const createSettingFields: INodeProperties[] = [
	...migrationSettingFields,
	{
		displayName: 'Select',
		name: 'select',
		type: 'json',
		default: '{}',
		description:
			'Course Copy only: copy just these objects, as a JSON object of ID lists by type, e.g. {"assignments": [12, 13], "pages": [4], "modules": [7]}. Types: folders, files, attachments, quizzes, assignments, announcements, calendar_events, discussion_topics, modules, module_items, pages, rubrics.',
	} as INodeProperties,
].sort((a, b) => a.displayName.localeCompare(b.displayName));

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
				description:
					'Start a content migration (course copy or import of a package). It runs in the background: follow its "progress_url" with Progress > Get.',
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
				description:
					'For a finished course copy or blueprint import: which ID each copied object has in the destination course',
				action: 'Get the asset ID mapping of a content migration',
			},
			{
				name: 'Get Issue',
				value: 'getIssue',
				description: 'Get a single warning or error a content migration produced',
				action: 'Get an issue of a content migration',
			},
			{
				name: 'Get Issues',
				value: 'getIssues',
				description: 'Get the warnings and errors a content migration produced',
				action: 'Get the issues of a content migration',
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
				description:
					'List the content of a migration that waits for a selection, with the copy property of each item',
				action: 'Get the selective data of a content migration',
			},
			{
				name: 'List Migrators',
				value: 'listMigrators',
				description: 'Get the migration types available in a context',
				action: 'List the migration systems',
			},
			{
				name: 'Update',
				value: 'update',
				description:
					'Start a selective import (Copy Properties) or change the settings of a migration. Updating always queues the migration again; without Copy Properties everything is imported.',
				action: 'Update a content migration',
			},
			{
				name: 'Update Issue',
				value: 'updateIssue',
				description: 'Mark an issue of a content migration as resolved or active',
				action: 'Update an issue of a content migration',
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
				operation: CONTEXT_OPERATIONS,
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
		description:
			'The context to migrate content into. Courses accept every migration type; accounts only question bank imports (QTI), groups and users only ZIP files. List Migrators shows what a context accepts.',
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
				operation: CONTEXT_OPERATIONS,
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
				operation: CONTEXT_OPERATIONS,
				contextType: ['course'],
			},
		},
		description: 'The ID of the course (for a course copy: the destination course)',
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
				operation: ['getAssetIdMapping'],
			},
		},
		description: 'The ID of the destination course of the migration',
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
				operation: CONTEXT_OPERATIONS,
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
		default: 'self',
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: CONTEXT_OPERATIONS,
				contextType: ['user'],
			},
		},
		description: 'The ID of the user, or "self" for the token\'s user',
	},
	{
		displayName: 'Content Migration ID',
		name: 'contentMigrationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: [
					'get',
					'getAssetIdMapping',
					'getIssue',
					'getIssues',
					'getSelectiveData',
					'update',
					'updateIssue',
				],
			},
		},
		description: 'The ID of the content migration',
	},

	// ----------------------------------
	//         contentMigration: create
	// ----------------------------------
	{
		displayName: 'Migration Type',
		name: 'migrationType',
		type: 'options',
		required: true,
		default: 'course_copy_importer',
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
				description: 'A Canvas course export package (.imscc). Needs a file.',
			},
			{
				name: 'Common Cartridge',
				value: 'common_cartridge_importer',
				description: 'A Common Cartridge 1.x package. Needs a file.',
			},
			{
				name: 'Course Copy',
				value: 'course_copy_importer',
				description: 'Copy content from another Canvas course',
			},
			{
				name: 'Moodle',
				value: 'moodle_converter',
				description: 'A Moodle 1.9/2.x backup. Needs a file.',
			},
			{
				name: 'QTI',
				value: 'qti_converter',
				description: 'A QTI .zip file with quizzes or question banks. Needs a file.',
			},
			{
				name: 'ZIP File',
				value: 'zip_file_importer',
				description: 'Unzip a .zip file into a folder. Needs a file and a Folder ID.',
			},
		],
		description:
			'The kind of migration. The types that need a file take it from File URL, Content Export ID or an upload announced with Pre-Attachment Name (Additional Fields).',
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
		description: 'The ID of the course to copy from',
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
		options: createSettingFields,
	},

	// ----------------------------------
	//         contentMigration: update
	// ----------------------------------
	{
		displayName: 'Copy Properties',
		name: 'copyProperties',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: ['update'],
			},
		},
		description:
			'What to import, for a migration in the state "waiting_for_select": comma-separated "property" values from Get Selective Data, e.g. "copy[all_assignments], copy[wiki_pages][id_i6314c45816f1cc6d9519d88e4b7f64ab]". Left empty, everything is imported.',
	},
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
		description:
			'Most settings have no effect once the migration has started; they are mainly for a migration whose file upload failed or that waits for a selection',
		options: migrationSettingFields,
	},

	// ----------------------------------
	//         contentMigration: getSelectiveData
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: ['getSelectiveData'],
			},
		},
		options: [
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: [
					{ name: 'Announcements', value: 'announcements' },
					{ name: 'Assignments', value: 'assignments' },
					{ name: 'Calendar Events', value: 'calendar_events' },
					{ name: 'Discussion Topics', value: 'discussion_topics' },
					{ name: 'External Tools', value: 'context_external_tools' },
					{ name: 'Files', value: 'attachments' },
					{ name: 'Groups', value: 'groups' },
					{ name: 'Learning Outcomes', value: 'learning_outcomes' },
					{ name: 'Modules', value: 'context_modules' },
					{ name: 'Pages', value: 'wiki_pages' },
					{ name: 'Question Banks', value: 'assessment_question_banks' },
					{ name: 'Quizzes', value: 'quizzes' },
					{ name: 'Rubrics', value: 'rubrics' },
					{ name: 'Tool Profiles', value: 'tool_profiles' },
				],
				default: 'assignments',
				description:
					'List the items of one type. Without it the result is one item per type with its copy property and the number of items.',
			},
		],
	},

	// ----------------------------------
	//         contentMigration: updateIssue
	// ----------------------------------
	{
		displayName: 'Issue ID',
		name: 'issueId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: ['getIssue', 'updateIssue'],
			},
		},
		description: 'The ID of the migration issue (from Get Issues)',
	},
	{
		displayName: 'State',
		name: 'issueState',
		type: 'options',
		required: true,
		default: 'resolved',
		displayOptions: {
			show: {
				resource: ['contentMigration'],
				operation: ['updateIssue'],
			},
		},
		options: [
			{ name: 'Active', value: 'active' },
			{ name: 'Resolved', value: 'resolved' },
		],
		description: 'Whether the issue still needs attention',
	},
];
