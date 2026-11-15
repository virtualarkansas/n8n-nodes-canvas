import type { INodeProperties } from 'n8n-workflow';
import { downloadFields, waitFields } from './shared';

/** One "Select ..." field per object type Canvas can export selectively. */
function selectField(displayName: string, type: string, what: string, exportTypes: string): INodeProperties {
	const description = `Comma-separated IDs of the ${what} to export. Without any Select field everything is exported. ${exportTypes}.`;
	return {
		displayName: `Select ${displayName}`,
		name: `select_${type}`,
		type: 'string',
		default: '',
		description,
	};
}

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
				description:
					'Start an export job. It runs in the background: follow its "progress_url" with Progress > Get, then Get the export for the download URL.',
				action: 'Create a content export',
			},
			{
				name: 'Get',
				value: 'get',
				description:
					'Get a content export. Once it has finished, its "attachment" holds the download URL of the exported file.',
				action: 'Get a content export',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the content exports of a course, group or user, newest first',
				action: 'Get many content exports',
			},
			{
				name: 'Get Selectable Content',
				value: 'getContentList',
				description:
					'List what a course contains, by type, to pick the objects for a selective export or course copy',
				action: 'Get the selectable content of a course',
			},
			{
				name: 'Wait for Completion',
				value: 'waitForCompletion',
				description:
					'Check the export again and again until Canvas has finished it (or it has failed), then output it with its file',
				action: 'Wait for a content export to complete',
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
				operation: ['create', 'get', 'getAll', 'waitForCompletion'],
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
		description:
			'Where to export from. Courses can be exported as a cartridge, as QTI or as a zip of their files; groups and users only as a zip of their files.',
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
				operation: ['create', 'get', 'getAll', 'waitForCompletion'],
				contextType: ['course'],
			},
		},
		description: 'The ID of the course',
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
				operation: ['getContentList'],
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
				operation: ['create', 'get', 'getAll', 'waitForCompletion'],
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
				resource: ['contentExport'],
				operation: ['create', 'get', 'getAll', 'waitForCompletion'],
				contextType: ['user'],
			},
		},
		description: 'The ID of the user, or "self" for the token\'s user',
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
				operation: ['get', 'waitForCompletion'],
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
				contextType: ['course'],
			},
		},
		options: [
			{
				name: 'Common Cartridge',
				value: 'common_cartridge',
				description: 'The contents of the course in the Common Cartridge (.imscc) format',
			},
			{
				name: 'QTI',
				value: 'qti',
				description: 'The quizzes of the course in the QTI format',
			},
			{
				name: 'ZIP',
				value: 'zip',
				description: 'The files of the course in a zip file',
			},
		],
		description: 'The format of the export',
	},
	{
		displayName: 'Export Type',
		name: 'exportType',
		type: 'options',
		required: true,
		default: 'zip',
		displayOptions: {
			show: {
				resource: ['contentExport'],
				operation: ['create'],
				contextType: ['group', 'user'],
			},
		},
		options: [
			{
				name: 'ZIP',
				value: 'zip',
				description: 'The files of the group or user in a zip file',
			},
		],
		description: 'The format of the export. Groups and users can only export their files.',
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
			selectField('Announcements', 'announcements', 'announcements', 'Common Cartridge only'),
			selectField('Assignments', 'assignments', 'assignments', 'Common Cartridge only'),
			selectField(
				'Attachments',
				'attachments',
				'files (same as Select Files)',
				'Common Cartridge only',
			),
			selectField(
				'Calendar Events',
				'calendar_events',
				'calendar events',
				'Common Cartridge only',
			),
			selectField(
				'Discussion Topics',
				'discussion_topics',
				'discussion topics',
				'Common Cartridge only',
			),
			selectField('Files', 'files', 'files', 'Common Cartridge and ZIP'),
			selectField('Folders', 'folders', 'folders', 'Common Cartridge and ZIP'),
			selectField('Module Items', 'module_items', 'module items', 'Common Cartridge only'),
			selectField('Modules', 'modules', 'modules', 'Common Cartridge only'),
			selectField(
				'Pages',
				'pages',
				'pages (numeric page IDs, not page URLs)',
				'Common Cartridge only',
			),
			selectField('Quizzes', 'quizzes', 'quizzes', 'Common Cartridge and QTI'),
			selectField('Rubrics', 'rubrics', 'rubrics', 'Common Cartridge only'),
			{
				displayName: 'Skip Notifications',
				name: 'skip_notifications',
				type: 'boolean',
				default: false,
				description:
					'Whether to keep Canvas from notifying the token\'s user when the export has finished',
			},
		],
	},

	// ----------------------------------
	//         contentExport: getContentList
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['contentExport'],
				operation: ['getContentList'],
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
					{ name: 'Learning Outcomes', value: 'learning_outcomes' },
					{ name: 'Modules', value: 'context_modules' },
					{ name: 'Pages', value: 'wiki_pages' },
					{ name: 'Question Banks', value: 'assessment_question_banks' },
					{ name: 'Quizzes', value: 'quizzes' },
					{ name: 'Rubrics', value: 'rubrics' },
				],
				default: 'assignments',
				description:
					'List the objects of one type. Without it the result is one item per type with the number of objects.',
			},
		],
	},
	...waitFields('contentExport'),
	...downloadFields('contentExport', ['get', 'waitForCompletion'], 'the file of a finished export (a Common Cartridge, QTI or zip file)'),
];
