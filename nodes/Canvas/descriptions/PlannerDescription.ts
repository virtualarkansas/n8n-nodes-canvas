import type { INodeProperties } from 'n8n-workflow';

export const plannerOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['planner'],
			},
		},
		options: [
			{
				name: 'Create Note',
				value: 'createNote',
				description: 'Create a planner note',
				action: 'Create a planner note',
			},
			{
				name: 'Create Override',
				value: 'createOverride',
				description: 'Create a planner override',
				action: 'Create a planner override',
			},
			{
				name: 'Delete Note',
				value: 'deleteNote',
				description: 'Delete a planner note',
				action: 'Delete a planner note',
			},
			{
				name: 'Delete Override',
				value: 'deleteOverride',
				description: 'Delete a planner override',
				action: 'Delete a planner override',
			},
			{
				name: 'Get Many Items',
				value: 'getAllItems',
				description: 'Get many planner items',
				action: 'Get many planner items',
			},
			{
				name: 'Get Many Notes',
				value: 'getAllNotes',
				description: 'Get many planner notes',
				action: 'Get many planner notes',
			},
			{
				name: 'Get Many Overrides',
				value: 'getAllOverrides',
				description: 'Get many planner overrides',
				action: 'Get many planner overrides',
			},
			{
				name: 'Get Note',
				value: 'getNote',
				description: 'Get a planner note',
				action: 'Get a planner note',
			},
			{
				name: 'Get Override',
				value: 'getOverride',
				description: 'Get a planner override',
				action: 'Get a planner override',
			},
			{
				name: 'Update Note',
				value: 'updateNote',
				description: 'Update a planner note',
				action: 'Update a planner note',
			},
			{
				name: 'Update Override',
				value: 'updateOverride',
				description: 'Update a planner override',
				action: 'Update a planner override',
			},
		],
		default: 'getAllItems',
	},
];

export const plannerFields: INodeProperties[] = [
	// ----------------------------------
	//         planner: getNote, updateNote, deleteNote
	// ----------------------------------
	{
		displayName: 'Note ID',
		name: 'noteId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['getNote', 'updateNote', 'deleteNote'],
			},
		},
		description: 'The ID of the planner note',
	},

	// ----------------------------------
	//         planner: getOverride, updateOverride, deleteOverride
	// ----------------------------------
	{
		displayName: 'Override ID',
		name: 'overrideId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['getOverride', 'updateOverride', 'deleteOverride'],
			},
		},
		description: 'The ID of the planner override',
	},

	// ----------------------------------
	//         planner: createNote
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['createNote'],
			},
		},
		description: 'The title of the planner note',
	},
	{
		displayName: 'Todo Date',
		name: 'todoDate',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['createNote'],
			},
		},
		description: 'The date when the note is due',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['createNote'],
			},
		},
		options: [
			{
				displayName: 'Course ID',
				name: 'course_id',
				type: 'string',
				default: '',
				description: 'The ID of the course to associate the note with',
			},
			{
				displayName: 'Details',
				name: 'details',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The details or body of the planner note',
			},
			{
				displayName: 'Linked Object ID',
				name: 'linked_object_id',
				type: 'string',
				default: '',
				description: 'The ID of the object to link to',
			},
			{
				displayName: 'Linked Object Type',
				name: 'linked_object_type',
				type: 'string',
				default: '',
				description: 'The type of object to link to (e.g., assignment, discussion_topic)',
			},
		],
	},

	// ----------------------------------
	//         planner: updateNote
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['updateNote'],
			},
		},
		options: [
			{
				displayName: 'Course ID',
				name: 'course_id',
				type: 'string',
				default: '',
				description: 'The ID of the course to associate the note with',
			},
			{
				displayName: 'Details',
				name: 'details',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The details or body of the planner note',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the planner note',
			},
			{
				displayName: 'Todo Date',
				name: 'todo_date',
				type: 'dateTime',
				default: '',
				description: 'The date when the note is due',
			},
		],
	},

	// ----------------------------------
	//         planner: createOverride
	// ----------------------------------
	{
		displayName: 'Plannable Type',
		name: 'plannableType',
		type: 'options',
		required: true,
		default: 'assignment',
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['createOverride'],
			},
		},
		options: [
			{
				name: 'Announcement',
				value: 'announcement',
			},
			{
				name: 'Assignment',
				value: 'assignment',
			},
			{
				name: 'Discussion Topic',
				value: 'discussion_topic',
			},
			{
				name: 'Planner Note',
				value: 'planner_note',
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
		description: 'The type of the plannable item',
	},
	{
		displayName: 'Plannable ID',
		name: 'plannableId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['createOverride'],
			},
		},
		description: 'The ID of the plannable item',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['createOverride'],
			},
		},
		options: [
			{
				displayName: 'Dismissed',
				name: 'dismissed',
				type: 'boolean',
				default: false,
				description: 'Whether the item is dismissed from the planner',
			},
			{
				displayName: 'Marked Complete',
				name: 'marked_complete',
				type: 'boolean',
				default: false,
				description: 'Whether the item is marked as complete',
			},
		],
	},

	// ----------------------------------
	//         planner: updateOverride
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['updateOverride'],
			},
		},
		options: [
			{
				displayName: 'Dismissed',
				name: 'dismissed',
				type: 'boolean',
				default: false,
				description: 'Whether the item is dismissed from the planner',
			},
			{
				displayName: 'Marked Complete',
				name: 'marked_complete',
				type: 'boolean',
				default: false,
				description: 'Whether the item is marked as complete',
			},
		],
	},

	// ----------------------------------
	//         planner: getAllItems - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['getAllItems'],
			},
		},
		options: [
			{
				displayName: 'Context Codes',
				name: 'context_codes',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of context codes (e.g., course_123, user_456) to filter items',
			},
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				description: 'Only return items up to this date',
			},
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'options',
				options: [
					{
						name: 'All Items',
						value: '',
					},
					{
						name: 'Complete Items',
						value: 'complete_items',
					},
					{
						name: 'Incomplete Items',
						value: 'incomplete_items',
					},
					{
						name: 'New Activity',
						value: 'new_activity',
					},
				],
				default: '',
				description: 'Filter items by status',
			},
			{
				displayName: 'Observed User ID',
				name: 'observed_user_id',
				type: 'string',
				default: '',
				description: 'Return planner items for an observed user instead',
			},
			{
				displayName: 'Start Date',
				name: 'start_date',
				type: 'dateTime',
				default: '',
				description: 'Only return items from this date onwards',
			},
			{
				displayName: 'User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description: 'Return planner items for a specific user (requires appropriate permissions)',
			},
		],
	},

	// ----------------------------------
	//         planner: getAllNotes - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['getAllNotes'],
			},
		},
		options: [
			{
				displayName: 'Context Codes',
				name: 'context_codes',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of context codes (e.g., course_123) to filter notes',
			},
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				description: 'Only return notes up to this date',
			},
			{
				displayName: 'Start Date',
				name: 'start_date',
				type: 'dateTime',
				default: '',
				description: 'Only return notes from this date onwards',
			},
		],
	},
];
