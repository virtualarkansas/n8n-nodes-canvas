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
				description: 'Create a new course pace',
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
				description: 'Get a course pace',
				action: 'Get a course pace',
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
		description: 'The ID of the course',
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
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the course pace',
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
				description: 'The ID of the pace context (course, section, or user)',
			},
			{
				displayName: 'Context Type',
				name: 'context_type',
				type: 'options',
				options: [
					{ name: 'Course', value: 'Course' },
					{ name: 'Section', value: 'Section' },
					{ name: 'User', value: 'User' },
				],
				default: 'Course',
				description: 'The type of context for the pace',
			},
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				description: 'The completion date for the pace',
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
				description: 'Whether to enforce fixed end dates for assignments',
			},
			{
				displayName: 'Selected Days to Skip',
				name: 'selected_days_to_skip',
				type: 'string',
				default: '',
				description: 'Comma-separated list of specific days to exclude (e.g., "monday,friday")',
			},
			{
				displayName: 'Start Date',
				name: 'start_date',
				type: 'dateTime',
				default: '',
				description: 'The beginning date for the pace',
			},
			{
				displayName: 'Workflow State',
				name: 'workflow_state',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Unpublished', value: 'unpublished' },
				],
				default: 'unpublished',
				description: 'The current state of the pace',
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
				description: 'The completion date for the pace',
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
				description: 'Whether to enforce fixed end dates for assignments',
			},
			{
				displayName: 'Selected Days to Skip',
				name: 'selected_days_to_skip',
				type: 'string',
				default: '',
				description: 'Comma-separated list of specific days to exclude (e.g., "monday,friday")',
			},
			{
				displayName: 'Workflow State',
				name: 'workflow_state',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Unpublished', value: 'unpublished' },
				],
				default: 'unpublished',
				description: 'The current state of the pace',
			},
		],
	},
];
