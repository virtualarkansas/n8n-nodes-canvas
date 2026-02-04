import type { INodeProperties } from 'n8n-workflow';

export const newQuizAccommodationsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['newQuizAccommodations'],
			},
		},
		options: [
			{
				name: 'Set Course Accommodations',
				value: 'setCourse',
				description: 'Set accommodations for a user at the course level',
				action: 'Set course accommodations for new quizzes',
			},
			{
				name: 'Set Quiz Accommodations',
				value: 'setQuiz',
				description: 'Set accommodations for a user on a specific quiz',
				action: 'Set quiz accommodations for new quizzes',
			},
		],
		default: 'setQuiz',
	},
];

export const newQuizAccommodationsFields: INodeProperties[] = [
	// ----------------------------------
	//         newQuizAccommodations: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['newQuizAccommodations'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['newQuizAccommodations'],
			},
		},
		description: 'The Canvas user ID receiving the accommodations',
	},

	// ----------------------------------
	//         newQuizAccommodations: setQuiz
	// ----------------------------------
	{
		displayName: 'Assignment ID',
		name: 'assignmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['newQuizAccommodations'],
				operation: ['setQuiz'],
			},
		},
		description: 'The ID of the assignment linked to the quiz',
	},

	// ----------------------------------
	//         newQuizAccommodations: setQuiz - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['newQuizAccommodations'],
				operation: ['setQuiz'],
			},
		},
		options: [
			{
				displayName: 'Extra Attempts',
				name: 'extra_attempts',
				type: 'number',
				default: 0,
				description: 'Additional quiz retake attempts allowed',
			},
			{
				displayName: 'Extra Time (Minutes)',
				name: 'extra_time',
				type: 'number',
				default: 0,
				description: 'Extra submission time in minutes (0-10080)',
			},
			{
				displayName: 'Reduce Choices Enabled',
				name: 'reduce_choices_enabled',
				type: 'boolean',
				default: false,
				description: 'Whether to remove one incorrect answer from questions with 4+ options',
			},
		],
	},

	// ----------------------------------
	//         newQuizAccommodations: setCourse - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['newQuizAccommodations'],
				operation: ['setCourse'],
			},
		},
		options: [
			{
				displayName: 'Apply to In-Progress Quiz Sessions',
				name: 'apply_to_in_progress_quiz_sessions',
				type: 'boolean',
				default: false,
				description: 'Whether to apply accommodations to active quiz sessions',
			},
			{
				displayName: 'Extra Time (Minutes)',
				name: 'extra_time',
				type: 'number',
				default: 0,
				description: 'Extra submission time in minutes (0-10080)',
			},
			{
				displayName: 'Reduce Choices Enabled',
				name: 'reduce_choices_enabled',
				type: 'boolean',
				default: false,
				description: 'Whether to remove one incorrect answer from questions with 4+ options',
			},
		],
	},
];
