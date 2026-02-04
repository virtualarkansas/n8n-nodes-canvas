import type { INodeProperties } from 'n8n-workflow';

export const externalToolOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['externalTool'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create an external tool',
				action: 'Create an external tool',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an external tool',
				action: 'Delete an external tool',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single external tool',
				action: 'Get an external tool',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many external tools',
				action: 'Get many external tools',
			},
			{
				name: 'Get Sessionless Launch URL',
				value: 'getSessionlessLaunchUrl',
				description: 'Get a sessionless launch URL for an external tool',
				action: 'Get sessionless launch URL for an external tool',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an external tool',
				action: 'Update an external tool',
			},
		],
		default: 'getAll',
	},
];

export const externalToolFields: INodeProperties[] = [
	// ----------------------------------
	//         externalTool: shared
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		options: [
			{ name: 'Account', value: 'account' },
			{ name: 'Course', value: 'course' },
			{ name: 'Group', value: 'group' },
		],
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['create', 'delete', 'get', 'getAll', 'getSessionlessLaunchUrl', 'update'],
			},
		},
		description: 'The context type for the external tool',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['create', 'delete', 'get', 'getAll', 'getSessionlessLaunchUrl', 'update'],
				contextType: ['account'],
			},
		},
		description: 'The ID of the account',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['create', 'delete', 'get', 'getAll', 'getSessionlessLaunchUrl', 'update'],
				contextType: ['course'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['getAll'],
				contextType: ['group'],
			},
		},
		description: 'The ID of the group',
	},
	{
		displayName: 'External Tool ID',
		name: 'externalToolId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['delete', 'get', 'update'],
			},
		},
		description: 'The ID of the external tool',
	},

	// ----------------------------------
	//         externalTool: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['create'],
			},
		},
		description: 'The name of the external tool',
	},
	{
		displayName: 'Privacy Level',
		name: 'privacyLevel',
		type: 'options',
		required: true,
		default: 'anonymous',
		options: [
			{ name: 'Anonymous', value: 'anonymous' },
			{ name: 'Email Only', value: 'email_only' },
			{ name: 'Name Only', value: 'name_only' },
			{ name: 'Public', value: 'public' },
		],
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['create'],
			},
		},
		description: 'What information to send to the tool provider',
	},
	{
		displayName: 'Authentication Type',
		name: 'authType',
		type: 'options',
		required: true,
		default: 'lti11',
		options: [
			{ name: 'LTI 1.1 (Consumer Key/Secret)', value: 'lti11' },
			{ name: 'LTI 1.3 (Client ID)', value: 'lti13' },
		],
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['create'],
			},
		},
		description: 'The authentication type for the external tool',
	},
	{
		displayName: 'Consumer Key',
		name: 'consumerKey',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['create'],
				authType: ['lti11'],
			},
		},
		description: 'The consumer key for LTI 1.1 authentication',
	},
	{
		displayName: 'Shared Secret',
		name: 'sharedSecret',
		type: 'string',
		typeOptions: {
			password: true,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['create'],
				authType: ['lti11'],
			},
		},
		description: 'The shared secret for LTI 1.1 authentication',
	},
	{
		displayName: 'Client ID',
		name: 'clientId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['create'],
				authType: ['lti13'],
			},
		},
		description: 'The client ID for LTI 1.3 authentication',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Config Type',
				name: 'config_type',
				type: 'options',
				options: [
					{ name: 'By URL', value: 'by_url' },
					{ name: 'By XML', value: 'by_xml' },
				],
				default: 'by_url',
				description: 'Configuration type for the tool',
			},
			{
				displayName: 'Config URL',
				name: 'config_url',
				type: 'string',
				default: '',
				description: 'URL where the tool configuration XML can be fetched',
			},
			{
				displayName: 'Config XML',
				name: 'config_xml',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'XML configuration for the tool',
			},
			{
				displayName: 'Custom Fields',
				name: 'custom_fields',
				type: 'json',
				default: '{}',
				description: 'Custom fields to send to the tool (JSON object)',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 2,
				},
				default: '',
				description: 'A description of the tool',
			},
			{
				displayName: 'Domain',
				name: 'domain',
				type: 'string',
				default: '',
				description: 'The domain to match links against',
			},
			{
				displayName: 'Icon URL',
				name: 'icon_url',
				type: 'string',
				default: '',
				description: 'The URL for the tool icon',
			},
			{
				displayName: 'Is RCE Favorite',
				name: 'is_rce_favorite',
				type: 'boolean',
				default: false,
				description: 'Whether this tool is a favorite in the Rich Content Editor',
			},
			{
				displayName: 'Not Selectable',
				name: 'not_selectable',
				type: 'boolean',
				default: false,
				description: 'Whether this tool should not be selectable',
			},
			{
				displayName: 'OAuth Compliant',
				name: 'oauth_compliant',
				type: 'boolean',
				default: false,
				description: 'Whether to send OAuth credentials in the request body',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				default: '',
				description: 'The default text to display for the tool',
			},
			{
				displayName: 'Unified Tool ID',
				name: 'unified_tool_id',
				type: 'string',
				default: '',
				description: 'A unique identifier for the tool across different contexts',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				description: 'The launch URL for the tool',
			},
		],
	},

	// ----------------------------------
	//         externalTool: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Config Type',
				name: 'config_type',
				type: 'options',
				options: [
					{ name: 'By URL', value: 'by_url' },
					{ name: 'By XML', value: 'by_xml' },
				],
				default: 'by_url',
				description: 'Configuration type for the tool',
			},
			{
				displayName: 'Config URL',
				name: 'config_url',
				type: 'string',
				default: '',
				description: 'URL where the tool configuration XML can be fetched',
			},
			{
				displayName: 'Config XML',
				name: 'config_xml',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'XML configuration for the tool',
			},
			{
				displayName: 'Consumer Key',
				name: 'consumer_key',
				type: 'string',
				default: '',
				description: 'The consumer key for LTI 1.1 authentication',
			},
			{
				displayName: 'Custom Fields',
				name: 'custom_fields',
				type: 'json',
				default: '{}',
				description: 'Custom fields to send to the tool (JSON object)',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 2,
				},
				default: '',
				description: 'A description of the tool',
			},
			{
				displayName: 'Domain',
				name: 'domain',
				type: 'string',
				default: '',
				description: 'The domain to match links against',
			},
			{
				displayName: 'Icon URL',
				name: 'icon_url',
				type: 'string',
				default: '',
				description: 'The URL for the tool icon',
			},
			{
				displayName: 'Is RCE Favorite',
				name: 'is_rce_favorite',
				type: 'boolean',
				default: false,
				description: 'Whether this tool is a favorite in the Rich Content Editor',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the external tool',
			},
			{
				displayName: 'Not Selectable',
				name: 'not_selectable',
				type: 'boolean',
				default: false,
				description: 'Whether this tool should not be selectable',
			},
			{
				displayName: 'OAuth Compliant',
				name: 'oauth_compliant',
				type: 'boolean',
				default: false,
				description: 'Whether to send OAuth credentials in the request body',
			},
			{
				displayName: 'Privacy Level',
				name: 'privacy_level',
				type: 'options',
				options: [
					{ name: 'Anonymous', value: 'anonymous' },
					{ name: 'Email Only', value: 'email_only' },
					{ name: 'Name Only', value: 'name_only' },
					{ name: 'Public', value: 'public' },
				],
				default: 'anonymous',
				description: 'What information to send to the tool provider',
			},
			{
				displayName: 'Shared Secret',
				name: 'shared_secret',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				description: 'The shared secret for LTI 1.1 authentication',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				default: '',
				description: 'The default text to display for the tool',
			},
			{
				displayName: 'Unified Tool ID',
				name: 'unified_tool_id',
				type: 'string',
				default: '',
				description: 'A unique identifier for the tool across different contexts',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				description: 'The launch URL for the tool',
			},
		],
	},

	// ----------------------------------
	//         externalTool: getAll
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['externalTool'],
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
				resource: ['externalTool'],
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
				resource: ['externalTool'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include Parents',
				name: 'include_parents',
				type: 'boolean',
				default: false,
				description: 'Whether to include tools from parent accounts',
			},
			{
				displayName: 'Placement',
				name: 'placement',
				type: 'options',
				options: [
					{ name: 'Account Navigation', value: 'account_navigation' },
					{ name: 'Assignment Edit', value: 'assignment_edit' },
					{ name: 'Assignment Selection', value: 'assignment_selection' },
					{ name: 'Assignment View', value: 'assignment_view' },
					{ name: 'Collaboration', value: 'collaboration' },
					{ name: 'Course Navigation', value: 'course_navigation' },
					{ name: 'Editor Button', value: 'editor_button' },
					{ name: 'Global Navigation', value: 'global_navigation' },
					{ name: 'Homework Submission', value: 'homework_submission' },
					{ name: 'Link Selection', value: 'link_selection' },
					{ name: 'Migration Selection', value: 'migration_selection' },
					{ name: 'Module Menu', value: 'module_menu' },
					{ name: 'Post Grades', value: 'post_grades' },
					{ name: 'Submission Type Selection', value: 'submission_type_selection' },
					{ name: 'Tool Configuration', value: 'tool_configuration' },
					{ name: 'Top Navigation', value: 'top_navigation' },
					{ name: 'User Navigation', value: 'user_navigation' },
				],
				default: 'course_navigation',
				description: 'Filter tools by placement type',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Filter tools by partial name match',
			},
			{
				displayName: 'Selectable',
				name: 'selectable',
				type: 'boolean',
				default: false,
				description: 'Whether to return only selectable tools',
			},
		],
	},

	// ----------------------------------
	//         externalTool: getSessionlessLaunchUrl
	// ----------------------------------
	{
		displayName: 'External Tool ID',
		name: 'externalToolId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['getSessionlessLaunchUrl'],
			},
		},
		description: 'The ID of the external tool',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['getSessionlessLaunchUrl'],
			},
		},
		options: [
			{
				displayName: 'Assignment ID',
				name: 'assignment_id',
				type: 'string',
				default: '',
				description: 'The assignment ID for assessment launch type',
			},
			{
				displayName: 'Launch Type',
				name: 'launch_type',
				type: 'options',
				options: [
					{ name: 'Assessment', value: 'assessment' },
					{ name: 'Module Item', value: 'module_item' },
				],
				default: 'assessment',
				description: 'The type of launch',
			},
			{
				displayName: 'Module Item ID',
				name: 'module_item_id',
				type: 'string',
				default: '',
				description: 'The module item ID for module_item launch type',
			},
			{
				displayName: 'Resource Link Lookup UUID',
				name: 'resource_link_lookup_uuid',
				type: 'string',
				default: '',
				description: 'The UUID for the resource link lookup',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				description: 'The LTI launch URL',
			},
		],
	},
];
