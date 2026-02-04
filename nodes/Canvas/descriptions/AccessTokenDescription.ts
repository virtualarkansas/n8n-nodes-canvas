import type { INodeProperties } from 'n8n-workflow';

export const accessTokenOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['accessToken'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new access token',
				action: 'Create an access token',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an access token',
				action: 'Delete an access token',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single access token',
				action: 'Get an access token',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many access tokens',
				action: 'Get many access tokens',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an access token',
				action: 'Update an access token',
			},
		],
		default: 'getAll',
	},
];

export const accessTokenFields: INodeProperties[] = [
	// ----------------------------------
	//         accessToken: shared
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accessToken'],
				operation: ['create', 'delete', 'get', 'getAll', 'update'],
			},
		},
		description: 'The ID of the user',
	},
	/* eslint-disable n8n-nodes-base/node-param-type-options-password-missing */
	{
		displayName: 'Token ID',
		name: 'tokenId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accessToken'],
				operation: ['delete', 'get', 'update'],
			},
		},
		description: 'The ID of the access token (or token_hint value)',
	},
	/* eslint-enable n8n-nodes-base/node-param-type-options-password-missing */

	// ----------------------------------
	//         accessToken: create
	// ----------------------------------
	{
		displayName: 'Purpose',
		name: 'purpose',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['accessToken'],
				operation: ['create'],
			},
		},
		description: 'The purpose of the token',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['accessToken'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Expires At',
				name: 'expires_at',
				type: 'dateTime',
				default: '',
				description: 'The expiration date/time of the token in ISO 8601 format',
			},
			{
				displayName: 'Scopes',
				name: 'scopes',
				type: 'string',
				default: '',
				description: 'Comma-separated list of scopes to associate with the token',
			},
		],
	},

	// ----------------------------------
	//         accessToken: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['accessToken'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Expires At',
				name: 'expires_at',
				type: 'dateTime',
				default: '',
				description: 'The expiration date/time of the token in ISO 8601 format',
			},
			{
				displayName: 'Purpose',
				name: 'purpose',
				type: 'string',
				default: '',
				description: 'The purpose of the token',
			},
			{
				displayName: 'Regenerate',
				name: 'regenerate',
				type: 'boolean',
				default: false,
				description: 'Whether to regenerate the actual token value',
			},
			{
				displayName: 'Scopes',
				name: 'scopes',
				type: 'string',
				default: '',
				description: 'Comma-separated list of scopes to associate with the token',
			},
		],
	},

	// ----------------------------------
	//         accessToken: getAll - options
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['accessToken'],
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
				resource: ['accessToken'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
		description: 'Max number of results to return',
	},
];
