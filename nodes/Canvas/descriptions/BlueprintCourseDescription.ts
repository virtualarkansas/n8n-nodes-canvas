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
				description:
					'Start a sync that pushes the changes of a blueprint course to its associated courses. It runs in the background: check it with Get Migration. Only one sync can run at a time.',
				action: 'Begin a blueprint migration',
			},
			{
				name: 'Get Associated Courses',
				value: 'getAssociatedCourses',
				description: 'Get the courses that receive updates from a blueprint course',
				action: 'Get associated courses',
			},
			{
				name: 'Get Import Details',
				value: 'getImportDetails',
				description:
					'Get the changes one sync brought into an associated course, including the items skipped because they were changed locally',
				action: 'Get blueprint import details',
			},
			{
				name: 'Get Many Imports',
				value: 'getAllImports',
				description: 'Get the syncs an associated course has received from its blueprint, newest first',
				action: 'Get many blueprint imports',
			},
			{
				name: 'Get Many Migrations',
				value: 'getAllMigrations',
				description: 'Get the syncs a blueprint course has pushed, newest first',
				action: 'Get many blueprint migrations',
			},
			{
				name: 'Get Migration',
				value: 'getMigration',
				description:
					'Get one sync of a blueprint course. Its "workflow_state" goes from "queued" over "exporting" and "imports_queued" to "completed".',
				action: 'Get a blueprint migration',
			},
			{
				name: 'Get Migration Details',
				value: 'getMigrationDetails',
				description: 'Get the changes one sync of a blueprint course pushed to its associated courses',
				action: 'Get blueprint migration details',
			},
			{
				name: 'Get Subscriptions',
				value: 'getSubscriptions',
				description: 'Get the blueprint an associated course is subscribed to',
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
				description:
					'Get the changes made in a blueprint course since its last sync (what the next sync will push)',
				action: 'Get unsynced blueprint changes',
			},
			{
				name: 'Set Restrictions',
				value: 'setRestrictions',
				description:
					'Lock or unlock one object of a blueprint course so that its copies in associated courses can no longer be edited',
				action: 'Set blueprint restrictions',
			},
			{
				name: 'Show Import',
				value: 'showImport',
				description: 'Get one sync an associated course has received from its blueprint',
				action: 'Show a blueprint import',
			},
			{
				name: 'Update Associations',
				value: 'updateAssociations',
				description:
					'Add courses to or remove courses from a blueprint course. Start a sync afterwards to fill newly added courses.',
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
		description:
			'The ID of the blueprint subscription of the associated course (use "default" for its active subscription)',
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
		description:
			'The ID of the sync. For a blueprint course: the ID from Begin Migration / Get Many Migrations. For an associated course: the ID from Get Many Imports (a different number for the same sync).',
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
				description: 'A comment to include in the sync history',
			},
			{
				displayName: 'Copy Settings',
				name: 'copy_settings',
				type: 'boolean',
				default: true,
				description:
					'Whether to copy the course settings to the associated courses as well (Canvas does this by default for newly associated courses)',
			},
			{
				displayName: 'Publish After Initial Sync',
				name: 'publish_after_initial_sync',
				type: 'boolean',
				default: false,
				description: 'Whether to publish newly associated courses once their first sync has completed',
			},
			{
				displayName: 'Send Item Notifications',
				name: 'send_item_notifications',
				type: 'boolean',
				default: false,
				description:
					'Whether teachers and students get the usual notifications for items the sync creates. Needs the Blueprint Item Notifications feature; without it the option is ignored.',
			},
			{
				displayName: 'Send Notification',
				name: 'send_notification',
				type: 'boolean',
				default: false,
				description: 'Whether to notify the token\'s user when the sync has completed',
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
		description:
			'Comma-separated IDs of the courses to associate. They must belong to the account of the blueprint course (or a sub-account), must not be blueprints and must not be associated with another blueprint.',
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
		description:
			'Comma-separated IDs of the courses to remove from the blueprint. Not possible while a sync is running.',
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
				name: 'Course Pace',
				value: 'course_pace',
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
		description:
			'Whether the object is locked. Without Restriction Options the lock settings of the blueprint course apply.',
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
			{
				displayName: 'Settings',
				name: 'settings',
				type: 'boolean',
				default: false,
				description: 'Whether to lock the settings of the object',
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'boolean',
				default: false,
				description: 'Whether to lock the published state',
			},
		],
	},
];
