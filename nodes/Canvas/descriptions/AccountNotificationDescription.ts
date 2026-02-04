import type { INodeProperties } from 'n8n-workflow';

export const accountNotificationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['accountNotification'],
			},
		},
		options: [
			{
				name: 'Close',
				value: 'close',
				description: 'Close or delete a notification',
				action: 'Close a notification',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new account notification',
				action: 'Create a notification',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single notification',
				action: 'Get a notification',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many notifications',
				action: 'Get many notifications',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a notification',
				action: 'Update a notification',
			},
		],
		default: 'getAll',
	},
];

export const accountNotificationFields: INodeProperties[] = [
	// ----------------------------------
	//         accountNotification: shared
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accountNotification'],
				operation: ['create', 'get', 'getAll', 'update', 'close'],
			},
		},
		description: 'The ID of the account',
	},

	// ----------------------------------
	//         accountNotification: get, update, close
	// ----------------------------------
	{
		displayName: 'Notification ID',
		name: 'notificationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accountNotification'],
				operation: ['get', 'update', 'close'],
			},
		},
		description: 'The ID of the notification',
	},

	// ----------------------------------
	//         accountNotification: getAll
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['accountNotification'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include All',
				name: 'include_all',
				type: 'boolean',
				default: false,
				description: 'Whether to include all global announcements regardless of role or availability (admin only)',
			},
			{
				displayName: 'Include Past',
				name: 'include_past',
				type: 'boolean',
				default: false,
				description: 'Whether to include past and dismissed global announcements',
			},
			{
				displayName: 'Show Is Closed',
				name: 'show_is_closed',
				type: 'boolean',
				default: false,
				description: 'Whether to include a flag indicating if the notification has been read by the user',
			},
		],
	},

	// ----------------------------------
	//         accountNotification: create
	// ----------------------------------
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accountNotification'],
				operation: ['create'],
			},
		},
		description: 'The subject of the notification',
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accountNotification'],
				operation: ['create'],
			},
		},
		description: 'The message body of the notification',
	},
	{
		displayName: 'Start At',
		name: 'startAt',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accountNotification'],
				operation: ['create'],
			},
		},
		description: 'The start date and time for the notification in ISO 8601 format',
	},
	{
		displayName: 'End At',
		name: 'endAt',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accountNotification'],
				operation: ['create'],
			},
		},
		description: 'The end date and time for the notification in ISO 8601 format',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['accountNotification'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Icon',
				name: 'icon',
				type: 'options',
				options: [
					{ name: 'Calendar', value: 'calendar' },
					{ name: 'Error', value: 'error' },
					{ name: 'Information', value: 'information' },
					{ name: 'Question', value: 'question' },
					{ name: 'Warning', value: 'warning' },
				],
				default: 'information',
				description: 'The icon to display with the notification',
			},
			{
				displayName: 'Roles',
				name: 'roles',
				type: 'string',
				default: '',
				description: 'Comma-separated list of roles to target (e.g., "StudentEnrollment,TeacherEnrollment"). Omit to send to all roles.',
			},
		],
	},

	// ----------------------------------
	//         accountNotification: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['accountNotification'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'End At',
				name: 'end_at',
				type: 'dateTime',
				default: '',
				description: 'The end date and time for the notification in ISO 8601 format',
			},
			{
				displayName: 'Icon',
				name: 'icon',
				type: 'options',
				options: [
					{ name: 'Calendar', value: 'calendar' },
					{ name: 'Error', value: 'error' },
					{ name: 'Information', value: 'information' },
					{ name: 'Question', value: 'question' },
					{ name: 'Warning', value: 'warning' },
				],
				default: 'information',
				description: 'The icon to display with the notification',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The message body of the notification',
			},
			{
				displayName: 'Roles',
				name: 'roles',
				type: 'string',
				default: '',
				description: 'Comma-separated list of roles to target (e.g., "StudentEnrollment,TeacherEnrollment")',
			},
			{
				displayName: 'Start At',
				name: 'start_at',
				type: 'dateTime',
				default: '',
				description: 'The start date and time for the notification in ISO 8601 format',
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
				description: 'The subject of the notification',
			},
		],
	},

	// ----------------------------------
	//         accountNotification: close
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['accountNotification'],
				operation: ['close'],
			},
		},
		options: [
			{
				displayName: 'Remove',
				name: 'remove',
				type: 'boolean',
				default: false,
				description: 'Whether to permanently destroy the notification (admin only). If false, the notification is just closed for the current user.',
			},
		],
	},
];
