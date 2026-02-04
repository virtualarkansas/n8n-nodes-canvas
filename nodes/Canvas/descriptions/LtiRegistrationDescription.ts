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
				description: 'Bind an LTI registration to an account',
				action: 'Bind an LTI registration to an account',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create an LTI registration',
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
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many LTI registrations',
				action: 'Get many LTI registrations',
			},
			{
				name: 'Reset',
				value: 'reset',
				description: 'Reset an LTI registration to its default configuration',
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
				operation: ['bind', 'create', 'delete', 'get', 'getAll', 'getByClientId', 'reset', 'update'],
			},
		},
		description: 'The ID of the account',
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
				operation: ['bind', 'delete', 'get', 'reset', 'update'],
			},
		},
		description: 'The ID of the LTI registration',
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
		description: 'The client ID of the LTI registration',
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
			{ name: 'Allow', value: 'allow' },
			{ name: 'Off', value: 'off' },
			{ name: 'On', value: 'on' },
		],
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
				operation: ['bind'],
			},
		},
		description: 'The workflow state for the registration binding',
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
		description: 'The LTI tool configuration (JSON object following Lti::ToolConfiguration or Lti::LegacyConfiguration format)',
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
				description: 'The name of the tool',
			},
			{
				displayName: 'Overlay',
				name: 'overlay',
				type: 'json',
				default: '{}',
				description: 'Configuration overlay (JSON object following Lti::Overlay format)',
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
				description: 'The workflow state for the registration',
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
				description: 'The LTI tool configuration (not allowed for Dynamic Registration)',
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
				description: 'The name of the tool',
			},
			{
				displayName: 'Overlay',
				name: 'overlay',
				type: 'json',
				default: '{}',
				description: 'Configuration overlay (JSON object following Lti::Overlay format)',
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
				description: 'The workflow state for the registration',
			},
		],
	},

	// ----------------------------------
	//         ltiRegistration: getAll
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['ltiRegistration'],
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
				resource: ['ltiRegistration'],
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
					{ name: 'Overlay', value: 'overlay' },
					{ name: 'Overlaid Configuration', value: 'overlaid_configuration' },
				],
				default: [],
				description: 'Additional data to include with each registration',
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
				default: 'name',
				description: 'The field to sort by',
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
				description: 'Additional data to include with the registration',
			},
		],
	},
];
