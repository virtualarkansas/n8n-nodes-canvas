import type { INodeProperties } from 'n8n-workflow';

export const apiTokenScopeOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['apiTokenScope'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many API token scopes',
				action: 'Get many API token scopes',
			},
		],
		default: 'getAll',
	},
];

export const apiTokenScopeFields: INodeProperties[] = [
	// ----------------------------------
	//         apiTokenScope: getAll
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['apiTokenScope'],
				operation: ['getAll'],
			},
		},
		description: 'The ID of the account',
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['apiTokenScope'],
				operation: ['getAll'],
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
				resource: ['apiTokenScope'],
				operation: ['getAll'],
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
				resource: ['apiTokenScope'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Group By',
				name: 'group_by',
				type: 'options',
				options: [
					{ name: 'Resource Name', value: 'resource_name' },
				],
				default: 'resource_name',
				description: 'Group the results by the specified attribute',
			},
		],
	},
];
