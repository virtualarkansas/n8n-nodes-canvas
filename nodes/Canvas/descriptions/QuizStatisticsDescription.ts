import type { INodeProperties } from 'n8n-workflow';

export const quizStatisticsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['quizStatistics'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get quiz statistics',
				action: 'Get quiz statistics',
			},
		],
		default: 'get',
	},
];

export const quizStatisticsFields: INodeProperties[] = [
	// ----------------------------------
	//         quizStatistics: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizStatistics'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Quiz ID',
		name: 'quizId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizStatistics'],
			},
		},
		description: 'The ID of the quiz',
	},

	// ----------------------------------
	//         quizStatistics: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizStatistics'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'All Versions',
				name: 'all_versions',
				type: 'boolean',
				default: false,
				description: 'Whether to include statistics from all submission attempts',
			},
		],
	},
];
