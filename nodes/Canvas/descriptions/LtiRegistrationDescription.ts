import type { INodeProperties } from 'n8n-workflow';

export const ltiRegistrationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
			},
		},
		options: [
			{
				name: 'Bind',
				value: 'bind',
				description:
					'Turn a registration inherited from Site Admin on or off for a root account (Canvas installs a local copy of it). For a registration of the account itself use Update with Workflow State.',
				action: 'Bind an LTI registration to an account',
			},
			{
				name: 'Create',
				value: 'create',
				description:
					'Create an LTI 1.3 registration together with its developer key and tool configuration',
				action: 'Create an LTI registration',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an LTI registration',
				action: 'Delete an LTI registration',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single LTI registration',
				action: 'Get an LTI registration',
			},
			{
				name: 'Get by Client ID',
				value: 'getByClientId',
				description: 'Get an LTI registration by client ID',
				action: 'Get an LTI registration by client ID',
			},
			{
				name: 'Get by Unified Tool ID',
				value: 'getByUnifiedToolId',
				description: 'Get the LTI registration with a given unified tool ID',
				action: 'Get an LTI registration by unified tool ID',
			},
			{
				name: 'Get History',
				value: 'getHistory',
				description: 'Get the change history of an LTI registration (newest first)',
				action: 'Get the history of an LTI registration',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many LTI registrations',
				action: 'Get many LTI registrations',
			},
			{
				name: 'Get Overlay History',
				value: 'getOverlayHistory',
				description: 'Get the edit history of the configuration overlay of an LTI registration',
				action: 'Get the overlay history of an LTI registration',
			},
			{
				name: 'Reset',
				value: 'reset',
				description:
					'Reset an LTI registration to its defaults by removing every customization of its overlay',
				action: 'Reset an LTI registration',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an LTI registration',
				action: 'Update an LTI registration',
			},
		],
		default: 'getAll',
	},
];

export const ltiRegistrationFields: INodeProperties[] = [
	// ----------------------------------
	//         ltiRegistration: shared
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
				operation: [
					'bind',
					'create',
					'delete',
					'get',
					'getAll',
					'getByClientId',
					'getByUnifiedToolId',
					'getHistory',
					'getOverlayHistory',
					'reset',
					'update',
				],
			},
		},
		description:
			'The ID of the account. Registrations live in root accounts; sub-accounts can only read them.',
	},
	{
		displayName: 'Registration ID',
		name: 'registrationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
				operation: ['bind', 'delete', 'get', 'getHistory', 'getOverlayHistory', 'reset', 'update'],
			},
		},
		description:
			'The ID of the LTI registration. For Bind: the ID of the Site Admin registration to turn on or off.',
	},

	// ----------------------------------
	//         ltiRegistration: getByClientId
	// ----------------------------------
	{
		displayName: 'Client ID',
		name: 'clientId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
				operation: ['getByClientId'],
			},
		},
		description:
			'The client ID of the LTI registration (the ID of its developer key, "developer_key_id")',
	},

	// ----------------------------------
	//         ltiRegistration: getByUnifiedToolId
	// ----------------------------------
	{
		displayName: 'Unified Tool ID',
		name: 'unifiedToolId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
				operation: ['getByUnifiedToolId'],
			},
		},
		description: 'The unified tool ID (LearnPlatform identifier) of the LTI registration',
	},

	// ----------------------------------
	//         ltiRegistration: getOverlayHistory
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
				operation: ['getOverlayHistory'],
			},
		},
		options: [
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
				default: 50,
				description: 'Max number of results to return',
			},
		],
	},

	// ----------------------------------
	//         ltiRegistration: bind
	// ----------------------------------
	{
		displayName: 'Workflow State',
		name: 'workflowState',
		type: 'options',
		required: true,
		default: 'on',
		options: [
			{ name: 'Off', value: 'off' },
			{ name: 'On', value: 'on' },
		],
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
				operation: ['bind'],
			},
		},
		description: 'Whether the registration is turned on or off for the account',
	},

	// ----------------------------------
	//         ltiRegistration: create
	// ----------------------------------
	{
		displayName: 'Configuration',
		name: 'configuration',
		type: 'json',
		required: true,
		default: '{}',
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
				operation: ['create'],
			},
		},
		description:
			'The LTI 1.3 tool configuration as a JSON object (Canvas\' Lti::ToolConfiguration format: title, target_link_uri, oidc_initiation_url, redirect_uris, scopes, placements, public_jwk or public_jwk_url, ...)',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Admin Nickname',
				name: 'admin_nickname',
				type: 'string',
				default: '',
				description: 'An admin-friendly display name for the tool',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 2,
				},
				default: '',
				description: 'A description of the tool (max 2048 bytes)',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the tool. Defaults to the title of the configuration.',
			},
			{
				displayName: 'Overlay',
				name: 'overlay',
				type: 'json',
				default: '{}',
				description:
					'Configuration overlay as a JSON object (Canvas\' Lti::Overlay format), e.g. {"title": "Custom title", "disabled_placements": ["course_navigation"], "disabled_scopes": []}. Its values override the base configuration.',
			},
			{
				displayName: 'Unified Tool ID',
				name: 'unified_tool_id',
				type: 'string',
				default: '',
				description: 'A unique identifier for the tool for analytics purposes',
			},
			{
				displayName: 'Vendor',
				name: 'vendor',
				type: 'string',
				default: '',
				description: 'The tool vendor',
			},
			{
				displayName: 'Workflow State',
				name: 'workflow_state',
				type: 'options',
				options: [
					{ name: 'Allow', value: 'allow' },
					{ name: 'Off', value: 'off' },
					{ name: 'On', value: 'on' },
				],
				default: 'off',
				description:
					'Whether the registration is turned on for the account. "Allow" is only valid for Site Admin registrations.',
			},
		],
	},

	// ----------------------------------
	//         ltiRegistration: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Admin Nickname',
				name: 'admin_nickname',
				type: 'string',
				default: '',
				description: 'An admin-friendly display name for the tool',
			},
			{
				displayName: 'Comment',
				name: 'comment',
				type: 'string',
				typeOptions: {
					rows: 2,
				},
				default: '',
				description: 'An explanation for the change (max 2000 characters)',
			},
			{
				displayName: 'Configuration',
				name: 'configuration',
				type: 'json',
				default: '{}',
				description:
					'The complete LTI 1.3 tool configuration as a JSON object; it replaces the stored one. Not allowed for registrations created by Dynamic Registration.',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 2,
				},
				default: '',
				description: 'A description of the tool (max 2048 bytes)',
			},
			{
				displayName: 'Lock Deploying',
				name: 'lock_deploying',
				type: 'boolean',
				default: false,
				description: 'Whether to prevent new deployments of this registration from being created',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the tool',
			},
			{
				displayName: 'Overlay',
				name: 'overlay',
				type: 'json',
				default: '{}',
				description:
					'Configuration overlay as a JSON object (Canvas\' Lti::Overlay format), e.g. {"title": "Custom title", "disabled_placements": ["course_navigation"]}. To remove every customization use the Reset operation.',
			},
			{
				displayName: 'Vendor',
				name: 'vendor',
				type: 'string',
				default: '',
				description: 'The tool vendor',
			},
			{
				displayName: 'Workflow State',
				name: 'workflow_state',
				type: 'options',
				options: [
					{ name: 'Allow', value: 'allow' },
					{ name: 'Off', value: 'off' },
					{ name: 'On', value: 'on' },
				],
				default: 'off',
				description:
					'Whether the registration is turned on for the account. "Allow" is only valid for Site Admin registrations.',
			},
		],
	},

	// ----------------------------------
	//         ltiRegistration: getAll
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Direction',
				name: 'dir',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'desc',
				description: 'Sort direction',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Account Binding', value: 'account_binding' },
					{ name: 'Configuration', value: 'configuration' },
					{ name: 'Overlaid Configuration', value: 'overlaid_configuration' },
					{ name: 'Overlay', value: 'overlay' },
				],
				default: [],
				description:
					'Additional data to include with each registration (the account binding is always included)',
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description:
					'Return only registrations that match every word of the query (name, nickname, vendor, and the people who installed or updated them)',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Installed', value: 'installed' },
					{ name: 'Installed By', value: 'installed_by' },
					{ name: 'LTI Version', value: 'lti_version' },
					{ name: 'Name', value: 'name' },
					{ name: 'Nickname', value: 'nickname' },
					{ name: 'On', value: 'on' },
					{ name: 'Updated', value: 'updated' },
					{ name: 'Updated By', value: 'updated_by' },
				],
				default: 'installed',
				description: 'The field to sort by (Canvas sorts by installation date unless told otherwise)',
			},
		],
	},

	// ----------------------------------
	//         ltiRegistration: get
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Account Binding', value: 'account_binding' },
					{ name: 'Configuration', value: 'configuration' },
					{ name: 'Overlaid Configuration', value: 'overlaid_configuration' },
					{ name: 'Overlaid Legacy Configuration', value: 'overlaid_legacy_configuration' },
					{ name: 'Overlay', value: 'overlay' },
					{ name: 'Overlay Versions', value: 'overlay_versions' },
				],
				default: [],
				description:
					'Additional data to include with the registration (account binding and configuration are always included)',
			},
		],
	},
];
