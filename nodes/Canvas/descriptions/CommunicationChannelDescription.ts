import type { INodeProperties } from 'n8n-workflow';

export const communicationChannelOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['communicationChannel'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new communication channel for a user',
				action: 'Create a communication channel',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a communication channel',
				action: 'Delete a communication channel',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many communication channels for a user',
				action: 'Get many communication channels',
			},
		],
		default: 'getAll',
	},
];

export const communicationChannelFields: INodeProperties[] = [
	// ----------------------------------
	//         communicationChannel: all operations
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['communicationChannel'],
				operation: ['getAll', 'create', 'delete'],
			},
		},
		description: 'The ID of the user (use "self" for current user)',
	},

	// ----------------------------------
	//         communicationChannel: create
	// ----------------------------------
	{
		displayName: 'Channel Type',
		name: 'channelType',
		type: 'options',
		required: true,
		options: [
			{
				name: 'Email',
				value: 'email',
				description: 'Email communication channel',
			},
			{
				name: 'Push',
				value: 'push',
				description: 'Push notification channel',
			},
			{
				name: 'SMS',
				value: 'sms',
				description: 'SMS/text message channel',
			},
		],
		default: 'email',
		displayOptions: {
			show: {
				resource: ['communicationChannel'],
				operation: ['create'],
			},
		},
		description: 'The type of communication channel to create',
	},
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['communicationChannel'],
				operation: ['create'],
			},
		},
		description: 'The address for the communication channel (email address or phone number)',
	},

	// ----------------------------------
	//         communicationChannel: delete
	// ----------------------------------
	{
		displayName: 'Delete By',
		name: 'deleteBy',
		type: 'options',
		required: true,
		options: [
			{
				name: 'Channel ID',
				value: 'id',
				description: 'Delete by communication channel ID',
			},
			{
				name: 'Type and Address',
				value: 'typeAndAddress',
				description: 'Delete by type and address combination',
			},
		],
		default: 'id',
		displayOptions: {
			show: {
				resource: ['communicationChannel'],
				operation: ['delete'],
			},
		},
		description: 'How to identify the communication channel to delete',
	},
	{
		displayName: 'Channel ID',
		name: 'channelId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['communicationChannel'],
				operation: ['delete'],
				deleteBy: ['id'],
			},
		},
		description: 'The ID of the communication channel to delete',
	},
	{
		displayName: 'Channel Type',
		name: 'channelType',
		type: 'options',
		required: true,
		options: [
			{
				name: 'Email',
				value: 'email',
				description: 'Email communication channel',
			},
			{
				name: 'Push',
				value: 'push',
				description: 'Push notification channel',
			},
			{
				name: 'SMS',
				value: 'sms',
				description: 'SMS/text message channel',
			},
		],
		default: 'email',
		displayOptions: {
			show: {
				resource: ['communicationChannel'],
				operation: ['delete'],
				deleteBy: ['typeAndAddress'],
			},
		},
		description: 'The type of communication channel',
	},
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['communicationChannel'],
				operation: ['delete'],
				deleteBy: ['typeAndAddress'],
			},
		},
		description: 'The address of the communication channel to delete',
	},

	// ----------------------------------
	//         communicationChannel: create - Additional Fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['communicationChannel'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Skip Confirmation',
				name: 'skipConfirmation',
				type: 'boolean',
				default: false,
				description: 'Whether to skip the confirmation process (admin only). Auto-validates the channel.',
			},
			{
				displayName: 'Token',
				name: 'token',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'Registration or device token (required for push notification channels)',
			},
		],
	},
];
