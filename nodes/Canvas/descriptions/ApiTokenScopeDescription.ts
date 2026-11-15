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
				description:
					'Group the scopes by API resource. The result is then a single item with one property per resource instead of one item per scope.',
			},
		],
	},
];
