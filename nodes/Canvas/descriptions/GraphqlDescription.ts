import type { INodeProperties } from 'n8n-workflow';

export const graphqlOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['graphql'],
			},
		},
		options: [
			{
				name: 'Query',
				value: 'query',
				description: 'Run a GraphQL query or mutation',
				action: 'Run a graph ql query',
			},
		],
		default: 'query',
	},
];

export const graphqlFields: INodeProperties[] = [
	{
		displayName: 'Canvas\' GraphQL API reaches data the REST API does not, and is what much of the Canvas web interface uses. Explore the schema at /graphiql on your Canvas instance.',
		name: 'graphqlNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['graphql'],
			},
		},
	},
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		typeOptions: { rows: 8 },
		default: '',
		placeholder: 'query { allCourses { name courseCode state } }',
		displayOptions: {
			show: {
				resource: ['graphql'],
			},
		},
		description:
			'The GraphQL query or mutation. Canvas runs one operation per request, so the document must contain exactly one.',
	},
	{
		displayName: 'Variables',
		name: 'variables',
		type: 'json',
		default: '{}',
		placeholder: '{"first": 50}',
		displayOptions: {
			show: {
				resource: ['graphql'],
			},
		},
		description: 'The variables of the query as a JSON object',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['graphql'],
			},
		},
		options: [
			{
				displayName: 'Return Partial Data on Errors',
				name: 'continueOnGraphqlErrors',
				type: 'boolean',
				default: false,
				description: 'Whether to output the response, including its errors, when Canvas reports GraphQL errors, instead of treating the item as failed',
			},
		],
	},
];
