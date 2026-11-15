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

/**
 * Settings accepted by both "Create" and "Update".
 *
 * The UI keeps them in one flat list; the handler puts each one where the New
 * Quizzes API expects it: quiz[...], quiz[quiz_settings][...] or
 * quiz[quiz_settings][multiple_attempts][...].
 */
const newQuizSettings: INodeProperties[] = [
	{
		displayName: 'Allow Backtracking',
		name: 'allow_backtracking',
		type: 'boolean',
		default: true,
		description:
			'Whether students can return to previous questions when "One at a Time Type" is "Question"',
	},
	{
		displayName: 'Assignment Group ID',
		name: 'assignment_group_id',
		type: 'string',
		default: '',
		description: 'The ID of the assignment group the quiz belongs to',
	},
	{
		displayName: 'Attempt Limit',
		name: 'attempt_limit',
		type: 'boolean',
		default: true,
		description:
			'Whether the number of attempts is limited (to "Max Attempts"). Only used when "Multiple Attempts Enabled" is on; off means unlimited attempts.',
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
		description: 'Which calculator students can use while taking the quiz',
	},
	{
		displayName: 'Cooling Period',
		name: 'cooling_period',
		type: 'boolean',
		default: false,
		description:
			'Whether students must wait between attempts (for "Cooling Period Seconds"). Only used when "Multiple Attempts Enabled" is on.',
	},
	{
		displayName: 'Cooling Period Seconds',
		name: 'cooling_period_seconds',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 3600,
		description: 'Required waiting time between attempts, in seconds. Only used when "Cooling Period" is on.',
	},
	{
		displayName: 'Due At',
		name: 'due_at',
		type: 'dateTime',
		default: '',
		description: 'When the quiz is due',
	},
	{
		displayName: 'Filter IP Address',
		name: 'filter_ip_address',
		type: 'boolean',
		default: false,
		description: 'Whether to restrict access by IP address. Must be on for "IP Filters" to take effect.',
	},
	{
		displayName: 'Grading Type',
		name: 'grading_type',
		type: 'options',
		options: [
			{ name: 'GPA Scale', value: 'gpa_scale' },
			{ name: 'Letter Grade', value: 'letter_grade' },
			{ name: 'Pass/Fail', value: 'pass_fail' },
			{ name: 'Percent', value: 'percent' },
			{ name: 'Points', value: 'points' },
		],
		default: 'points',
		description: 'The type of grading the assignment receives',
	},
	{
		displayName: 'Has Time Limit',
		name: 'has_time_limit',
		type: 'boolean',
		default: false,
		description:
			'Whether the quiz has a time limit (set in "Session Time Limit in Seconds"). Switched on automatically when a time limit above 0 is given.',
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
		displayName: 'IP Filters',
		name: 'filters',
		type: 'json',
		default: '[]',
		description:
			'JSON array of IP address ranges the quiz can be taken from, each range as [start address, end address]. Example: [["10.0.0.0", "10.10.0.0"], ["12.0.0.0", "12.10.10.0"]].',
	},
	{
		displayName: 'Lock At',
		name: 'lock_at',
		type: 'dateTime',
		default: '',
		description: 'When to lock the quiz',
	},
	{
		displayName: 'Max Attempts',
		name: 'max_attempts',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 2,
		description: 'Number of attempts a student can take. Only used when "Attempt Limit" is on.',
	},
	{
		displayName: 'Multiple Attempts Enabled',
		name: 'multiple_attempts_enabled',
		type: 'boolean',
		default: false,
		description: 'Whether students can take the quiz more than once',
	},
	{
		displayName: 'One at a Time Type',
		name: 'one_at_a_time_type',
		type: 'options',
		options: [
			{ name: 'None (All Questions at Once)', value: 'none' },
			{ name: 'Question (One Question at a Time)', value: 'question' },
		],
		default: 'none',
		description: 'How questions are displayed while taking the quiz',
	},
	{
		displayName: 'Points Possible',
		name: 'points_possible',
		type: 'number',
		default: 0,
		description: 'The total point value given to the quiz. Must be positive.',
	},
	{
		displayName: 'Require Student Access Code',
		name: 'require_student_access_code',
		type: 'boolean',
		default: false,
		description:
			'Whether an access code is needed to take the quiz. Switched on automatically when a "Student Access Code" is given.',
	},
	{
		displayName: 'Result View Settings',
		name: 'result_view_settings',
		type: 'json',
		default: '{}',
		description:
			'JSON object restricting what students see in their results. Keys: result_view_restricted (must be true for the others to apply), display_points_awarded, display_points_possible, display_items, display_item_response, display_item_response_qualifier (always, once_per_attempt, after_last_attempt, once_after_last_attempt), show_item_responses_at, hide_item_responses_at, display_item_response_correctness, display_item_response_correctness_qualifier (always, after_last_attempt), show_item_response_correctness_at, hide_item_response_correctness_at, display_item_correct_answer, display_item_feedback.',
	},
	{
		displayName: 'Score to Keep',
		name: 'score_to_keep',
		type: 'options',
		options: [
			{ name: 'Average', value: 'average' },
			{ name: 'First', value: 'first' },
			{ name: 'Highest', value: 'highest' },
			{ name: 'Latest', value: 'latest' },
		],
		default: 'highest',
		description: 'Which score to keep. Only used when "Multiple Attempts Enabled" is on.',
	},
	{
		displayName: 'Session Time Limit in Seconds',
		name: 'session_time_limit_in_seconds',
		type: 'number',
		typeOptions: {
			minValue: 0,
		},
		default: 3600,
		description: 'Time limit for the quiz in seconds. Set to 0 for no time limit.',
	},
	{
		displayName: 'Shuffle Answers',
		name: 'shuffle_answers',
		type: 'boolean',
		default: false,
		description: 'Whether answers are shuffled for students',
	},
	{
		displayName: 'Shuffle Questions',
		name: 'shuffle_questions',
		type: 'boolean',
		default: false,
		description: 'Whether questions are shuffled for students',
	},
	{
		displayName: 'Student Access Code',
		name: 'student_access_code',
		type: 'string',
		default: '',
		description: 'Access code students must enter to take the quiz',
	},
	{
		displayName: 'Unlock At',
		name: 'unlock_at',
		type: 'dateTime',
		default: '',
		description: 'When to unlock the quiz',
	},
];

const sortedByDisplayName = (fields: INodeProperties[]): INodeProperties[] =>
	[...fields].sort((a, b) => a.displayName.localeCompare(b.displayName));

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
		description:
			'The ID of the assignment linked to the quiz. New Quizzes are addressed by the ID of their assignment.',
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
		options: newQuizSettings,
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
		options: sortedByDisplayName([
			...newQuizSettings,
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the quiz',
			},
		]),
	},
];
