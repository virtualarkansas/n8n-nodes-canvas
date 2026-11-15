import type { INodeProperties } from 'n8n-workflow';

export const coursePaceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['coursePace'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a pace for a course, a section or a single student',
				action: 'Create a course pace',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a course pace',
				action: 'Delete a course pace',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a course pace by its ID',
				action: 'Get a course pace',
			},
			{
				name: 'Get by Context',
				value: 'getByContext',
				description:
					'Get the pace of the course, a section or a student enrollment. Returns an unsaved draft (ID null) when none exists yet.',
				action: 'Get a course pace by context',
			},
			{
				name: 'List Pace Contexts',
				value: 'listContexts',
				description:
					'List what can be paced in a course (the course, its sections or its students), each with the pace that applies to it',
				action: 'List pace contexts of a course',
			},
			{
				name: 'Publish',
				value: 'publish',
				description: 'Publish a course pace, which recalculates the due dates of the affected students',
				action: 'Publish a course pace',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a course pace',
				action: 'Update a course pace',
			},
		],
		default: 'get',
	},
];

const daysToSkip: INodeProperties = {
	displayName: 'Selected Days to Skip',
	name: 'selected_days_to_skip',
	type: 'string',
	default: '',
	placeholder: 'sat,sun',
	description:
		'Comma-separated list of week days without course work, as three-letter names (mon, tue, wed, thu, fri, sat, sun)',
};

const paceWorkflowState: INodeProperties = {
	displayName: 'Workflow State',
	name: 'workflow_state',
	type: 'options',
	options: [
		{ name: 'Active', value: 'active' },
		{ name: 'Unpublished', value: 'unpublished' },
	],
	default: 'unpublished',
	description:
		'The state of the pace. Setting it to "Active" also publishes the pace when Canvas keeps new paces as drafts.',
};

export const coursePaceFields: INodeProperties[] = [
	// ----------------------------------
	//         coursePace: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['coursePace'],
			},
		},
		description:
			'The ID of the course. Course Pacing must be enabled in the course settings, otherwise Canvas answers "not found".',
	},
	{
		displayName: 'Course Pace ID',
		name: 'coursePaceId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['coursePace'],
				operation: ['get', 'update', 'delete', 'publish'],
			},
		},
		description: 'The ID of the course pace. Use "Get by Context" to look it up.',
	},

	// ----------------------------------
	//         coursePace: listContexts
	// ----------------------------------
	{
		displayName: 'Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'section',
		options: [
			{ name: 'Course', value: 'course', description: 'The course itself (one entry)' },
			{ name: 'Section', value: 'section', description: 'The active sections of the course' },
			{
				name: 'Student Enrollment',
				value: 'student_enrollment',
				description: 'The students of the course, one entry per student',
			},
		],
		displayOptions: {
			show: {
				resource: ['coursePace'],
				operation: ['listContexts'],
			},
		},
		description:
			'The kind of pace context to list. Each entry has the name, the ID of the section or enrollment ("item_id") and the pace that applies to it ("applied_pace").',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['coursePace'],
				operation: ['listContexts'],
			},
		},
		options: [
			{
				displayName: 'Context IDs',
				name: 'context_ids',
				type: 'string',
				default: '',
				placeholder: '12,15',
				description:
					'Comma-separated list of section IDs (type Section) or enrollment IDs (type Student Enrollment): only return these',
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
				description: 'The direction to sort in',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Only return sections or students whose name contains this text',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [{ name: 'Name', value: 'name' }],
				default: 'name',
				description:
					'Sort sections by their name. Canvas returns students in the order of their user IDs whether or not this is set.',
			},
		],
	},

	// ----------------------------------
	//         coursePace: getByContext
	// ----------------------------------
	{
		displayName: 'Pace For',
		name: 'paceContext',
		type: 'options',
		required: true,
		default: 'course',
		options: [
			{ name: 'Course', value: 'course', description: 'The default pace of the course' },
			{ name: 'Section', value: 'section', description: 'The pace of a course section' },
			{
				name: 'Student Enrollment',
				value: 'enrollment',
				description: 'The pace of a single student',
			},
		],
		displayOptions: {
			show: {
				resource: ['coursePace'],
				operation: ['getByContext'],
			},
		},
		description: 'Whose pace to return',
	},
	{
		displayName: 'Section ID',
		name: 'sectionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['coursePace'],
				operation: ['getByContext'],
				paceContext: ['section'],
			},
		},
		description: 'The ID of the course section',
	},
	{
		displayName: 'Enrollment ID',
		name: 'enrollmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['coursePace'],
				operation: ['getByContext'],
				paceContext: ['enrollment'],
			},
		},
		description: 'The ID of the student enrollment (not the user ID)',
	},

	// ----------------------------------
	//         coursePace: create
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['coursePace'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Context ID',
				name: 'context_id',
				type: 'string',
				default: '',
				description:
					'The ID of the section (context type "Section") or the user ID of the student (context type "Student"). Leave empty for the default pace of the course.',
			},
			{
				displayName: 'Context Type',
				name: 'context_type',
				type: 'options',
				options: [
					{ name: 'Course', value: 'Course' },
					{ name: 'Section', value: 'Section' },
					{ name: 'Student', value: 'Enrollment' },
				],
				default: 'Course',
				description: 'Whether the pace applies to the whole course, one section or one student',
			},
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				description: 'The date by which the pace must be completed (used with "Hard End Dates")',
			},
			{
				displayName: 'Exclude Weekends',
				name: 'exclude_weekends',
				type: 'boolean',
				default: true,
				description: 'Whether to skip weekend days in pacing calculations',
			},
			{
				displayName: 'Hard End Dates',
				name: 'hard_end_dates',
				type: 'boolean',
				default: false,
				description: 'Whether the pace has to end on the end date',
			},
			daysToSkip,
			paceWorkflowState,
		],
	},
	{
		displayName: 'Module Item Durations',
		name: 'moduleItems',
		type: 'fixedCollection',
		placeholder: 'Add Module Item',
		default: {},
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				resource: ['coursePace'],
				operation: ['create'],
			},
		},
		description: 'How many days students get for each module item',
		options: [
			{
				displayName: 'Module Item',
				name: 'item',
				values: [
					{
						displayName: 'Module Item ID',
						name: 'module_item_id',
						type: 'string',
						default: '',
						description: 'The ID of the module item (it must be linked to an assignment, quiz or graded discussion)',
					},
					{
						displayName: 'Duration (Days)',
						name: 'duration',
						type: 'number',
						default: 1,
						typeOptions: {
							minValue: 0,
						},
						description: 'The number of days planned for this module item',
					},
				],
			},
		],
	},

	// ----------------------------------
	//         coursePace: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['coursePace'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				description: 'The date by which the pace must be completed (used with "Hard End Dates")',
			},
			{
				displayName: 'Exclude Weekends',
				name: 'exclude_weekends',
				type: 'boolean',
				default: true,
				description: 'Whether to skip weekend days in pacing calculations',
			},
			{
				displayName: 'Hard End Dates',
				name: 'hard_end_dates',
				type: 'boolean',
				default: false,
				description: 'Whether the pace has to end on the end date',
			},
			daysToSkip,
			paceWorkflowState,
		],
	},
	{
		displayName: 'Module Item Durations',
		name: 'moduleItems',
		type: 'fixedCollection',
		placeholder: 'Add Module Item',
		default: {},
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				resource: ['coursePace'],
				operation: ['update'],
			},
		},
		description: 'How many days students get for each module item',
		options: [
			{
				displayName: 'Module Item',
				name: 'item',
				values: [
					{
						displayName: 'Pace Item ID',
						name: 'id',
						type: 'string',
						default: '',
						description:
							'The ID of the existing entry of the pace (the "ID" in the pace\'s module "items" list). Required to change an entry; leave empty to add a module item to the pace.',
					},
					{
						displayName: 'Module Item ID',
						name: 'module_item_id',
						type: 'string',
						default: '',
						description: 'The ID of the module item',
					},
					{
						displayName: 'Duration (Days)',
						name: 'duration',
						type: 'number',
						default: 1,
						typeOptions: {
							minValue: 0,
						},
						description: 'The number of days planned for this module item',
					},
				],
			},
		],
	},
];
