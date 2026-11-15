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
				description: 'Get how often one notification is delivered to a communication channel',
				action: 'Get a notification preference',
			},
			{
				name: 'Get Categories',
				value: 'getCategories',
				description: 'Get the notification categories of a communication channel (one item with the list)',
				action: 'Get notification preference categories',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the preference for every notification of a communication channel',
				action: 'Get many notification preferences',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Change how often one notification is delivered',
				action: 'Update a notification preference',
			},
			{
				name: 'Update by Category',
				value: 'updateByCategory',
				description: 'Change the frequency of every notification in a category',
				action: 'Update notification preferences by category',
			},
			{
				name: 'Update Multiple',
				value: 'updateMultiple',
				description: 'Change the frequency of several notifications in one request',
				action: 'Update multiple notification preferences',
			},
		],
		default: 'getAll',
	},
];

const frequencyOptions = [
	{ name: 'Daily', value: 'daily' },
	{ name: 'Immediately', value: 'immediately' },
	{ name: 'Never', value: 'never' },
	{ name: 'Weekly', value: 'weekly' },
];

/** Operations for which Canvas also accepts "channel type + address" instead of the channel ID. */
const addressableOperations = ['get', 'getAll', 'update', 'updateMultiple'];
const updateOperations = ['update', 'updateByCategory', 'updateMultiple'];

export const notificationPreferenceFields: INodeProperties[] = [
	// ----------------------------------
	//         notificationPreference: shared
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: 'self',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['get', 'getAll', 'getCategories'],
			},
		},
		description: 'The ID of the user who owns the communication channel ("self" for the user of the access token)',
	},
	{
		displayName: 'Identify Channel By',
		name: 'channelBy',
		type: 'options',
		default: 'id',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: addressableOperations,
			},
		},
		options: [
			{
				name: 'Address',
				value: 'address',
				description: 'The channel type and its address, for example the e-mail address',
			},
			{
				name: 'Channel ID',
				value: 'id',
				description: 'The ID of the communication channel',
			},
		],
		description: 'How to identify the communication channel',
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
				operation: addressableOperations,
				channelBy: ['id'],
			},
		},
		description: 'The ID of the communication channel (see the Communication Channel resource)',
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
				operation: ['getCategories', 'updateByCategory'],
			},
		},
		description: 'The ID of the communication channel (see the Communication Channel resource)',
	},
	{
		displayName: 'Channel Type',
		name: 'channelType',
		type: 'options',
		default: 'email',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: addressableOperations,
				channelBy: ['address'],
			},
		},
		options: [
			{ name: 'Email', value: 'email' },
			{ name: 'Push', value: 'push' },
			{ name: 'SMS', value: 'sms' },
		],
		description: 'The type of the communication channel',
	},
	{
		displayName: 'Channel Address',
		name: 'channelAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'name@email.com',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: addressableOperations,
				channelBy: ['address'],
			},
		},
		description: 'The address of the communication channel, exactly as registered in Canvas',
	},

	// ----------------------------------
	//         notificationPreference: get / update
	// ----------------------------------
	{
		displayName: 'Notification',
		name: 'notification',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'new_announcement',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['get', 'update'],
			},
		},
		description: 'The name of the notification as listed by Get Many, e.g. "new_announcement" or "assignment_due_date_changed"',
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
		options: frequencyOptions,
		default: 'immediately',
		description: 'How often the notification is delivered to this channel',
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
		placeholder: 'course_content',
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: ['updateByCategory'],
			},
		},
		description: 'The category exactly as listed by Get Categories, e.g. "course_content", "due_date" or "discussionentry" (not the "category" value shown by Get Many, which is spelled differently for some categories)',
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
		options: frequencyOptions,
		default: 'immediately',
		description: 'How often the notifications of this category are delivered to this channel',
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
						placeholder: 'new_announcement',
						description: 'The name of the notification as listed by Get Many',
					},
					{
						displayName: 'Frequency',
						name: 'frequency',
						type: 'options',
						options: frequencyOptions,
						default: 'immediately',
						description: 'How often the notification is delivered to this channel',
					},
				],
			},
		],
	},

	// ----------------------------------
	//         notificationPreference: update operations
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['notificationPreference'],
				operation: updateOperations,
			},
		},
		options: [
			{
				displayName: 'Act as User ID',
				name: 'as_user_id',
				type: 'string',
				default: '',
				description: 'Canvas only lets users change their own preferences. An admin who may "become" other users can enter the ID of the user who owns the channel here to change that user\'s preferences.',
			},
		],
	},
];
