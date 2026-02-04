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
				description: 'Create a blackout date',
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
				description: 'Get many blackout dates',
				action: 'Get many blackout dates',
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
				operation: ['create', 'get', 'getAll', 'update', 'delete'],
			},
		},
		description: 'Whether this blackout date is for a course or account',
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
				operation: ['create', 'get', 'getAll', 'update', 'delete'],
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
				operation: ['create', 'get', 'getAll', 'update', 'delete'],
				contextType: ['course'],
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
		description: 'The title of the blackout date event',
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
		description: 'The start date of the blackout period',
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
		description: 'The end date of the blackout period',
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
				description: 'The end date of the blackout period',
			},
			{
				displayName: 'Event Title',
				name: 'event_title',
				type: 'string',
				default: '',
				description: 'The title of the blackout date event',
			},
			{
				displayName: 'Start Date',
				name: 'start_date',
				type: 'dateTime',
				default: '',
				description: 'The start date of the blackout period',
			},
		],
	},
];
