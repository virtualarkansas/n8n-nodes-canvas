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
				description:
					'Create a new access token. A token created for another user is pending until that user activates it in Canvas.',
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
				description: 'Get the manually generated access tokens of a user',
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
		description:
			'The ID of the user who owns the token. Use "self" for the user of the credential; managing other users\' tokens needs the access token permissions on the root account.',
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
		description:
			'The ID of the access token, or its hint (the first characters of the token, as shown in "visible_token" without the dots)',
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
				description: 'When the token expires. Without it the token never expires.',
			},
			{
				displayName: 'Scopes',
				name: 'scopes',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of scopes that limit what the token may call, each exactly as listed in the "scope" property of the API Token Scope resource',
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
				description: 'When the token expires. Without it the token never expires.',
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
				description:
					'Whether to replace the token value with a new one (returned once in "visible_token"). An expired token also needs a new Expires At.',
			},
			{
				displayName: 'Scopes',
				name: 'scopes',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of scopes that limit what the token may call, each exactly as listed in the "scope" property of the API Token Scope resource',
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
