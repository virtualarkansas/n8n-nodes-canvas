import type { INodeProperties } from 'n8n-workflow';

export const quizOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['quiz'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new quiz',
				action: 'Create a quiz',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a quiz',
				action: 'Delete a quiz',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single quiz',
				action: 'Get a quiz',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many quizzes',
				action: 'Get many quizzes',
			},
			{
				name: 'Get Many (Classic and New)',
				value: 'getAllWithNewQuizzes',
				description: 'Get the classic quizzes and the New Quizzes of a course in one list (New Quizzes have the quiz type "quizzes.next"). Canvas caches this list for up to an hour.',
				action: 'Get many classic and new quizzes',
			},
			{
				name: 'Get Submission Users',
				value: 'getSubmissionUsers',
				description: 'List the students who have, or have not, submitted the quiz',
				action: 'Get the students who have or have not submitted a quiz',
			},
			{
				name: 'Message Students',
				value: 'messageStudents',
				description: 'Send a Canvas inbox message to the students who have, or have not, submitted the quiz',
				action: 'Message the students of a quiz',
			},
			{
				name: 'Reorder',
				value: 'reorder',
				description: 'Reorder quiz questions or groups',
				action: 'Reorder quiz items',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a quiz',
				action: 'Update a quiz',
			},
			{
				name: 'Validate Access Code',
				value: 'validateAccessCode',
				description: 'Validate an access code for a quiz',
				action: 'Validate quiz access code',
			},
		],
		default: 'getAll',
	},
];

/** Settings accepted by both "Create" and "Update" (Canvas: quiz[...]). */
const quizSettings: INodeProperties[] = [
	{
		displayName: 'Access Code',
		name: 'access_code',
		type: 'string',
		default: '',
		description: 'Password required to access the quiz. Send an empty value to remove it.',
	},
	{
		displayName: 'Allowed Attempts',
		name: 'allowed_attempts',
		type: 'number',
		default: 1,
		description: 'Number of times a student can take the quiz. Set to -1 for unlimited attempts.',
	},
	{
		displayName: 'Anonymous Submissions',
		name: 'anonymous_submissions',
		type: 'boolean',
		default: false,
		description: 'Whether survey responses are kept anonymous (surveys only)',
	},
	{
		displayName: 'Assignment Group ID',
		name: 'assignment_group_id',
		type: 'string',
		default: '',
		description:
			'The ID of the assignment group to place the quiz in (graded quizzes and graded surveys only). Must belong to the same course.',
	},
	{
		displayName: 'Cannot Go Back',
		name: 'cant_go_back',
		type: 'boolean',
		default: false,
		description:
			'Whether questions are locked after answering. Only takes effect together with "One Question at a Time" and is not sent when that option is switched off in the same request.',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		default: '',
		description: 'The quiz description (supports HTML)',
	},
	{
		displayName: 'Due At',
		name: 'due_at',
		type: 'dateTime',
		default: '',
		description: 'The due date for the quiz (ISO 8601 format)',
	},
	{
		displayName: 'Hide Correct Answers At',
		name: 'hide_correct_answers_at',
		type: 'dateTime',
		default: '',
		description: 'When to stop showing correct answers to students. Ignored unless "Show Correct Answers" is on.',
	},
	{
		displayName: 'Hide Results',
		name: 'hide_results',
		type: 'options',
		options: [
			{ name: 'Never (Students See Their Results)', value: '' },
			{ name: 'Always', value: 'always' },
			{ name: 'Until After Last Attempt', value: 'until_after_last_attempt' },
		],
		default: '',
		description:
			'When to hide quiz results from students. "Until After Last Attempt" is only accepted when Allowed Attempts is 2 or more.',
	},
	{
		displayName: 'IP Filter',
		name: 'ip_filter',
		type: 'string',
		default: '',
		description:
			'Restrict quiz access to specific IP addresses or ranges, comma-separated (for example 192.168.217.1, 192.168.217.1/24)',
	},
	{
		displayName: 'Lock At',
		name: 'lock_at',
		type: 'dateTime',
		default: '',
		description: 'When the quiz is locked and no longer available',
	},
	{
		displayName: 'Lockdown Browser Monitor Data',
		name: 'lockdown_browser_monitor_data',
		type: 'string',
		default: '',
		description: 'Additional settings for Respondus LockDown Browser Monitor',
	},
	{
		displayName: 'Lockdown Browser Monitor Required',
		name: 'require_lockdown_browser_monitor',
		type: 'boolean',
		default: false,
		description:
			'Whether students must be monitored during the quiz. Only takes effect when the Respondus LockDown Browser plugin is installed on the Canvas instance.',
	},
	{
		displayName: 'Lockdown Browser Required',
		name: 'require_lockdown_browser',
		type: 'boolean',
		default: false,
		description:
			'Whether students must use the Respondus LockDown Browser. Only takes effect when the plugin is installed on the Canvas instance.',
	},
	{
		displayName: 'One Question at a Time',
		name: 'one_question_at_a_time',
		type: 'boolean',
		default: false,
		description: 'Whether to show only one question at a time',
	},
	{
		displayName: 'One-Time Results',
		name: 'one_time_results',
		type: 'boolean',
		default: false,
		description:
			'Whether students can only view results once after each attempt. Ignored while "Hide Results" is set.',
	},
	{
		displayName: 'Only Visible to Overrides',
		name: 'only_visible_to_overrides',
		type: 'boolean',
		default: false,
		description: 'Whether the quiz is only visible to students with overrides',
	},
	{
		displayName: 'Points Possible',
		name: 'points_possible',
		type: 'number',
		default: 0,
		description:
			'The total point value of the quiz. For graded quizzes with questions Canvas recalculates this from the questions.',
	},
	{
		displayName: 'Published',
		name: 'published',
		type: 'boolean',
		default: false,
		description: 'Whether the quiz is published and visible to students',
	},
	{
		displayName: 'Quiz Type',
		name: 'quiz_type',
		type: 'options',
		options: [
			{ name: 'Graded Quiz', value: 'assignment' },
			{ name: 'Graded Survey', value: 'graded_survey' },
			{ name: 'Practice Quiz', value: 'practice_quiz' },
			{ name: 'Ungraded Survey', value: 'survey' },
		],
		default: 'assignment',
		description: 'The type of quiz',
	},
	{
		displayName: 'Scoring Policy',
		name: 'scoring_policy',
		type: 'options',
		options: [
			{ name: 'Keep Average', value: 'keep_average' },
			{ name: 'Keep Highest', value: 'keep_highest' },
			{ name: 'Keep Latest', value: 'keep_latest' },
		],
		default: 'keep_highest',
		description:
			'Which score to keep. Canvas only accepts it when Allowed Attempts is 2 or more (not with a single attempt, and not with -1 for unlimited).',
	},
	{
		displayName: 'Show Correct Answers',
		name: 'show_correct_answers',
		type: 'boolean',
		default: true,
		description: 'Whether to show correct answers after quiz submission. Ignored while "Hide Results" is set.',
	},
	{
		displayName: 'Show Correct Answers At',
		name: 'show_correct_answers_at',
		type: 'dateTime',
		default: '',
		description: 'When to start showing correct answers to students. Ignored unless "Show Correct Answers" is on.',
	},
	{
		displayName: 'Show Correct Answers Last Attempt',
		name: 'show_correct_answers_last_attempt',
		type: 'boolean',
		default: false,
		description:
			'Whether to only show correct answers after the last attempt. Only accepted when Allowed Attempts is 2 or more.',
	},
	{
		displayName: 'Shuffle Answers',
		name: 'shuffle_answers',
		type: 'boolean',
		default: false,
		description: 'Whether to shuffle the answer choices for each question',
	},
	{
		displayName: 'Time Limit',
		name: 'time_limit',
		type: 'number',
		typeOptions: {
			minValue: 0,
		},
		default: 60,
		description: 'Time limit in minutes. Set to 0 for no time limit.',
	},
	{
		displayName: 'Unlock At',
		name: 'unlock_at',
		type: 'dateTime',
		default: '',
		description: 'When the quiz becomes available to students',
	},
];

const sortedByDisplayName = (fields: INodeProperties[]): INodeProperties[] =>
	[...fields].sort((a, b) => a.displayName.localeCompare(b.displayName));

export const quizFields: INodeProperties[] = [
	// ----------------------------------
	//         quiz: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quiz'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         quiz: every operation on one quiz
	// ----------------------------------
	{
		displayName: 'Quiz ID',
		name: 'quizId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quiz'],
				operation: [
					'get',
					'update',
					'delete',
					'reorder',
					'validateAccessCode',
					'getSubmissionUsers',
					'messageStudents',
				],
			},
		},
		description: 'The ID of the quiz',
	},

	// ----------------------------------
	//         quiz: create
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quiz'],
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
				resource: ['quiz'],
				operation: ['create'],
			},
		},
		options: quizSettings,
	},

	// ----------------------------------
	//         quiz: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['quiz'],
				operation: ['update'],
			},
		},
		options: sortedByDisplayName([
			...quizSettings,
			{
				displayName: 'Notify of Update',
				name: 'notify_of_update',
				type: 'boolean',
				default: true,
				description: 'Whether to notify students that the quiz has been changed',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the quiz',
			},
		]),
	},

	// ----------------------------------
	//         quiz: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quiz'],
				operation: ['getAll', 'getAllWithNewQuizzes'],
			},
		},
		options: [
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Partial match for quiz title',
			},
		],
	},

	// ----------------------------------
	//         quiz: getSubmissionUsers
	// ----------------------------------
	{
		displayName: 'Students',
		name: 'submitted',
		type: 'options',
		options: [
			{ name: 'All Students', value: 'all' },
			{ name: 'Have Not Submitted', value: 'false' },
			{ name: 'Have Submitted', value: 'true' },
		],
		default: 'all',
		displayOptions: {
			show: {
				resource: ['quiz'],
				operation: ['getSubmissionUsers'],
			},
		},
		description: 'Which students of the course to return',
	},

	// ----------------------------------
	//         quiz: messageStudents
	// ----------------------------------
	{
		displayName: 'Recipients',
		name: 'recipients',
		type: 'options',
		options: [
			{ name: 'All Students', value: 'all' },
			{ name: 'Have Not Submitted', value: 'unsubmitted' },
			{ name: 'Have Submitted', value: 'submitted' },
		],
		default: 'unsubmitted',
		displayOptions: {
			show: {
				resource: ['quiz'],
				operation: ['messageStudents'],
			},
		},
		description: 'Which students of the course receive the message',
	},
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['quiz'],
				operation: ['messageStudents'],
			},
		},
		description: 'Subject of the conversation',
	},
	{
		displayName: 'Message',
		name: 'body',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quiz'],
				operation: ['messageStudents'],
			},
		},
		description:
			'The message text. Canvas delivers it in the background as a separate conversation with each student.',
	},

	// ----------------------------------
	//         quiz: reorder
	// ----------------------------------
	{
		displayName: 'Order Items',
		name: 'orderItems',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Item',
		default: {},
		displayOptions: {
			show: {
				resource: ['quiz'],
				operation: ['reorder'],
			},
		},
		description:
			'The questions and question groups of the quiz, in the order they should appear. Questions listed here end up at the top level of the quiz, also when they were inside a group. Items left out keep their position value.',
		options: [
			{
				name: 'items',
				displayName: 'Item',
				values: [
					{
						displayName: 'Item ID',
						name: 'id',
						type: 'string',
						required: true,
						default: '',
						description: 'The ID of the question or group',
					},
					{
						displayName: 'Item Type',
						name: 'type',
						type: 'options',
						options: [
							{ name: 'Group', value: 'group' },
							{ name: 'Question', value: 'question' },
						],
						default: 'question',
						description: 'Whether this is a question or a group',
					},
				],
			},
		],
	},

	// ----------------------------------
	//         quiz: validateAccessCode
	// ----------------------------------
	{
		displayName: 'Access Code',
		name: 'accessCode',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quiz'],
				operation: ['validateAccessCode'],
			},
		},
		description: 'The access code to validate',
	},
];
