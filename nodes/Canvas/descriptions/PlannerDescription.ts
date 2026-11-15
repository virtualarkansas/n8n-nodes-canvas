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
				description: 'Mark a planner item as complete or dismissed for the current user',
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
				description:
					'Get the items on a user\'s planner (assignments, quizzes, pages, discussions, events, notes)',
				action: 'Get many planner items',
			},
			{
				name: 'Get Many Notes',
				value: 'getAllNotes',
				description: 'Get the planner notes of the current user (Canvas returns all of them at once)',
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
		default: '',
		displayOptions: {
			show: {
				resource: ['planner'],
				operation: ['createNote'],
			},
		},
		description:
			'The title of the planner note (at most 255 characters). Required, except when the note is linked to a learning object: left empty, the note then takes the title of that object.',
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
		description:
			'The date and time at which the note appears in the planner. A value without a time zone is read in the time zone of the Canvas user.',
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
				description:
					'The numeric ID of a course to associate the note with. The user must be able to see the course.',
			},
			{
				displayName: 'Details',
				name: 'details',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The text of the planner note',
			},
			{
				displayName: 'Linked Object ID',
				name: 'linked_object_id',
				type: 'string',
				default: '',
				description:
					'The ID of a learning object in the course to link the note to. Needs Linked Object Type and Course ID. Only one note per user can be linked to an object.',
			},
			{
				displayName: 'Linked Object Type',
				name: 'linked_object_type',
				type: 'options',
				options: [
					{ name: 'Announcement', value: 'announcement' },
					{ name: 'Assignment', value: 'assignment' },
					{ name: 'Discussion Topic', value: 'discussion_topic' },
					{ name: 'Quiz', value: 'quiz' },
					{ name: 'Wiki Page', value: 'wiki_page' },
				],
				default: 'assignment',
				description:
					'The type of the learning object to link the note to. Needs Linked Object ID and Course ID.',
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
				description:
					'The numeric ID of the course to associate the note with. Leave empty to detach the note from its course. Cannot be changed for a note linked to a learning object.',
			},
			{
				displayName: 'Details',
				name: 'details',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The text of the planner note',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the planner note (at most 255 characters)',
			},
			{
				displayName: 'Todo Date',
				name: 'todo_date',
				type: 'dateTime',
				default: '',
				description:
					'The date and time at which the note appears in the planner. A value without a time zone is read in the time zone of the Canvas user.',
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
				name: 'Assessment Request (Peer Review)',
				value: 'assessment_request',
			},
			{
				name: 'Assignment',
				value: 'assignment',
			},
			{
				name: 'Calendar Event',
				value: 'calendar_event',
			},
			{
				name: 'Discussion Topic',
				value: 'discussion_topic',
			},
			{
				name: 'Peer Review Sub Assignment',
				value: 'peer_review_sub_assignment',
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
				name: 'Sub Assignment (Discussion Checkpoint)',
				value: 'sub_assignment',
			},
			{
				name: 'Wiki Page',
				value: 'wiki_page',
			},
		],
		description:
			'The type of the item to override (the plannable_type of a planner item). An assignment that is really a graded quiz, discussion or page is stored under that type.',
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
		description:
			'The ID of the item to override (the plannable_id of a planner item). A user can have one override per item.',
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
				description: 'Whether the item is dismissed from the opportunities list',
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
				description:
					'Whether the item is dismissed from the opportunities list. Canvas rewrites both flags on every update: when this field is not added it is saved as false.',
			},
			{
				displayName: 'Marked Complete',
				name: 'marked_complete',
				type: 'boolean',
				default: false,
				description:
					'Whether the item is marked as complete. Canvas rewrites both flags on every update: when this field is not added it is saved as false.',
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
					'Comma-separated context codes of the courses, groups or user whose items to return, e.g. course_123, group_45, user_6. Defaults to all contexts of the user. Concluded courses are ignored unless Include has Concluded.',
			},
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				description:
					'Only return items up to this date (yyyy-mm-dd or ISO 8601). Without Start Date and End Date Canvas returns two weeks before to two weeks after today.',
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
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{
						name: 'Account Calendars',
						value: 'account_calendars',
						description: 'Events of the account calendars the user follows',
					},
					{
						name: 'All Courses',
						value: 'all_courses',
						description: 'Every course of the user, without listing them in Context Codes',
					},
					{
						name: 'Concluded',
						value: 'concluded',
						description: 'Items of concluded courses',
					},
				],
				default: [],
				description: 'Additional contexts to take items from',
			},
			{
				displayName: 'Observed User ID',
				name: 'observed_user_id',
				type: 'string',
				default: '',
				description:
					'For an observer: return the planner items of this observed student. Needs Context Codes with courses in which the observer is linked to the student (or Include: All Courses).',
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
				description: 'Order of the items by date',
			},
			{
				displayName: 'Start Date',
				name: 'start_date',
				type: 'dateTime',
				default: '',
				description:
					'Only return items from this date onwards (yyyy-mm-dd or ISO 8601). Without Start Date and End Date Canvas returns two weeks before to two weeks after today.',
			},
			{
				displayName: 'User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description:
					'Return the planner items of this user instead of the user of the credential. Only the user themselves and observers linked to the user are allowed; admins and teachers are not.',
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
					'Comma-separated context codes of courses whose notes to return, e.g. course_123. Add the user\'s own code (user_6) to include notes that belong to no course.',
			},
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				description: 'Only return notes with a todo date up to the end of this day',
			},
			{
				displayName: 'Start Date',
				name: 'start_date',
				type: 'dateTime',
				default: '',
				description: 'Only return notes with a todo date from this date onwards',
			},
		],
	},
];
