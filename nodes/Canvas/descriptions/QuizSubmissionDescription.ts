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
				description:
					'Get the quiz submissions of a quiz: every student for graders, only their own for students',
				action: 'Get many quiz submissions',
			},
			{
				name: 'Get Many Outstanding',
				value: 'getAllOutstanding',
				description: 'Get the quiz submissions that were started, never turned in and are now overdue',
				action: 'Get many outstanding quiz submissions',
			},
			{
				name: 'Get Own',
				value: 'getOwn',
				description: 'Get the quiz submission of the user the credential belongs to',
				action: 'Get own quiz submission',
			},
			{
				name: 'Get Time',
				value: 'getTime',
				description: 'Get the end time and the seconds left of a running quiz attempt',
				action: 'Get the time left of a quiz submission',
			},
			{
				name: 'Grade Outstanding',
				value: 'gradeOutstanding',
				description: 'Turn in and grade overdue quiz submissions that students never submitted',
				action: 'Grade outstanding quiz submissions',
			},
			{
				name: 'Start',
				value: 'start',
				description: 'Start taking a quiz as the user the credential belongs to',
				action: 'Start a quiz submission',
			},
			{
				name: 'Update Score',
				value: 'updateScore',
				description: 'Update scores or comments for a quiz submission',
				action: 'Update quiz submission score',
			},
			{
				name: 'Upload File',
				value: 'uploadFile',
				description: 'Upload a file for the running quiz attempt of the user the credential belongs to (handles all upload steps). The ID of the uploaded file is the answer to a file upload question.',
				action: 'Upload a file for a quiz submission',
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
	//         quizSubmission: get, getTime, complete, updateScore
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
				operation: ['get', 'getTime', 'complete', 'updateScore'],
			},
		},
		description:
			'The ID of the quiz submission. This is not the ID of the gradebook submission the quiz submission also refers to.',
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
				description:
					'Whether this is a preview submission that does not count towards the course record (teachers only)',
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
		description: 'The attempt number being completed. Must be the latest attempt.',
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
		description: 'The attempt number to update. The attempt must already be completed.',
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
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
				displayName: 'Attempt',
				name: 'attempt',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'Return the submission as it was at this attempt instead of the latest one',
			},
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
				description:
					'Associated records to return. When set, the output item is Canvas\' compound document: "quiz_submissions" (a list holding the quiz submission) next to "quizzes", "submissions" and "users".',
			},
		],
	},

	// ----------------------------------
	//         quizSubmission: gradeOutstanding
	// ----------------------------------
	{
		displayName: 'Quiz Submission IDs',
		name: 'quizSubmissionIds',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['gradeOutstanding'],
			},
		},
		description:
			'Comma-separated IDs of the quiz submissions to grade, as returned by "Get Many Outstanding". Submissions that are not outstanding are left untouched.',
	},

	// ----------------------------------
	//         quizSubmission: uploadFile
	// ----------------------------------
	{
		displayName: 'Upload Source',
		name: 'uploadSource',
		type: 'options',
		required: true,
		default: 'binaryData',
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['uploadFile'],
			},
		},
		options: [
			{
				name: 'Binary Data',
				value: 'binaryData',
				description: 'Upload from binary data in the workflow',
			},
			{
				name: 'URL',
				value: 'url',
				description: 'Provide a public URL for Canvas to fetch',
			},
		],
		description: 'Where the file data comes from',
	},
	{
		displayName: 'Input Data Field Name',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['uploadFile'],
				uploadSource: ['binaryData'],
			},
		},
		description: 'The name of the incoming field containing the binary file data to upload',
	},
	{
		displayName: 'File URL',
		name: 'fileUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/file.pdf',
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['uploadFile'],
				uploadSource: ['url'],
			},
		},
		description: 'A publicly accessible HTTP or HTTPS URL for Canvas to fetch the file from',
	},
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: {
				resource: ['quizSubmission'],
				operation: ['uploadFile'],
				uploadSource: ['url'],
			},
		},
		description: 'Whether to poll until Canvas finishes fetching the URL. If false, returns the progress object immediately.',
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
				operation: ['uploadFile'],
			},
		},
		options: [
			{
				displayName: 'Content Type',
				name: 'content_type',
				type: 'string',
				default: '',
				description: 'The content type of the file. Without it the type of the binary data is used, or Canvas goes by the file name.',
			},
			{
				displayName: 'File Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the file in Canvas. Without it the file name of the binary data, or the last part of the URL, is used.',
			},
		],
	},
];
