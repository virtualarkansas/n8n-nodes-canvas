import type { INodeProperties } from 'n8n-workflow';

export const smartSearchOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['smartSearch'],
			},
		},
		options: [
			{
				name: 'Search',
				value: 'search',
				description: 'Find course content using AI-powered meaning-based search',
				action: 'Search course content',
			},
		],
		default: 'search',
	},
];

export const smartSearchFields: INodeProperties[] = [
	// ----------------------------------
	//         smartSearch: search
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['smartSearch'],
				operation: ['search'],
			},
		},
		description: 'The ID of the course to search within',
	},
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['smartSearch'],
				operation: ['search'],
			},
		},
		description: 'The search query term for meaning-based search',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['smartSearch'],
				operation: ['search'],
			},
		},
		options: [
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'multiOptions',
				default: [],
				options: [
					{
						name: 'Announcements',
						value: 'announcements',
					},
					{
						name: 'Assignments',
						value: 'assignments',
					},
					{
						name: 'Discussion Topics',
						value: 'discussion_topics',
					},
					{
						name: 'Pages',
						value: 'pages',
					},
				],
				description: 'Filter results by object type (searches all types by default)',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				default: [],
				options: [
					{
						name: 'Modules',
						value: 'modules',
					},
					{
						name: 'Status',
						value: 'status',
					},
				],
				description:
					'Additional data to include (status: published status/due dates, modules: parent module information)',
			},
		],
	},
];
