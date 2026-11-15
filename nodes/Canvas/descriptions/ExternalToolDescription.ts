import type { INodeProperties } from 'n8n-workflow';

/**
 * Placements Canvas accepts for an external tool. Used to filter the list and
 * to pick the launch URL of one placement for a sessionless launch.
 */
const placementOptions = [
	{ name: 'Account Navigation', value: 'account_navigation' },
	{ name: 'Assignment Edit', value: 'assignment_edit' },
	{ name: 'Assignment Group Menu', value: 'assignment_group_menu' },
	{ name: 'Assignment Index Menu', value: 'assignment_index_menu' },
	{ name: 'Assignment Menu', value: 'assignment_menu' },
	{ name: 'Assignment Selection', value: 'assignment_selection' },
	{ name: 'Assignment View', value: 'assignment_view' },
	{ name: 'Collaboration', value: 'collaboration' },
	{ name: 'Course Assignments Menu', value: 'course_assignments_menu' },
	{ name: 'Course Home Sub Navigation', value: 'course_home_sub_navigation' },
	{ name: 'Course Navigation', value: 'course_navigation' },
	{ name: 'Course Settings Sub Navigation', value: 'course_settings_sub_navigation' },
	{ name: 'Discussion Topic Index Menu', value: 'discussion_topic_index_menu' },
	{ name: 'Discussion Topic Menu', value: 'discussion_topic_menu' },
	{ name: 'Editor Button', value: 'editor_button' },
	{ name: 'File Index Menu', value: 'file_index_menu' },
	{ name: 'File Menu', value: 'file_menu' },
	{ name: 'Global Navigation', value: 'global_navigation' },
	{ name: 'Homework Submission', value: 'homework_submission' },
	{ name: 'Link Selection', value: 'link_selection' },
	{ name: 'Migration Selection', value: 'migration_selection' },
	{ name: 'Module Group Menu', value: 'module_group_menu' },
	{ name: 'Module Index Menu', value: 'module_index_menu' },
	{ name: 'Module Menu', value: 'module_menu' },
	{ name: 'Post Grades', value: 'post_grades' },
	{ name: 'Quiz Index Menu', value: 'quiz_index_menu' },
	{ name: 'Quiz Menu', value: 'quiz_menu' },
	{ name: 'Resource Selection', value: 'resource_selection' },
	{ name: 'Similarity Detection', value: 'similarity_detection' },
	{ name: 'Student Context Card', value: 'student_context_card' },
	{ name: 'Submission Type Selection', value: 'submission_type_selection' },
	{ name: 'Tool Configuration', value: 'tool_configuration' },
	{ name: 'Top Navigation', value: 'top_navigation' },
	{ name: 'User Navigation', value: 'user_navigation' },
	{ name: 'Wiki Index Menu', value: 'wiki_index_menu' },
	{ name: 'Wiki Page Menu', value: 'wiki_page_menu' },
];

/** Settings shared by Create (LTI 1.1) and Update. */
const toolSettingFields: INodeProperties[] = [
	{
		displayName: 'Config Type',
		name: 'config_type',
		type: 'options',
		options: [
			{ name: 'By URL', value: 'by_url' },
			{ name: 'By XML', value: 'by_xml' },
		],
		default: 'by_url',
		description:
			'Read the tool configuration from Common Cartridge XML instead of the individual fields. Set Config URL or Config XML to match.',
	},
	{
		displayName: 'Config URL',
		name: 'config_url',
		type: 'string',
		default: '',
		description:
			'URL Canvas fetches the XML tool configuration from. Required when Config Type is "By URL".',
	},
	{
		displayName: 'Config XML',
		name: 'config_xml',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		default: '',
		description: 'XML tool configuration. Required when Config Type is "By XML".',
	},
	{
		displayName: 'Custom Fields',
		name: 'custom_fields',
		type: 'json',
		default: '{}',
		description:
			'Custom fields sent to the tool on every launch, as a JSON object of names and string values, e.g. {"course_code": "$Canvas.course.sisSourceId"}',
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
		description:
			'The domain to match links against, e.g. "tool.example.com". Set either URL or Domain (or a placement URL), not both.',
	},
	{
		displayName: 'Icon URL',
		name: 'icon_url',
		type: 'string',
		default: '',
		description: 'The URL of the icon to show for this tool',
	},
	{
		displayName: 'Is RCE Favorite',
		name: 'is_rce_favorite',
		type: 'boolean',
		default: false,
		description:
			'Whether the tool appears in a preferred location in the Rich Content Editor. Deprecated by Canvas in favor of the Add / Remove RCE Favorite operations.',
	},
	{
		displayName: 'Not Selectable',
		name: 'not_selectable',
		type: 'boolean',
		default: false,
		description:
			'Whether to hide the tool from the external tool selection UI in modules and assignments',
	},
	{
		displayName: 'OAuth Compliant',
		name: 'oauth_compliant',
		type: 'boolean',
		default: false,
		description:
			'Whether Canvas keeps LTI query parameters out of the POST body (strict OAuth 1.0 signing)',
	},
	{
		displayName: 'Placements',
		name: 'placements',
		type: 'json',
		default: '{}',
		description:
			'Placement settings as a JSON object keyed by placement name, e.g. {"course_navigation": {"enabled": true, "text": "Library", "visibility": "members"}}. Each placement is sent as its own argument; on Update a placement set to null is removed.',
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		default: '',
		description: 'The default text to show for this tool (used as the label of its placements)',
	},
	{
		displayName: 'Unified Tool ID',
		name: 'unified_tool_id',
		type: 'string',
		default: '',
		description: 'The unique identifier for the tool in LearnPlatform',
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		default: '',
		description:
			'The launch URL to match links against. Set either URL or Domain (or a placement URL), not both.',
	},
];

const privacyLevelOptions = [
	{ name: 'Anonymous', value: 'anonymous' },
	{ name: 'Email Only', value: 'email_only' },
	{ name: 'Name Only', value: 'name_only' },
	{ name: 'Public', value: 'public' },
];

/** Update offers the Create settings plus the fields that are required on Create. */
const updateSettingFields: INodeProperties[] = [
	...toolSettingFields,
	{
		displayName: 'Consumer Key',
		name: 'consumer_key',
		type: 'string',
		default: '',
		description: 'The consumer key for the external tool',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		description: 'The name of the external tool',
	},
	{
		displayName: 'Privacy Level',
		name: 'privacy_level',
		type: 'options',
		options: privacyLevelOptions,
		default: 'anonymous',
		description: 'How much user information to send to the external tool',
	},
	{
		displayName: 'Shared Secret',
		name: 'shared_secret',
		type: 'string',
		typeOptions: {
			password: true,
		},
		default: '',
		description: 'The shared secret with the external tool. An empty value keeps the current secret.',
	},
].sort((a, b) => a.displayName.localeCompare(b.displayName)) as INodeProperties[];

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
				name: 'Add RCE Favorite',
				value: 'addRceFavorite',
				description:
					'Mark an editor button tool as a favorite in the Rich Content Editor of an account (at most 2)',
				action: 'Add an external tool to the RCE favorites',
			},
			{
				name: 'Add Top Navigation Favorite',
				value: 'addTopNavFavorite',
				description:
					'Give a top navigation tool its own button in the top navigation of an account (at most 2)',
				action: 'Add an external tool to the top navigation favorites',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Install an external tool in a course or account',
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
				description:
					'Get a URL that launches an external tool for the token\'s user without a Canvas session. When no installed tool matches, Canvas still answers successfully, with an "errors" field instead of the launch URL.',
				action: 'Get sessionless launch URL for an external tool',
			},
			{
				name: 'Get Visible Course Navigation Tools',
				value: 'getVisibleCourseNavTools',
				description:
					'Get the tools shown in the course navigation of one or more courses for the token\'s user',
				action: 'Get visible course navigation tools',
			},
			{
				name: 'Remove RCE Favorite',
				value: 'removeRceFavorite',
				description: 'Remove a tool from the Rich Content Editor favorites of an account',
				action: 'Remove an external tool from the RCE favorites',
			},
			{
				name: 'Remove Top Navigation Favorite',
				value: 'removeTopNavFavorite',
				description: 'Remove a tool from the top navigation favorites of an account',
				action: 'Remove an external tool from the top navigation favorites',
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
	//         externalTool: context
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
		],
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['create', 'delete', 'get', 'getSessionlessLaunchUrl', 'update'],
			},
		},
		description: 'Where the external tool is installed',
	},
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
				operation: ['getAll'],
			},
		},
		description:
			'The context to list tools for. A group has no tools of its own: turn on Include Parents to get the tools of its course and accounts.',
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
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['addRceFavorite', 'addTopNavFavorite', 'removeRceFavorite', 'removeTopNavFavorite'],
			},
		},
		description:
			'The ID of the account whose favorites are changed. Sub-accounts inherit the favorites until they set their own.',
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
				operation: [
					'addRceFavorite',
					'addTopNavFavorite',
					'delete',
					'get',
					'removeRceFavorite',
					'removeTopNavFavorite',
					'update',
				],
			},
		},
		description:
			'The ID of the external tool. For Get, Update and Delete the tool must be installed in the chosen context itself, not inherited from a parent account.',
	},

	// ----------------------------------
	//         externalTool: create
	// ----------------------------------
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
		description:
			'How the tool is installed. With LTI 1.3 Canvas takes every setting from the developer key / LTI registration of the client ID.',
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
		description:
			'The client ID of the LTI 1.3 developer key (the "developer_key_id" of an LTI registration). The key must be turned on for the account.',
	},
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
				authType: ['lti11'],
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
		options: privacyLevelOptions,
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['create'],
				authType: ['lti11'],
			},
		},
		description: 'How much user information to send to the external tool',
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
		description: 'The consumer key for the external tool',
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
		description: 'The shared secret with the external tool',
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
				authType: ['lti11'],
			},
		},
		description:
			'Canvas needs to know where the tool lives: set URL or Domain, a placement with its own URL, or a Config Type',
		options: toolSettingFields,
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
		description:
			'Changes made here to an LTI 1.3 tool are overwritten whenever its LTI registration / developer key configuration changes',
		options: updateSettingFields,
	},

	// ----------------------------------
	//         externalTool: getAll
	// ----------------------------------
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
				description: 'Whether to include tools installed in all accounts above the context',
			},
			{
				displayName: 'Placement',
				name: 'placement',
				type: 'options',
				options: placementOptions,
				default: 'course_navigation',
				description: 'Return only tools that have this placement',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'The partial name of the tools to match and return',
			},
			{
				displayName: 'Selectable',
				name: 'selectable',
				type: 'boolean',
				default: false,
				description: 'Whether to return only tools that are meant to be selectable',
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
		default: '',
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['getSessionlessLaunchUrl'],
			},
		},
		description:
			'The ID of the tool to launch. Can be left empty when a URL, a Resource Link Lookup UUID, or a Launch Type of Assessment / Module Item identifies the tool.',
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
				description:
					'The external tool assignment to launch. Required when Launch Type is "Assessment".',
			},
			{
				displayName: 'Launch Type',
				name: 'launch_type',
				type: 'options',
				options: [
					{ name: 'Assessment', value: 'assessment' },
					{ name: 'Module Item', value: 'module_item' },
					...placementOptions.map((placement) => ({
						name: `Placement: ${placement.name}`,
						value: placement.value,
					})),
				],
				default: 'assessment',
				description:
					'Launch an assignment or a module item, or use the launch URL of one placement of the tool (the External Tool ID is then required)',
			},
			{
				displayName: 'Module Item ID',
				name: 'module_item_id',
				type: 'string',
				default: '',
				description:
					'The external tool module item to launch. Required when Launch Type is "Module Item".',
			},
			{
				displayName: 'Resource Link Lookup UUID',
				name: 'resource_link_lookup_uuid',
				type: 'string',
				default: '',
				description:
					'The lookup UUID of an LTI resource link to launch. Takes precedence over every other option.',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				description:
					'The LTI launch URL. Canvas finds the tool by matching this URL when no External Tool ID is given.',
			},
		],
	},

	// ----------------------------------
	//         externalTool: getVisibleCourseNavTools
	// ----------------------------------
	{
		displayName: 'Course IDs',
		name: 'courseIds',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['externalTool'],
				operation: ['getVisibleCourseNavTools'],
			},
		},
		description:
			'Comma-separated IDs of the courses. Every tool comes back with the "context_id" and "context_name" of its course. SIS IDs are only accepted when a single course is given.',
	},
];
