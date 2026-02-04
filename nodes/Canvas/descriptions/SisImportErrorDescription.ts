import type { INodeProperties } from 'n8n-workflow';

export const sisImportErrorOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['sisImportError'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many SIS import errors',
				action: 'Get many SIS import errors',
			},
			{
				name: 'Get Many for Account',
				value: 'getAllForAccount',
				description: 'Get all SIS import errors for an account',
				action: 'Get many SIS import errors for account',
			},
		],
		default: 'getAll',
	},
];

export const sisImportErrorFields: INodeProperties[] = [
	// ----------------------------------
	//         sisImportError: shared
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['sisImportError'],
			},
		},
		description: 'The ID of the account',
	},

	// ----------------------------------
	//         sisImportError: getAll
	// ----------------------------------
	{
		displayName: 'Import ID',
		name: 'importId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['sisImportError'],
				operation: ['getAll'],
			},
		},
		description: 'The ID of the SIS import',
	},

	// ----------------------------------
	//         sisImportError: options (shared)
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['sisImportError'],
				operation: ['getAll', 'getAllForAccount'],
			},
		},
		options: [
			{
				displayName: 'Failure Only',
				name: 'failure',
				type: 'boolean',
				default: false,
				description: 'Whether to show only errors that would cause a failure',
			},
		],
	},
];
