import type { INodeProperties } from 'n8n-workflow';

export const quizQuestionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['quizQuestion'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new quiz question',
				action: 'Create a quiz question',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a quiz question',
				action: 'Delete a quiz question',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single quiz question',
				action: 'Get a quiz question',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many quiz questions',
				action: 'Get many quiz questions',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a quiz question',
				action: 'Update a quiz question',
			},
		],
		default: 'getAll',
	},
];

export const quizQuestionFields: INodeProperties[] = [
	// ----------------------------------
	//         quizQuestion: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizQuestion'],
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
				resource: ['quizQuestion'],
			},
		},
		description: 'The ID of the quiz',
	},

	// ----------------------------------
	//         quizQuestion: get, update, delete
	// ----------------------------------
	{
		displayName: 'Question ID',
		name: 'questionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizQuestion'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the quiz question',
	},

	// ----------------------------------
	//         quizQuestion: create
	// ----------------------------------
	{
		displayName: 'Question Name',
		name: 'questionName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizQuestion'],
				operation: ['create'],
			},
		},
		description: 'The name/title of the question',
	},
	{
		displayName: 'Question Text',
		name: 'questionText',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizQuestion'],
				operation: ['create'],
			},
		},
		description: 'The text of the question (supports HTML)',
	},
	{
		displayName: 'Question Type',
		name: 'questionType',
		type: 'options',
		required: true,
		options: [
			{ name: 'Calculated', value: 'calculated_question' },
			{ name: 'Essay', value: 'essay_question' },
			{ name: 'File Upload', value: 'file_upload_question' },
			{ name: 'Fill in Multiple Blanks', value: 'fill_in_multiple_blanks_question' },
			{ name: 'Matching', value: 'matching_question' },
			{ name: 'Multiple Answers', value: 'multiple_answers_question' },
			{ name: 'Multiple Choice', value: 'multiple_choice_question' },
			{ name: 'Multiple Dropdowns', value: 'multiple_dropdowns_question' },
			{ name: 'Numerical', value: 'numerical_question' },
			{ name: 'Short Answer', value: 'short_answer_question' },
			{ name: 'Text Only (No Question)', value: 'text_only_question' },
			{ name: 'True/False', value: 'true_false_question' },
		],
		default: 'multiple_choice_question',
		displayOptions: {
			show: {
				resource: ['quizQuestion'],
				operation: ['create'],
			},
		},
		description: 'The type of question',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizQuestion'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Answers',
				name: 'answers',
				type: 'json',
				default: '[]',
				description: 'Array of answer objects. Format depends on question type.',
			},
			{
				displayName: 'Correct Comments',
				name: 'correct_comments',
				type: 'string',
				default: '',
				description: 'Comment to display when student answers correctly',
			},
			{
				displayName: 'Correct Comments HTML',
				name: 'correct_comments_html',
				type: 'string',
				default: '',
				description: 'HTML formatted comment for correct answers',
			},
			{
				displayName: 'Incorrect Comments',
				name: 'incorrect_comments',
				type: 'string',
				default: '',
				description: 'Comment to display when student answers incorrectly',
			},
			{
				displayName: 'Incorrect Comments HTML',
				name: 'incorrect_comments_html',
				type: 'string',
				default: '',
				description: 'HTML formatted comment for incorrect answers',
			},
			{
				displayName: 'Neutral Comments',
				name: 'neutral_comments',
				type: 'string',
				default: '',
				description: 'Comment to display regardless of answer',
			},
			{
				displayName: 'Neutral Comments HTML',
				name: 'neutral_comments_html',
				type: 'string',
				default: '',
				description: 'HTML formatted neutral comment',
			},
			{
				displayName: 'Points Possible',
				name: 'points_possible',
				type: 'number',
				default: 1,
				description: 'The number of points for this question',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 1,
				description: 'The position of the question within the quiz',
			},
			{
				displayName: 'Quiz Group ID',
				name: 'quiz_group_id',
				type: 'string',
				default: '',
				description: 'The ID of the question group to add this question to',
			},
			{
				displayName: 'Text After Answers',
				name: 'text_after_answers',
				type: 'string',
				default: '',
				description: 'Text to display after the answer choices',
			},
		],
	},

	// ----------------------------------
	//         quizQuestion: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizQuestion'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Answers',
				name: 'answers',
				type: 'json',
				default: '[]',
				description: 'Array of answer objects. Format depends on question type.',
			},
			{
				displayName: 'Correct Comments',
				name: 'correct_comments',
				type: 'string',
				default: '',
				description: 'Comment to display when student answers correctly',
			},
			{
				displayName: 'Correct Comments HTML',
				name: 'correct_comments_html',
				type: 'string',
				default: '',
				description: 'HTML formatted comment for correct answers',
			},
			{
				displayName: 'Incorrect Comments',
				name: 'incorrect_comments',
				type: 'string',
				default: '',
				description: 'Comment to display when student answers incorrectly',
			},
			{
				displayName: 'Incorrect Comments HTML',
				name: 'incorrect_comments_html',
				type: 'string',
				default: '',
				description: 'HTML formatted comment for incorrect answers',
			},
			{
				displayName: 'Neutral Comments',
				name: 'neutral_comments',
				type: 'string',
				default: '',
				description: 'Comment to display regardless of answer',
			},
			{
				displayName: 'Neutral Comments HTML',
				name: 'neutral_comments_html',
				type: 'string',
				default: '',
				description: 'HTML formatted neutral comment',
			},
			{
				displayName: 'Points Possible',
				name: 'points_possible',
				type: 'number',
				default: 1,
				description: 'The number of points for this question',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 1,
				description: 'The position of the question within the quiz',
			},
			{
				displayName: 'Question Name',
				name: 'question_name',
				type: 'string',
				default: '',
				description: 'The name/title of the question',
			},
			{
				displayName: 'Question Text',
				name: 'question_text',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The text of the question (supports HTML)',
			},
			{
				displayName: 'Question Type',
				name: 'question_type',
				type: 'options',
				options: [
					{ name: 'Calculated', value: 'calculated_question' },
					{ name: 'Essay', value: 'essay_question' },
					{ name: 'File Upload', value: 'file_upload_question' },
					{ name: 'Fill in Multiple Blanks', value: 'fill_in_multiple_blanks_question' },
					{ name: 'Matching', value: 'matching_question' },
					{ name: 'Multiple Answers', value: 'multiple_answers_question' },
					{ name: 'Multiple Choice', value: 'multiple_choice_question' },
					{ name: 'Multiple Dropdowns', value: 'multiple_dropdowns_question' },
					{ name: 'Numerical', value: 'numerical_question' },
					{ name: 'Short Answer', value: 'short_answer_question' },
					{ name: 'Text Only (No Question)', value: 'text_only_question' },
					{ name: 'True/False', value: 'true_false_question' },
				],
				default: 'multiple_choice_question',
				description: 'The type of question',
			},
			{
				displayName: 'Quiz Group ID',
				name: 'quiz_group_id',
				type: 'string',
				default: '',
				description: 'The ID of the question group to add this question to',
			},
			{
				displayName: 'Text After Answers',
				name: 'text_after_answers',
				type: 'string',
				default: '',
				description: 'Text to display after the answer choices',
			},
		],
	},

	// ----------------------------------
	//         quizQuestion: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizQuestion'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Quiz Submission Attempt',
				name: 'quiz_submission_attempt',
				type: 'number',
				default: 0,
				description: 'The attempt number of the quiz submission to filter by',
			},
			{
				displayName: 'Quiz Submission ID',
				name: 'quiz_submission_id',
				type: 'string',
				default: '',
				description: 'If specified, returns questions for this quiz submission',
			},
		],
	},
];
