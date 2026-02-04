import type { INodeProperties } from 'n8n-workflow';

export const ltiResourceLinkOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['ltiResourceLink'],
			},
		},
		options: [
			{
				name: 'Bulk Create',
				value: 'bulkCreate',
				description: 'Create multiple LTI resource links at once',
				action: 'Bulk create LTI resource links',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create an LTI resource link',
				action: 'Create an LTI resource link',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an LTI resource link',
				action: 'Delete an LTI resource link',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single LTI resource link',
				action: 'Get an LTI resource link',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many LTI resource links',
				action: 'Get many LTI resource links',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an LTI resource link',
				action: 'Update an LTI resource link',
			},
		],
		default: 'getAll',
	},
];

export const ltiResourceLinkFields: INodeProperties[] = [
	// ----------------------------------
	//         ltiResourceLink: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['ltiResourceLink'],
				operation: ['bulkCreate', 'create', 'delete', 'get', 'getAll', 'update'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Resource Link ID',
		name: 'resourceLinkId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['ltiResourceLink'],
				operation: ['delete', 'get', 'update'],
			},
		},
		description: 'The ID of the resource link. Can be a standard Canvas ID, resource_link_uuid:&lt;uuid&gt;, or lookup_uuid:&lt;uuid&gt;.',
	},

	// ----------------------------------
	//         ltiResourceLink: create
	// ----------------------------------
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['ltiResourceLink'],
				operation: ['create'],
			},
		},
		description: 'The launch URL for the resource link',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['ltiResourceLink'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Custom Parameters',
				name: 'custom',
				type: 'json',
				default: '{}',
				description: 'Custom parameters to send to the tool on launch (JSON object)',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the resource link',
			},
		],
	},

	// ----------------------------------
	//         ltiResourceLink: bulkCreate
	// ----------------------------------
	{
		displayName: 'Resource Links',
		name: 'resourceLinks',
		type: 'json',
		required: true,
		default: '[]',
		displayOptions: {
			show: {
				resource: ['ltiResourceLink'],
				operation: ['bulkCreate'],
			},
		},
		description: 'JSON array of resource links to create (max 100). Each object should have URL (required), title (optional), and custom (optional).',
	},

	// ----------------------------------
	//         ltiResourceLink: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['ltiResourceLink'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Context External Tool ID',
				name: 'context_external_tool_id',
				type: 'string',
				default: '',
				description: 'The ID of the associated external tool',
			},
			{
				displayName: 'Custom Parameters',
				name: 'custom',
				type: 'json',
				default: '{}',
				description: 'Custom parameters to send to the tool on launch (JSON object)',
			},
			{
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: false,
				description: 'Whether to allow updating deleted resource links',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				description: 'The new launch URL for the resource link',
			},
		],
	},

	// ----------------------------------
	//         ltiResourceLink: getAll
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['ltiResourceLink'],
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
				resource: ['ltiResourceLink'],
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
				resource: ['ltiResourceLink'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: false,
				description: 'Whether to include deleted resource links',
			},
			{
				displayName: 'Per Page',
				name: 'per_page',
				type: 'number',
				default: 50,
				description: 'Number of results per page',
			},
		],
	},

	// ----------------------------------
	//         ltiResourceLink: get
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['ltiResourceLink'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: false,
				description: 'Whether to include deleted resource links',
			},
		],
	},
];
