import type { INodeProperties } from 'n8n-workflow';

export const quizSubmissionEventOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['quizSubmissionEvent'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the events captured while a student took a quiz (answers, page focus, ...)',
				action: 'Get many quiz submission events',
			},
		],
		default: 'getAll',
	},
];

export const quizSubmissionEventFields: INodeProperties[] = [
	{
		displayName: 'Canvas records these events only while the Quiz Log Auditing feature is enabled for the course.',
		name: 'quizLogNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmissionEvent'],
			},
		},
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmissionEvent'],
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
				resource: ['quizSubmissionEvent'],
			},
		},
		description: 'The ID of the quiz',
	},
	{
		displayName: 'Quiz Submission ID',
		name: 'quizSubmissionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmissionEvent'],
			},
		},
		description: 'The ID of the quiz submission',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizSubmissionEvent'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Attempt',
				name: 'attempt',
				type: 'number',
				default: 1,
				description: 'The attempt to return events for. Defaults to the latest attempt.',
			},
		],
	},
];
