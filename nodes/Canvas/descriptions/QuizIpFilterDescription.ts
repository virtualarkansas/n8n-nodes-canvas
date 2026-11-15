import type { INodeProperties } from 'n8n-workflow';

export const quizIpFilterOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['quizIpFilter'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the IP filters a quiz can be restricted to (defined in the account settings)',
				action: 'Get many quiz IP filters',
			},
		],
		default: 'getAll',
	},
];

export const quizIpFilterFields: INodeProperties[] = [
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizIpFilter'],
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
				resource: ['quizIpFilter'],
			},
		},
		description: 'The ID of the quiz',
	},
];
