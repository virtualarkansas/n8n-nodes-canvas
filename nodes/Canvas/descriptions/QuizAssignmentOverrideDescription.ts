import type { INodeProperties } from 'n8n-workflow';

export const quizAssignmentOverrideOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['quizAssignmentOverride'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the due and availability dates that apply to the current user for each classic quiz of a course',
				action: 'Get many quiz assignment overrides',
			},
			{
				name: 'Get Many (New Quizzes)',
				value: 'getAllNewQuizzes',
				description: 'List the due and availability dates that apply to the current user for each New Quizzes quiz of a course',
				action: 'Get many new quizzes assignment overrides',
			},
		],
		default: 'getAll',
	},
];

export const quizAssignmentOverrideFields: INodeProperties[] = [
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizAssignmentOverride'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizAssignmentOverride'],
			},
		},
		options: [
			{
				displayName: 'Quiz IDs',
				name: 'quiz_ids',
				type: 'string',
				default: '',
				placeholder: '12, 15',
				description: 'Only return dates for these quizzes (IDs separated by commas). Leave empty for every quiz.',
			},
		],
	},
];
