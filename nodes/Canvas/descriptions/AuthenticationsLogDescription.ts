import type { INodeProperties } from 'n8n-workflow';

export const authenticationsLogOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['authenticationsLog'],
			},
		},
		options: [
			{
				name: 'Get Many by Account',
				value: 'getAllByAccount',
				description: 'Get many authentication events for an account',
				action: 'Get many authentication events by account',
			},
			{
				name: 'Get Many by Login',
				value: 'getAllByLogin',
				description: 'Get many authentication events for a login',
				action: 'Get many authentication events by login',
			},
			{
				name: 'Get Many by User',
				value: 'getAllByUser',
				description: 'Get many authentication events for a user',
				action: 'Get many authentication events by user',
			},
		],
		default: 'getAllByUser',
	},
];

export const authenticationsLogFields: INodeProperties[] = [
	// ----------------------------------
	//         authenticationsLog: getAllByAccount
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['authenticationsLog'],
				operation: ['getAllByAccount'],
			},
		},
		description: 'The ID of the account',
	},

	// ----------------------------------
	//         authenticationsLog: getAllByLogin
	// ----------------------------------
	{
		displayName: 'Login ID',
		name: 'loginId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['authenticationsLog'],
				operation: ['getAllByLogin'],
			},
		},
		description: 'The ID of the login',
	},

	// ----------------------------------
	//         authenticationsLog: getAllByUser
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['authenticationsLog'],
				operation: ['getAllByUser'],
			},
		},
		description: 'The ID of the user',
	},

	// ----------------------------------
	//         authenticationsLog: shared options
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['authenticationsLog'],
				operation: ['getAllByAccount', 'getAllByLogin', 'getAllByUser'],
			},
		},
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		displayOptions: {
			show: {
				resource: ['authenticationsLog'],
				operation: ['getAllByAccount', 'getAllByLogin', 'getAllByUser'],
				returnAll: [false],
			},
		},
		description: 'Max number of results to return',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['authenticationsLog'],
				operation: ['getAllByAccount', 'getAllByLogin', 'getAllByUser'],
			},
		},
		options: [
			{
				displayName: 'End Time',
				name: 'end_time',
				type: 'dateTime',
				default: '',
				description: 'The end of the time range for events (ISO 8601 format)',
			},
			{
				displayName: 'Start Time',
				name: 'start_time',
				type: 'dateTime',
				default: '',
				description: 'The beginning of the time range for events (ISO 8601 format)',
			},
		],
	},
];
