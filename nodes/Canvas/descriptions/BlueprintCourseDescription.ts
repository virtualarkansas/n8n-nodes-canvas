import type { INodeProperties } from 'n8n-workflow';

export const blueprintCourseOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['blueprintCourse'],
			},
		},
		options: [
			{
				name: 'Begin Migration',
				value: 'beginMigration',
				description: 'Begin a migration to sync blueprint changes',
				action: 'Begin a blueprint migration',
			},
			{
				name: 'Get Associated Courses',
				value: 'getAssociatedCourses',
				description: 'Get courses associated with a blueprint',
				action: 'Get associated courses',
			},
			{
				name: 'Get Import Details',
				value: 'getImportDetails',
				description: 'Get details about a blueprint import',
				action: 'Get blueprint import details',
			},
			{
				name: 'Get Many Imports',
				value: 'getAllImports',
				description: 'Get many blueprint imports for a subscription',
				action: 'Get many blueprint imports',
			},
			{
				name: 'Get Many Migrations',
				value: 'getAllMigrations',
				description: 'Get many blueprint migrations',
				action: 'Get many blueprint migrations',
			},
			{
				name: 'Get Migration',
				value: 'getMigration',
				description: 'Get a blueprint migration status',
				action: 'Get a blueprint migration',
			},
			{
				name: 'Get Migration Details',
				value: 'getMigrationDetails',
				description: 'Get details about a blueprint migration',
				action: 'Get blueprint migration details',
			},
			{
				name: 'Get Subscriptions',
				value: 'getSubscriptions',
				description: 'Get blueprint subscriptions for a course',
				action: 'Get blueprint subscriptions',
			},
			{
				name: 'Get Template',
				value: 'getTemplate',
				description: 'Get blueprint template information',
				action: 'Get a blueprint template',
			},
			{
				name: 'Get Unsynced Changes',
				value: 'getUnsyncedChanges',
				description: 'Get unsynced changes for a blueprint',
				action: 'Get unsynced blueprint changes',
			},
			{
				name: 'Set Restrictions',
				value: 'setRestrictions',
				description: 'Set or remove restrictions on blueprint content',
				action: 'Set blueprint restrictions',
			},
			{
				name: 'Show Import',
				value: 'showImport',
				description: 'Show a blueprint import status',
				action: 'Show a blueprint import',
			},
			{
				name: 'Update Associations',
				value: 'updateAssociations',
				description: 'Update associated courses for a blueprint',
				action: 'Update blueprint associations',
			},
		],
		default: 'getTemplate',
	},
];

export const blueprintCourseFields: INodeProperties[] = [
	// ----------------------------------
	//         blueprintCourse: shared - course ID for template operations
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['blueprintCourse'],
				operation: [
					'beginMigration',
					'getAssociatedCourses',
					'getAllImports',
					'getAllMigrations',
					'getImportDetails',
					'getMigration',
					'getMigrationDetails',
					'getSubscriptions',
					'getTemplate',
					'getUnsyncedChanges',
					'setRestrictions',
					'showImport',
					'updateAssociations',
				],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         blueprintCourse: template ID for template operations
	// ----------------------------------
	{
		displayName: 'Template ID',
		name: 'templateId',
		type: 'string',
		required: true,
		default: 'default',
		displayOptions: {
			show: {
				resource: ['blueprintCourse'],
				operation: [
					'beginMigration',
					'getAssociatedCourses',
					'getAllMigrations',
					'getMigration',
					'getMigrationDetails',
					'getTemplate',
					'getUnsyncedChanges',
					'setRestrictions',
					'updateAssociations',
				],
			},
		},
		description: 'The ID of the blueprint template (use "default" for the default template)',
	},

	// ----------------------------------
	//         blueprintCourse: subscription ID for subscription operations
	// ----------------------------------
	{
		displayName: 'Subscription ID',
		name: 'subscriptionId',
		type: 'string',
		required: true,
		default: 'default',
		displayOptions: {
			show: {
				resource: ['blueprintCourse'],
				operation: ['getAllImports', 'getImportDetails', 'showImport'],
			},
		},
		description: 'The ID of the blueprint subscription (use "default" for the active subscription)',
	},

	// ----------------------------------
	//         blueprintCourse: migration ID for migration operations
	// ----------------------------------
	{
		displayName: 'Migration ID',
		name: 'migrationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['blueprintCourse'],
				operation: ['getImportDetails', 'getMigration', 'getMigrationDetails', 'showImport'],
			},
		},
		description: 'The ID of the blueprint migration',
	},

	// ----------------------------------
	//         blueprintCourse: beginMigration
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['blueprintCourse'],
				operation: ['beginMigration'],
			},
		},
		options: [
			{
				displayName: 'Comment',
				name: 'comment',
				type: 'string',
				default: '',
				description: 'A comment to add to the migration',
			},
			{
				displayName: 'Copy Settings',
				name: 'copy_settings',
				type: 'boolean',
				default: true,
				description: 'Whether to copy course settings as part of the migration',
			},
			{
				displayName: 'Publish After Initial Sync',
				name: 'publish_after_initial_sync',
				type: 'boolean',
				default: false,
				description: 'Whether to publish associated courses after their initial sync',
			},
			{
				displayName: 'Send Item Notifications',
				name: 'send_item_notifications',
				type: 'boolean',
				default: false,
				description: 'Whether to send notifications about new content items',
			},
			{
				displayName: 'Send Notification',
				name: 'send_notification',
				type: 'boolean',
				default: false,
				description: 'Whether to send a notification about the migration',
			},
		],
	},

	// ----------------------------------
	//         blueprintCourse: updateAssociations
	// ----------------------------------
	{
		displayName: 'Course IDs to Add',
		name: 'courseIdsToAdd',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['blueprintCourse'],
				operation: ['updateAssociations'],
			},
		},
		description: 'Comma-separated list of course IDs to associate with the blueprint',
	},
	{
		displayName: 'Course IDs to Remove',
		name: 'courseIdsToRemove',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['blueprintCourse'],
				operation: ['updateAssociations'],
			},
		},
		description: 'Comma-separated list of course IDs to remove from the blueprint association',
	},

	// ----------------------------------
	//         blueprintCourse: setRestrictions
	// ----------------------------------
	{
		displayName: 'Content Type',
		name: 'contentType',
		type: 'options',
		required: true,
		default: 'assignment',
		displayOptions: {
			show: {
				resource: ['blueprintCourse'],
				operation: ['setRestrictions'],
			},
		},
		options: [
			{
				name: 'Assignment',
				value: 'assignment',
			},
			{
				name: 'Attachment',
				value: 'attachment',
			},
			{
				name: 'Discussion Topic',
				value: 'discussion_topic',
			},
			{
				name: 'External Tool',
				value: 'external_tool',
			},
			{
				name: 'LTI Quiz',
				value: 'lti-quiz',
			},
			{
				name: 'Quiz',
				value: 'quiz',
			},
			{
				name: 'Wiki Page',
				value: 'wiki_page',
			},
		],
		description: 'The type of content to set restrictions on',
	},
	{
		displayName: 'Content ID',
		name: 'contentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['blueprintCourse'],
				operation: ['setRestrictions'],
			},
		},
		description: 'The ID of the content item to set restrictions on',
	},
	{
		displayName: 'Restricted',
		name: 'restricted',
		type: 'boolean',
		required: true,
		default: true,
		displayOptions: {
			show: {
				resource: ['blueprintCourse'],
				operation: ['setRestrictions'],
			},
		},
		description: 'Whether to apply restrictions to the content',
	},
	{
		displayName: 'Restriction Options',
		name: 'restrictions',
		type: 'collection',
		placeholder: 'Add Restriction',
		default: {},
		displayOptions: {
			show: {
				resource: ['blueprintCourse'],
				operation: ['setRestrictions'],
				restricted: [true],
			},
		},
		options: [
			{
				displayName: 'Availability Dates',
				name: 'availability_dates',
				type: 'boolean',
				default: false,
				description: 'Whether to lock availability dates',
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'boolean',
				default: false,
				description: 'Whether to lock the content',
			},
			{
				displayName: 'Due Dates',
				name: 'due_dates',
				type: 'boolean',
				default: false,
				description: 'Whether to lock due dates',
			},
			{
				displayName: 'Points',
				name: 'points',
				type: 'boolean',
				default: false,
				description: 'Whether to lock the points value',
			},
		],
	},
];
