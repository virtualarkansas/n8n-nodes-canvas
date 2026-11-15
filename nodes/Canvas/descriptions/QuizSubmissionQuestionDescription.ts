import type { INodeProperties } from 'n8n-workflow';

export const quizSubmissionQuestionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['quizSubmissionQuestion'],
			},
		},
		options: [
			{
				name: 'Answer',
				value: 'answer',
				description: 'Provide or change answers in a quiz attempt that is in progress',
				action: 'Answer quiz submission questions',
			},
			{
				name: 'Flag',
				value: 'flag',
				description: 'Mark a question of an attempt in progress for review',
				action: 'Flag a quiz submission question',
			},
			{
				name: 'Get Formatted Answer',
				value: 'getFormattedAnswer',
				description: 'Get a numerical answer the way the quiz page formats it when a student types it in',
				action: 'Get a formatted quiz answer',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the questions of a quiz submission with the answers given',
				action: 'Get many quiz submission questions',
			},
			{
				name: 'Unflag',
				value: 'unflag',
				description: 'Remove the review mark from a question of an attempt in progress',
				action: 'Unflag a quiz submission question',
			},
		],
		default: 'getAll',
	},
];

export const quizSubmissionQuestionFields: INodeProperties[] = [
	{
		displayName: 'These operations act on a quiz attempt that is in progress and belong to the student taking it. The attempt number and validation token come from the quiz submission that started the attempt.',
		name: 'quizTakingNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmissionQuestion'],
				operation: ['answer', 'flag', 'unflag'],
			},
		},
	},
	{
		displayName: 'Quiz Submission ID',
		name: 'quizSubmissionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmissionQuestion'],
			},
		},
		description: 'The ID of the quiz submission',
	},
	{
		displayName: 'Question ID',
		name: 'questionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmissionQuestion'],
				operation: ['flag', 'unflag', 'getFormattedAnswer'],
			},
		},
		description: 'The ID of the question',
	},
	{
		displayName: 'Answer',
		name: 'answer',
		type: 'string',
		required: true,
		default: '',
		placeholder: '12.123456',
		displayOptions: {
			show: {
				resource: ['quizSubmissionQuestion'],
				operation: ['getFormattedAnswer'],
			},
		},
		description:
			'The answer as the student typed it. For a numerical question Canvas returns the number the way the quiz page would show it (rounded to 4 decimal places, or to 16 significant digits when the question asks for a precision); answers to other kinds of questions come back unchanged.',
	},
	{
		displayName: 'Attempt',
		name: 'attempt',
		type: 'number',
		required: true,
		default: 1,
		displayOptions: {
			show: {
				resource: ['quizSubmissionQuestion'],
				operation: ['answer', 'flag', 'unflag'],
			},
		},
		description: 'The number of the attempt in progress (must be the latest attempt)',
	},
	{
		displayName: 'Validation Token',
		name: 'validationToken',
		type: 'string',
		required: true,
		typeOptions: { password: true },
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmissionQuestion'],
				operation: ['answer', 'flag', 'unflag'],
			},
		},
		description: 'The validation token returned when the quiz submission was created',
	},
	{
		displayName: 'Answers',
		name: 'answers',
		type: 'json',
		required: true,
		default: '[]',
		placeholder: '[{"question_id": 12, "answer": "Hello"}, {"question_id": 13, "answer": 42}]',
		displayOptions: {
			show: {
				resource: ['quizSubmissionQuestion'],
				operation: ['answer'],
			},
		},
		description:
			'A JSON array with one entry per question: question_id and answer, the answer in the format Canvas expects for that question type',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizSubmissionQuestion'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Quiz Question', value: 'quiz_question' },
				],
				default: [],
				description: 'Extra information to return',
			},
		],
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizSubmissionQuestion'],
				operation: ['answer', 'flag', 'unflag'],
			},
		},
		options: [
			{
				displayName: 'Access Code',
				name: 'access_code',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'The access code of the quiz, if it has one',
			},
		],
	},
];
