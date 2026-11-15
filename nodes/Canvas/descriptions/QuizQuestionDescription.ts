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

const questionTypes = [
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
];

/** Optional settings accepted by both "Create" and "Update" (Canvas: question[...]). */
const questionSettings: INodeProperties[] = [
	{
		displayName: 'Answers',
		name: 'answers',
		type: 'json',
		default: '[]',
		description:
			'JSON array of answer objects. Keys depend on the question type: answer_text and answer_weight (100 = correct, 0 = incorrect) for choice questions, answer_comment for per-answer feedback, blank_id for blanks and dropdowns, answer_match_left / answer_match_right for matching, numerical_answer_type with answer_exact / answer_error_margin or answer_range_start / answer_range_end for numerical questions. On update the array replaces all existing answers.',
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
		displayName: 'Matching Distractors',
		name: 'matching_answer_incorrect_matches',
		type: 'string',
		typeOptions: {
			rows: 3,
		},
		default: '',
		description:
			'Matching questions only: extra wrong choices for the right-hand dropdown, one per line',
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
		displayName: 'Quiz Group ID',
		name: 'quiz_group_id',
		type: 'string',
		default: '',
		description: 'The ID of the question group (of the same quiz) to put this question in',
	},
];

const sortedByDisplayName = (fields: INodeProperties[]): INodeProperties[] =>
	[...fields].sort((a, b) => a.displayName.localeCompare(b.displayName));

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
		options: questionTypes,
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
		displayName:
			'New questions are added at the end of the quiz (or of their group). Use Quiz > Reorder to change the order. On a published quiz, students only see the change after the quiz is saved again ("Save It Now" in Canvas, or Quiz > Update with Published on).',
		name: 'createNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['quizQuestion'],
				operation: ['create'],
			},
		},
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
		options: questionSettings,
	},

	// ----------------------------------
	//         quizQuestion: update
	// ----------------------------------
	{
		displayName:
			'Canvas applies the fields you send on top of the question as it was first created, not on top of earlier updates: a field changed by a previous update and left out here goes back to its original value. Send every field you want to keep.',
		name: 'updateNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['quizQuestion'],
				operation: ['update'],
			},
		},
	},
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
		options: sortedByDisplayName([
			...questionSettings,
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
				options: questionTypes,
				default: 'multiple_choice_question',
				description: 'The type of question',
			},
		]),
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
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'The attempt of that quiz submission. Only used together with Quiz Submission ID.',
			},
			{
				displayName: 'Quiz Submission ID',
				name: 'quiz_submission_id',
				type: 'string',
				default: '',
				description:
					'Return the questions as they were presented in this quiz submission (useful when the quiz was changed afterwards) instead of the current questions of the quiz',
			},
		],
	},
];
