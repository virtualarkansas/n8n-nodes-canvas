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
				description: 'Create a new developer key (API key)',
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
				name: 'Set State in Account',
				value: 'setAccountBinding',
				description: 'Switch a developer key on or off for an account',
				action: 'Set the state of a developer key in an account',
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

/** Settings shared by Create and Update. */
const developerKeySettings: INodeProperties[] = [
	{
		displayName: 'Allow Includes',
		name: 'allow_includes',
		type: 'boolean',
		default: false,
		description:
			'Whether tokens of a key with enforced scopes may use "include" parameters in API requests',
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
		type: 'options',
		options: [
			{ name: 'External', value: 'external' },
			{ name: 'Internal', value: 'internal' },
		],
		default: 'internal',
		description: 'The audience of access tokens in the OAuth2 client credentials flow',
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
		typeOptions: {
			rows: 2,
		},
		default: '',
		description: 'OAuth2 redirect URLs, comma-separated or one per line',
	},
	{
		displayName: 'Require Scopes',
		name: 'require_scopes',
		type: 'boolean',
		default: false,
		description: 'Whether to enforce scopes: tokens of this key may only call the endpoints in Scopes',
	},
	{
		displayName: 'Scopes',
		name: 'scopes',
		type: 'string',
		typeOptions: {
			rows: 2,
		},
		default: '',
		description:
			'Allowed API endpoint scopes, comma-separated or one per line, each exactly as listed in the "scope" property of the API Token Scope resource. Canvas drops scopes it does not know.',
	},
	{
		displayName: 'Test Cluster Only',
		name: 'test_cluster_only',
		type: 'boolean',
		default: false,
		description: 'Whether this key should only work in non-production environments (test, beta)',
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
		description:
			'Whether a Site Admin key is listed for other accounts as an inherited key. Keys of an account are always visible, whatever is set here.',
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
				operation: ['create', 'getAll', 'setAccountBinding'],
			},
		},
		description: 'The ID of the root account ("self" for the account of the Canvas URL)',
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
				operation: ['delete', 'update', 'setAccountBinding'],
			},
		},
		description:
			'The ID of the developer key, as returned by Get Many (the long form, e.g. 10000000000004). Set State in Account only accepts this long form.',
	},

	// ----------------------------------
	//         developerKey: setAccountBinding
	// ----------------------------------
	{
		displayName: 'State',
		name: 'bindingState',
		type: 'options',
		options: [
			{
				name: 'Allow',
				value: 'allow',
				description: 'Leave the decision to the accounts below (inherited keys only)',
			},
			{ name: 'Off', value: 'off', description: 'The key cannot be used in this account' },
			{ name: 'On', value: 'on', description: 'The key can be used in this account' },
		],
		default: 'on',
		displayOptions: {
			show: {
				resource: ['developerKey'],
				operation: ['setAccountBinding'],
			},
		},
		description: 'Whether the key may be used in the account',
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
		description: 'Canvas needs at least one of these fields (usually the name) to create a key',
		options: developerKeySettings,
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
				displayName: 'Activate or Deactivate',
				name: 'event',
				type: 'options',
				options: [
					{ name: 'Activate', value: 'activate', description: 'Make an inactive key usable again' },
					{
						name: 'Deactivate',
						value: 'deactivate',
						description: 'Make the key unusable without deleting it',
					},
				],
				default: 'deactivate',
				description: 'Change whether the key is active',
			},
			...developerKeySettings,
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
				displayName: 'Developer Key ID',
				name: 'id',
				type: 'string',
				default: '',
				description: 'Only return the key with this ID',
			},
			{
				displayName: 'Inherited',
				name: 'inherited',
				type: 'boolean',
				default: false,
				description:
					'Whether to list the keys inherited from Site Admin (and a consortium parent account) instead of the keys of this account',
			},
		],
	},
];
