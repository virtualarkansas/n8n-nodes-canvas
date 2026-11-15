import type { INodeProperties } from 'n8n-workflow';

export const blackoutDateOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['blackoutDate'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a blackout date (days that do not count in course pacing)',
				action: 'Create a blackout date',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a blackout date',
				action: 'Delete a blackout date',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single blackout date',
				action: 'Get a blackout date',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the blackout dates of a course or account',
				action: 'Get many blackout dates',
			},
			{
				name: 'Replace All',
				value: 'replaceAll',
				description: 'Make the blackout dates of a course match a list: entries with an ID are updated, entries without are created, all others are deleted',
				action: 'Replace all blackout dates of a course',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a blackout date',
				action: 'Update a blackout date',
			},
		],
		default: 'getAll',
	},
];

const singleContextOperations = ['create', 'get', 'getAll', 'update', 'delete'];

export const blackoutDateFields: INodeProperties[] = [
	// ----------------------------------
	//         blackoutDate: shared - context type
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		options: [
			{ name: 'Account', value: 'account' },
			{ name: 'Course', value: 'course' },
		],
		default: 'course',
		displayOptions: {
			show: {
				resource: ['blackoutDate'],
				operation: singleContextOperations,
			},
		},
		description: 'Whether the blackout date belongs to a course or to an account (account-level blackout dates are a Canvas feature option)',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['blackoutDate'],
				operation: singleContextOperations,
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
				resource: ['blackoutDate'],
				operation: singleContextOperations,
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
				resource: ['blackoutDate'],
				operation: ['replaceAll'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         blackoutDate: shared - blackout date ID
	// ----------------------------------
	{
		displayName: 'Blackout Date ID',
		name: 'blackoutDateId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['blackoutDate'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the blackout date',
	},

	// ----------------------------------
	//         blackoutDate: create
	// ----------------------------------
	{
		displayName: 'Event Title',
		name: 'eventTitle',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['blackoutDate'],
				operation: ['create'],
			},
		},
		description: 'The title of the blackout date, e.g. "Spring Break"',
	},
	{
		displayName: 'Start Date',
		name: 'startDate',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['blackoutDate'],
				operation: ['create'],
			},
		},
		description: 'The first day of the blackout period. Only the date is used; a time of day is ignored.',
	},
	{
		displayName: 'End Date',
		name: 'endDate',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['blackoutDate'],
				operation: ['create'],
			},
		},
		description: 'The last day of the blackout period (the same as the start date for a single day). Only the date is used.',
	},

	// ----------------------------------
	//         blackoutDate: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['blackoutDate'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				description: 'The last day of the blackout period. Only the date is used.',
			},
			{
				displayName: 'Event Title',
				name: 'event_title',
				type: 'string',
				default: '',
				description: 'The title of the blackout date',
			},
			{
				displayName: 'Start Date',
				name: 'start_date',
				type: 'dateTime',
				default: '',
				description: 'The first day of the blackout period. Only the date is used.',
			},
		],
	},

	// ----------------------------------
	//         blackoutDate: replaceAll
	// ----------------------------------
	{
		displayName: 'Blackout Dates',
		name: 'blackoutDates',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		required: true,
		placeholder: 'Add Blackout Date',
		default: {},
		displayOptions: {
			show: {
				resource: ['blackoutDate'],
				operation: ['replaceAll'],
			},
		},
		description: 'The complete list of blackout dates the course should have afterwards. Blackout dates of the course that are not listed (by ID) are deleted.',
		options: [
			{
				name: 'dates',
				displayName: 'Blackout Date',
				values: [
					{
						displayName: 'Blackout Date ID',
						name: 'id',
						type: 'string',
						default: '',
						description: 'ID of an existing blackout date to keep and update. Leave empty to create a new one.',
					},
					{
						displayName: 'Event Title',
						name: 'event_title',
						type: 'string',
						default: '',
						description: 'The title of the blackout date',
					},
					{
						displayName: 'Start Date',
						name: 'start_date',
						type: 'dateTime',
						default: '',
						description: 'The first day of the blackout period. Only the date is used.',
					},
					{
						displayName: 'End Date',
						name: 'end_date',
						type: 'dateTime',
						default: '',
						description: 'The last day of the blackout period. Only the date is used.',
					},
				],
			},
		],
	},
];
