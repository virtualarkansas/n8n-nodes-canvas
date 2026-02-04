import type { INodeProperties } from 'n8n-workflow';

export const notificationPreferenceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single notification preference',
				action: 'Get a notification preference',
			},
			{
				name: 'Get Categories',
				value: 'getCategories',
				description: 'Get all notification preference categories',
				action: 'Get notification preference categories',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many notification preferences',
				action: 'Get many notification preferences',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a single notification preference',
				action: 'Update a notification preference',
			},
			{
				name: 'Update by Category',
				value: 'updateByCategory',
				description: 'Update notification preferences by category',
				action: 'Update notification preferences by category',
			},
			{
				name: 'Update Multiple',
				value: 'updateMultiple',
				description: 'Update multiple notification preferences at once',
				action: 'Update multiple notification preferences',
			},
		],
		default: 'getAll',
	},
];

export const notificationPreferenceFields: INodeProperties[] = [
	// ----------------------------------
	//         notificationPreference: shared
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['get', 'getAll', 'getCategories'],
			},
		},
		description: 'The ID of the user (use "self" for the current user)',
	},
	{
		displayName: 'Channel ID',
		name: 'channelId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['get', 'getAll', 'getCategories', 'update', 'updateByCategory', 'updateMultiple'],
			},
		},
		description: 'The ID of the communication channel',
	},

	// ----------------------------------
	//         notificationPreference: get
	// ----------------------------------
	{
		displayName: 'Notification',
		name: 'notification',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['get'],
			},
		},
		description: 'The name of the notification preference to retrieve',
	},

	// ----------------------------------
	//         notificationPreference: getAll
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['getAll'],
			},
		},
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		default: 50,
		description: 'Max number of results to return',
	},

	// ----------------------------------
	//         notificationPreference: update
	// ----------------------------------
	{
		displayName: 'Notification',
		name: 'notification',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['update'],
			},
		},
		description: 'The name of the notification preference to update',
	},
	{
		displayName: 'Frequency',
		name: 'frequency',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['update'],
			},
		},
		options: [
			{ name: 'Daily', value: 'daily' },
			{ name: 'Immediately', value: 'immediately' },
			{ name: 'Never', value: 'never' },
			{ name: 'Weekly', value: 'weekly' },
		],
		default: 'immediately',
		description: 'The desired notification frequency',
	},

	// ----------------------------------
	//         notificationPreference: updateByCategory
	// ----------------------------------
	{
		displayName: 'Category',
		name: 'category',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['updateByCategory'],
			},
		},
		description: 'The category name in parameterized format (e.g., "course_content", "discussion")',
	},
	{
		displayName: 'Frequency',
		name: 'frequency',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['updateByCategory'],
			},
		},
		options: [
			{ name: 'Daily', value: 'daily' },
			{ name: 'Immediately', value: 'immediately' },
			{ name: 'Never', value: 'never' },
			{ name: 'Weekly', value: 'weekly' },
		],
		default: 'immediately',
		description: 'The desired notification frequency for all notifications in the category',
	},

	// ----------------------------------
	//         notificationPreference: updateMultiple
	// ----------------------------------
	{
		displayName: 'Preferences',
		name: 'preferences',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		required: true,
		default: {},
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['updateMultiple'],
			},
		},
		placeholder: 'Add Preference',
		description: 'The notification preferences to update',
		options: [
			{
				name: 'preferenceValues',
				displayName: 'Preference',
				values: [
					{
						displayName: 'Notification',
						name: 'notification',
						type: 'string',
						default: '',
						description: 'The name of the notification',
					},
					{
						displayName: 'Frequency',
						name: 'frequency',
						type: 'options',
						options: [
							{ name: 'Daily', value: 'daily' },
							{ name: 'Immediately', value: 'immediately' },
							{ name: 'Never', value: 'never' },
							{ name: 'Weekly', value: 'weekly' },
						],
						default: 'immediately',
						description: 'The desired notification frequency',
					},
				],
			},
		],
	},
];
