import type { INodeProperties } from 'n8n-workflow';

export const newQuizOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['newQuiz'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new quiz',
				action: 'Create a new quiz',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a quiz',
				action: 'Delete a new quiz',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single quiz',
				action: 'Get a new quiz',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many quizzes',
				action: 'Get many new quizzes',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a quiz',
				action: 'Update a new quiz',
			},
		],
		default: 'getAll',
	},
];

export const newQuizFields: INodeProperties[] = [
	// ----------------------------------
	//         newQuiz: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['newQuiz'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         newQuiz: get, update, delete
	// ----------------------------------
	{
		displayName: 'Assignment ID',
		name: 'assignmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['newQuiz'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the assignment linked to the quiz',
	},

	// ----------------------------------
	//         newQuiz: create
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['newQuiz'],
				operation: ['create'],
			},
		},
		description: 'The title of the quiz',
	},

	// ----------------------------------
	//         newQuiz: create - additional fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['newQuiz'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Access Code',
				name: 'access_code',
				type: 'string',
				default: '',
				description: 'Access code required to take the quiz',
			},
			{
				displayName: 'Allow Backtracking',
				name: 'allow_backtracking',
				type: 'boolean',
				default: true,
				description: 'Whether students can navigate back to previous questions',
			},
			{
				displayName: 'Assignment Group ID',
				name: 'assignment_group_id',
				type: 'string',
				default: '',
				description: 'The ID of the assignment group to place this quiz in',
			},
			{
				displayName: 'Calculator Type',
				name: 'calculator_type',
				type: 'options',
				options: [
					{ name: 'None', value: 'none' },
					{ name: 'Basic', value: 'basic' },
					{ name: 'Scientific', value: 'scientific' },
				],
				default: 'none',
				description: 'The type of calculator available during the quiz',
			},
			{
				displayName: 'Due At',
				name: 'due_at',
				type: 'dateTime',
				default: '',
				description: 'The due date for the quiz (ISO 8601 format)',
			},
			{
				displayName: 'Filter IP Address',
				name: 'filter_ip_address',
				type: 'boolean',
				default: false,
				description: 'Whether to filter quiz access by IP address',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'json',
				default: '{}',
				description: 'IP address filter configuration (JSON object)',
			},
			{
				displayName: 'Grading Type',
				name: 'grading_type',
				type: 'options',
				options: [
					{ name: 'GPA Scale', value: 'gpa_scale' },
					{ name: 'Letter Grade', value: 'letter_grade' },
					{ name: 'Not Graded', value: 'not_graded' },
					{ name: 'Pass/Fail', value: 'pass_fail' },
					{ name: 'Percent', value: 'percent' },
					{ name: 'Points', value: 'points' },
				],
				default: 'points',
				description: 'The type of grading for this quiz',
			},
			{
				displayName: 'Instructions',
				name: 'instructions',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'Instructions for the quiz (supports HTML)',
			},
			{
				displayName: 'Lock At',
				name: 'lock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the quiz is locked',
			},
			{
				displayName: 'Multiple Attempts',
				name: 'multiple_attempts',
				type: 'options',
				options: [
					{ name: 'Allow', value: 'allow' },
					{ name: 'Deny', value: 'deny' },
				],
				default: 'deny',
				description: 'Whether multiple attempts are allowed',
			},
			{
				displayName: 'One At a Time Type',
				name: 'one_at_a_time_type',
				type: 'options',
				options: [
					{ name: 'None', value: 'none' },
					{ name: 'Question', value: 'question' },
				],
				default: 'none',
				description: 'Whether to display one question at a time',
			},
			{
				displayName: 'Points Possible',
				name: 'points_possible',
				type: 'number',
				default: 0,
				description: 'The maximum number of points for the quiz',
			},
			{
				displayName: 'Result View Settings',
				name: 'result_view_settings',
				type: 'json',
				default: '{}',
				description: 'Settings for what students can view after submission (JSON object)',
			},
			{
				displayName: 'Scoring Policy',
				name: 'scoring_policy',
				type: 'options',
				options: [
					{ name: 'Average', value: 'average' },
					{ name: 'Keep Highest', value: 'keep_highest' },
					{ name: 'Keep Latest', value: 'keep_latest' },
				],
				default: 'keep_highest',
				description: 'The scoring policy for multiple attempts',
			},
			{
				displayName: 'Session Time Limit in Seconds',
				name: 'session_time_limit_in_seconds',
				type: 'number',
				default: 0,
				description: 'Time limit for the quiz session in seconds (0 for no limit)',
			},
			{
				displayName: 'Shuffle Answers',
				name: 'shuffle_answers',
				type: 'boolean',
				default: false,
				description: 'Whether to shuffle answer choices',
			},
			{
				displayName: 'Shuffle Questions',
				name: 'shuffle_questions',
				type: 'boolean',
				default: false,
				description: 'Whether to shuffle questions',
			},
			{
				displayName: 'Unlock At',
				name: 'unlock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the quiz becomes available',
			},
		],
	},

	// ----------------------------------
	//         newQuiz: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['newQuiz'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Access Code',
				name: 'access_code',
				type: 'string',
				default: '',
				description: 'Access code required to take the quiz',
			},
			{
				displayName: 'Allow Backtracking',
				name: 'allow_backtracking',
				type: 'boolean',
				default: true,
				description: 'Whether students can navigate back to previous questions',
			},
			{
				displayName: 'Assignment Group ID',
				name: 'assignment_group_id',
				type: 'string',
				default: '',
				description: 'The ID of the assignment group to place this quiz in',
			},
			{
				displayName: 'Calculator Type',
				name: 'calculator_type',
				type: 'options',
				options: [
					{ name: 'None', value: 'none' },
					{ name: 'Basic', value: 'basic' },
					{ name: 'Scientific', value: 'scientific' },
				],
				default: 'none',
				description: 'The type of calculator available during the quiz',
			},
			{
				displayName: 'Due At',
				name: 'due_at',
				type: 'dateTime',
				default: '',
				description: 'The due date for the quiz (ISO 8601 format)',
			},
			{
				displayName: 'Filter IP Address',
				name: 'filter_ip_address',
				type: 'boolean',
				default: false,
				description: 'Whether to filter quiz access by IP address',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'json',
				default: '{}',
				description: 'IP address filter configuration (JSON object)',
			},
			{
				displayName: 'Grading Type',
				name: 'grading_type',
				type: 'options',
				options: [
					{ name: 'GPA Scale', value: 'gpa_scale' },
					{ name: 'Letter Grade', value: 'letter_grade' },
					{ name: 'Not Graded', value: 'not_graded' },
					{ name: 'Pass/Fail', value: 'pass_fail' },
					{ name: 'Percent', value: 'percent' },
					{ name: 'Points', value: 'points' },
				],
				default: 'points',
				description: 'The type of grading for this quiz',
			},
			{
				displayName: 'Instructions',
				name: 'instructions',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'Instructions for the quiz (supports HTML)',
			},
			{
				displayName: 'Lock At',
				name: 'lock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the quiz is locked',
			},
			{
				displayName: 'Multiple Attempts',
				name: 'multiple_attempts',
				type: 'options',
				options: [
					{ name: 'Allow', value: 'allow' },
					{ name: 'Deny', value: 'deny' },
				],
				default: 'deny',
				description: 'Whether multiple attempts are allowed',
			},
			{
				displayName: 'One At a Time Type',
				name: 'one_at_a_time_type',
				type: 'options',
				options: [
					{ name: 'None', value: 'none' },
					{ name: 'Question', value: 'question' },
				],
				default: 'none',
				description: 'Whether to display one question at a time',
			},
			{
				displayName: 'Points Possible',
				name: 'points_possible',
				type: 'number',
				default: 0,
				description: 'The maximum number of points for the quiz',
			},
			{
				displayName: 'Result View Settings',
				name: 'result_view_settings',
				type: 'json',
				default: '{}',
				description: 'Settings for what students can view after submission (JSON object)',
			},
			{
				displayName: 'Scoring Policy',
				name: 'scoring_policy',
				type: 'options',
				options: [
					{ name: 'Average', value: 'average' },
					{ name: 'Keep Highest', value: 'keep_highest' },
					{ name: 'Keep Latest', value: 'keep_latest' },
				],
				default: 'keep_highest',
				description: 'The scoring policy for multiple attempts',
			},
			{
				displayName: 'Session Time Limit in Seconds',
				name: 'session_time_limit_in_seconds',
				type: 'number',
				default: 0,
				description: 'Time limit for the quiz session in seconds (0 for no limit)',
			},
			{
				displayName: 'Shuffle Answers',
				name: 'shuffle_answers',
				type: 'boolean',
				default: false,
				description: 'Whether to shuffle answer choices',
			},
			{
				displayName: 'Shuffle Questions',
				name: 'shuffle_questions',
				type: 'boolean',
				default: false,
				description: 'Whether to shuffle questions',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the quiz',
			},
			{
				displayName: 'Unlock At',
				name: 'unlock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the quiz becomes available',
			},
		],
	},
];
