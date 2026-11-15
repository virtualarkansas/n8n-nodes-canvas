import type { INodeProperties } from 'n8n-workflow';

export const quizSubmissionUserOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['quizSubmissionUser'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the students who have, or have not, submitted a quiz',
				action: 'Get many quiz submission users',
			},
			{
				name: 'Message',
				value: 'message',
				description: 'Send a message to the students who have, or have not, submitted a quiz',
				action: 'Message quiz submission users',
			},
		],
		default: 'getAll',
	},
];

export const quizSubmissionUserFields: INodeProperties[] = [
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmissionUser'],
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
				resource: ['quizSubmissionUser'],
			},
		},
		description: 'The ID of the quiz',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizSubmissionUser'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Quiz Submissions', value: 'quiz_submissions' },
				],
				default: [],
				description: 'Extra information to return',
			},
			{
				displayName: 'Submitted',
				name: 'submitted',
				type: 'boolean',
				default: true,
				description: 'Whether to return the students who have submitted the quiz (on) or those who have not (off). Leave this option out to return every student.',
			},
		],
	},
	{
		displayName: 'Recipients',
		name: 'recipients',
		type: 'options',
		required: true,
		options: [
			{ name: 'Submitted', value: 'submitted' },
			{ name: 'Unsubmitted', value: 'unsubmitted' },
		],
		default: 'unsubmitted',
		displayOptions: {
			show: {
				resource: ['quizSubmissionUser'],
				operation: ['message'],
			},
		},
		description: 'Which students receive the message',
	},
	{
		displayName: 'Message',
		name: 'body',
		type: 'string',
		required: true,
		typeOptions: { rows: 4 },
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmissionUser'],
				operation: ['message'],
			},
		},
		description: 'The text of the message',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizSubmissionUser'],
				operation: ['message'],
			},
		},
		options: [
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
				description: 'The subject of the message',
			},
		],
	},
];
