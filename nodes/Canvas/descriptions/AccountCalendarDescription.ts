import type { INodeProperties } from 'n8n-workflow';

export const accountCalendarOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['accountCalendar'],
			},
		},
		options: [
			{
				name: 'Count Visible',
				value: 'countVisible',
				description: 'Count visible account calendars',
				action: 'Count visible calendars',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single account calendar',
				action: 'Get an account calendar',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many account calendars',
				action: 'Get many account calendars',
			},
			{
				name: 'Get Many for Account',
				value: 'getAllForAccount',
				description: 'Get all calendars for an account and its sub-accounts',
				action: 'Get many calendars for account',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an account calendar',
				action: 'Update an account calendar',
			},
			{
				name: 'Update Many',
				value: 'updateMany',
				description: 'Bulk update multiple account calendars',
				action: 'Update many account calendars',
			},
		],
		default: 'getAll',
	},
];

export const accountCalendarFields: INodeProperties[] = [
	// ----------------------------------
	//         accountCalendar: get, update
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accountCalendar'],
				operation: ['get', 'update', 'getAllForAccount', 'countVisible', 'updateMany'],
			},
		},
		description: 'The ID of the account',
	},

	// ----------------------------------
	//         accountCalendar: getAll
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['accountCalendar'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Search calendars by name (minimum 2 characters)',
			},
		],
	},

	// ----------------------------------
	//         accountCalendar: getAllForAccount
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['accountCalendar'],
				operation: ['getAllForAccount'],
			},
		},
		options: [
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'options',
				options: [
					{ name: 'All', value: '' },
					{ name: 'Hidden', value: 'hidden' },
					{ name: 'Visible', value: 'visible' },
				],
				default: '',
				description: 'Filter calendars by visibility',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Search descendant accounts by name (minimum 2 characters)',
			},
		],
	},

	// ----------------------------------
	//         accountCalendar: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['accountCalendar'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Auto Subscribe',
				name: 'auto_subscribe',
				type: 'boolean',
				default: false,
				description: 'Whether to automatically display calendar events to users',
			},
			{
				displayName: 'Visible',
				name: 'visible',
				type: 'boolean',
				default: true,
				description: 'Whether the calendar is visible and allows administrative event creation',
			},
		],
	},

	// ----------------------------------
	//         accountCalendar: updateMany
	// ----------------------------------
	{
		displayName: 'Calendars',
		name: 'calendars',
		type: 'json',
		required: true,
		default: '[\n  {\n    "id": "1",\n    "visible": true,\n    "auto_subscribe": false\n  }\n]',
		displayOptions: {
			show: {
				resource: ['accountCalendar'],
				operation: ['updateMany'],
			},
		},
		description: 'JSON array of calendar objects to update. Each object should have "ID", "visible", and/or "auto_subscribe" properties.',
	},
];
