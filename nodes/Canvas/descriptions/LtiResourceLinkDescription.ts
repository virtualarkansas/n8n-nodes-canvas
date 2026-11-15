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
		description:
			'The launch URL for the resource link. An LTI 1.3 tool matching this URL must be installed in the course (or an account above it), otherwise Canvas refuses the link.',
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
				description:
					'Custom parameters to send to the tool on launch, as a JSON object of names and string values, e.g. {"chapter": "12"}',
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
		// The JSON key really is lower-case "url".
		// eslint-disable-next-line n8n-nodes-base/node-param-description-miscased-url
		description:
			'JSON array of the resource links to create (max 100), e.g. [{"url": "https://tool.example.com/launch/1", "title": "Chapter 1", "custom": {"chapter": "1"}}]. Each needs a URL matching an LTI 1.3 tool of the course; title and custom are optional. If one entry is invalid, none is created.',
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
				description:
					'The ID of the LTI 1.3 external tool the link belongs to. The URL of the link must match the URL or domain of that tool.',
			},
			{
				displayName: 'Custom Parameters',
				name: 'custom',
				type: 'json',
				default: '{}',
				description:
					'Custom parameters to send to the tool on launch, as a JSON object of names and string values, e.g. {"chapter": "12"}',
			},
			{
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: false,
				description: 'Whether to find and update the link even if it is deleted',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				description:
					'The new launch URL for the resource link. Must match the URL or domain of the tool of the link.',
			},
		],
	},

	// ----------------------------------
	//         ltiResourceLink: getAll
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
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include Deleted',
				name: 'include_deleted',
				type: 'boolean',
				default: false,
				description:
					'Whether to include deleted resource links and links associated with deleted content',
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
				description: 'Whether to find the link even if it is deleted',
			},
		],
	},
];
