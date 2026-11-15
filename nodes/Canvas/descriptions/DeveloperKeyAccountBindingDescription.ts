import type { INodeProperties } from 'n8n-workflow';

export const developerKeyAccountBindingOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['developerKeyAccountBinding'],
			},
		},
		options: [
			{
				name: 'Set',
				value: 'set',
				description: 'Switch a developer key on or off for an account (creates the binding if there is none)',
				action: 'Set a developer key account binding',
			},
		],
		default: 'set',
	},
];

export const developerKeyAccountBindingFields: INodeProperties[] = [
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['developerKeyAccountBinding'],
			},
		},
		description: 'The ID of the account in which the key is switched on or off',
	},
	{
		displayName: 'Developer Key ID',
		name: 'developerKeyId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['developerKeyAccountBinding'],
			},
		},
		description: 'The ID of the developer key',
	},
	{
		displayName: 'State',
		name: 'workflowState',
		type: 'options',
		required: true,
		options: [
			{ name: 'Allow', value: 'allow' },
			{ name: 'Off', value: 'off' },
			{ name: 'On', value: 'on' },
		],
		default: 'on',
		displayOptions: {
			show: {
				resource: ['developerKeyAccountBinding'],
			},
		},
		description: 'On lets the key be used in this account, Off blocks it, Allow leaves the decision to the parent account',
	},
];
