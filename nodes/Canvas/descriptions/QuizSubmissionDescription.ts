import type { INodeProperties } from 'n8n-workflow';

export const quizSubmissionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
			},
		},
		options: [
			{
				name: 'Complete',
				value: 'complete',
				description: 'Complete a quiz submission and grade it',
				action: 'Complete a quiz submission',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single quiz submission',
				action: 'Get a quiz submission',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many quiz submissions',
				action: 'Get many quiz submissions',
			},
			{
				name: 'Start',
				value: 'start',
				description: 'Start taking a quiz',
				action: 'Start a quiz submission',
			},
			{
				name: 'Update Score',
				value: 'updateScore',
				description: 'Update scores or comments for a quiz submission',
				action: 'Update quiz submission score',
			},
		],
		default: 'getAll',
	},
];

export const quizSubmissionFields: INodeProperties[] = [
	// ----------------------------------
	//         quizSubmission: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
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
				resource: ['quizSubmission'],
			},
		},
		description: 'The ID of the quiz',
	},

	// ----------------------------------
	//         quizSubmission: get, complete, updateScore
	// ----------------------------------
	{
		displayName: 'Submission ID',
		name: 'submissionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['get', 'complete', 'updateScore'],
			},
		},
		description: 'The ID of the quiz submission',
	},

	// ----------------------------------
	//         quizSubmission: start
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['start'],
			},
		},
		options: [
			{
				displayName: 'Access Code',
				name: 'access_code',
				type: 'string',
				default: '',
				description: 'Access code required if quiz has one set',
			},
			{
				displayName: 'Preview',
				name: 'preview',
				type: 'boolean',
				default: false,
				description: 'Whether this is a preview submission (will not be graded)',
			},
		],
	},

	// ----------------------------------
	//         quizSubmission: complete
	// ----------------------------------
	{
		displayName: 'Attempt',
		name: 'attempt',
		type: 'number',
		required: true,
		default: 1,
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['complete'],
			},
		},
		description: 'The attempt number being completed',
	},
	{
		displayName: 'Validation Token',
		name: 'validationToken',
		type: 'string',
		typeOptions: {
			password: true,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['complete'],
			},
		},
		description: 'The validation token returned when the submission was started',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['complete'],
			},
		},
		options: [
			{
				displayName: 'Access Code',
				name: 'access_code',
				type: 'string',
				default: '',
				description: 'Access code required if quiz has one set',
			},
		],
	},

	// ----------------------------------
	//         quizSubmission: updateScore
	// ----------------------------------
	{
		displayName: 'Attempt',
		name: 'attempt',
		type: 'number',
		required: true,
		default: 1,
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['updateScore'],
			},
		},
		description: 'The attempt number to update',
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['updateScore'],
			},
		},
		options: [
			{
				displayName: 'Fudge Points',
				name: 'fudge_points',
				type: 'number',
				default: 0,
				description: 'Amount of positive or negative points to fudge the total score',
			},
			{
				displayName: 'Questions',
				name: 'questions',
				type: 'json',
				default: '{}',
				description: 'Hash of question IDs to objects containing score and/or comment. Example: {"123": {"score": 5, "comment": "Good work!"}}.',
			},
		],
	},

	// ----------------------------------
	//         quizSubmission: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Quiz', value: 'quiz' },
					{ name: 'Submission', value: 'submission' },
					{ name: 'User', value: 'user' },
				],
				default: [],
				description: 'Additional information to include',
			},
		],
	},

	// ----------------------------------
	//         quizSubmission: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Quiz', value: 'quiz' },
					{ name: 'Submission', value: 'submission' },
					{ name: 'User', value: 'user' },
				],
				default: [],
				description: 'Additional information to include',
			},
		],
	},
];
