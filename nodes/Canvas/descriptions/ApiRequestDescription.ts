import type { INodeProperties } from 'n8n-workflow';

export const apiRequestOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['apiRequest'],
			},
		},
		options: [
			{
				name: 'Request',
				value: 'request',
				description: 'Send a request to any path of your Canvas instance',
				action: 'Send a custom API request',
			},
		],
		default: 'request',
	},
];

export const apiRequestFields: INodeProperties[] = [
	{
		displayName: 'For endpoints this node has no operation for, including ones Instructure does not document. The request uses your Canvas credential and the node\'s rate limiting, pagination (for GET) and error handling. Undocumented endpoints can change without notice.',
		name: 'apiRequestNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['apiRequest'],
			},
		},
	},
	{
		displayName: 'Method',
		name: 'method',
		type: 'options',
		required: true,
		options: [
			{ name: 'DELETE', value: 'DELETE' },
			{ name: 'GET', value: 'GET' },
			{ name: 'PATCH', value: 'PATCH' },
			{ name: 'POST', value: 'POST' },
			{ name: 'PUT', value: 'PUT' },
		],
		default: 'GET',
		displayOptions: {
			show: {
				resource: ['apiRequest'],
			},
		},
		description: 'The HTTP method',
	},
	{
		displayName: 'Path',
		name: 'path',
		type: 'string',
		required: true,
		default: '',
		placeholder: '/api/v1/courses/123/gradebook_filters',
		displayOptions: {
			show: {
				resource: ['apiRequest'],
			},
		},
		description: 'The path on your Canvas instance, starting with a slash. A full URL of your Canvas instance is accepted too; the request always goes to the Canvas URL of the credential.',
	},
	{
		displayName: 'Query Parameters',
		name: 'query',
		type: 'json',
		default: '{}',
		placeholder: '{"include": ["term"], "state": "available"}',
		displayOptions: {
			show: {
				resource: ['apiRequest'],
			},
		},
		description: 'Query parameters as a JSON object. Arrays become key[]=value, nested objects key[sub]=value.',
	},
	{
		displayName: 'Body',
		name: 'body',
		type: 'json',
		default: '{}',
		placeholder: '{"course": {"name": "New name"}}',
		displayOptions: {
			show: {
				resource: ['apiRequest'],
				operation: ['request'],
				method: ['PATCH', 'POST', 'PUT', 'DELETE'],
			},
		},
		description: 'The JSON body to send',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['apiRequest'],
			},
		},
		options: [
			{
				displayName: 'Unwrap Key',
				name: 'dataKey',
				type: 'string',
				default: '',
				placeholder: 'events',
				description: 'If the response wraps its records in an object, e.g. {"events": [...]}, the key that holds them. Each record then becomes one item and pagination collects them across pages.',
			},
		],
	},
];
