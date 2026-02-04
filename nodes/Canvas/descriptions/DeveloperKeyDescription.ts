import type { INodeProperties } from 'n8n-workflow';

export const developerKeyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['developerKey'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new developer key',
				action: 'Create a developer key',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a developer key',
				action: 'Delete a developer key',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many developer keys',
				action: 'Get many developer keys',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a developer key',
				action: 'Update a developer key',
			},
		],
		default: 'getAll',
	},
];

export const developerKeyFields: INodeProperties[] = [
	// ----------------------------------
	//         developerKey: shared
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['developerKey'],
				operation: ['create', 'getAll'],
			},
		},
		description: 'The ID of the account',
	},
	{
		displayName: 'Developer Key ID',
		name: 'developerKeyId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['developerKey'],
				operation: ['delete', 'update'],
			},
		},
		description: 'The ID of the developer key',
	},

	// ----------------------------------
	//         developerKey: create
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['developerKey'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Allow Includes',
				name: 'allow_includes',
				type: 'boolean',
				default: false,
				description: 'Whether to allow includes parameters in API requests',
			},
			{
				displayName: 'Auto Expire Tokens',
				name: 'auto_expire_tokens',
				type: 'boolean',
				default: false,
				description: 'Whether tokens should automatically expire after 1 hour',
			},
			{
				displayName: 'Client Credentials Audience',
				name: 'client_credentials_audience',
				type: 'string',
				default: '',
				description: 'The OAuth2 audience specification for client credentials',
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'The contact email for the developer key',
			},
			{
				displayName: 'Icon URL',
				name: 'icon_url',
				type: 'string',
				default: '',
				description: 'The URL of the icon to display in the UI',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The display name of the developer key',
			},
			{
				displayName: 'Notes',
				name: 'notes',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'User-provided notes about the developer key',
			},
			{
				displayName: 'Redirect URIs',
				name: 'redirect_uris',
				type: 'string',
				default: '',
				description: 'Comma-separated list of OAuth2 redirect URLs',
			},
			{
				displayName: 'Require Scopes',
				name: 'require_scopes',
				type: 'boolean',
				default: false,
				description: 'Whether to require scopes in token requests',
			},
			{
				displayName: 'Scopes',
				name: 'scopes',
				type: 'string',
				default: '',
				description: 'Comma-separated list of allowed API endpoint scopes',
			},
			{
				displayName: 'Test Cluster Only',
				name: 'test_cluster_only',
				type: 'boolean',
				default: false,
				description: 'Whether this key should only work in non-production environments',
			},
			{
				displayName: 'Vendor Code',
				name: 'vendor_code',
				type: 'string',
				default: '',
				description: 'The vendor identifier for the developer key',
			},
			{
				displayName: 'Visible',
				name: 'visible',
				type: 'boolean',
				default: true,
				description: 'Whether the developer key should be visible in the UI',
			},
		],
	},

	// ----------------------------------
	//         developerKey: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['developerKey'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Allow Includes',
				name: 'allow_includes',
				type: 'boolean',
				default: false,
				description: 'Whether to allow includes parameters in API requests',
			},
			{
				displayName: 'Auto Expire Tokens',
				name: 'auto_expire_tokens',
				type: 'boolean',
				default: false,
				description: 'Whether tokens should automatically expire after 1 hour',
			},
			{
				displayName: 'Client Credentials Audience',
				name: 'client_credentials_audience',
				type: 'string',
				default: '',
				description: 'The OAuth2 audience specification for client credentials',
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'The contact email for the developer key',
			},
			{
				displayName: 'Icon URL',
				name: 'icon_url',
				type: 'string',
				default: '',
				description: 'The URL of the icon to display in the UI',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The display name of the developer key',
			},
			{
				displayName: 'Notes',
				name: 'notes',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'User-provided notes about the developer key',
			},
			{
				displayName: 'Redirect URIs',
				name: 'redirect_uris',
				type: 'string',
				default: '',
				description: 'Comma-separated list of OAuth2 redirect URLs',
			},
			{
				displayName: 'Require Scopes',
				name: 'require_scopes',
				type: 'boolean',
				default: false,
				description: 'Whether to require scopes in token requests',
			},
			{
				displayName: 'Scopes',
				name: 'scopes',
				type: 'string',
				default: '',
				description: 'Comma-separated list of allowed API endpoint scopes',
			},
			{
				displayName: 'Test Cluster Only',
				name: 'test_cluster_only',
				type: 'boolean',
				default: false,
				description: 'Whether this key should only work in non-production environments',
			},
			{
				displayName: 'Vendor Code',
				name: 'vendor_code',
				type: 'string',
				default: '',
				description: 'The vendor identifier for the developer key',
			},
			{
				displayName: 'Visible',
				name: 'visible',
				type: 'boolean',
				default: true,
				description: 'Whether the developer key should be visible in the UI',
			},
		],
	},

	// ----------------------------------
	//         developerKey: getAll - options
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['developerKey'],
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
				resource: ['developerKey'],
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
				resource: ['developerKey'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Inherited',
				name: 'inherited',
				type: 'boolean',
				default: false,
				description: 'Whether to include keys inherited from Site Admin and consortium parent accounts',
			},
		],
	},
];
