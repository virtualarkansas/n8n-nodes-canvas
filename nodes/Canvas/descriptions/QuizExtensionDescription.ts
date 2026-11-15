import type { INodeProperties } from 'n8n-workflow';

export const quizExtensionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['quizExtension'],
			},
		},
		options: [
			{
				name: 'Set Course Extensions',
				value: 'setCourseExtensions',
				description: 'Set extensions for students on every quiz of a course',
				action: 'Set extensions for students on every quiz of a course',
			},
			{
				name: 'Set Extensions',
				value: 'setExtensions',
				description: 'Set extensions for students on one quiz',
				action: 'Set extensions for student quiz submissions',
			},
		],
		default: 'setExtensions',
	},
];

export const quizExtensionFields: INodeProperties[] = [
	// ----------------------------------
	//         quizExtension: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizExtension'],
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
				resource: ['quizExtension'],
				operation: ['setExtensions'],
			},
		},
		description: 'The ID of the quiz',
	},

	// ----------------------------------
	//         quizExtension: setExtensions
	// ----------------------------------
	{
		displayName: 'Extensions',
		name: 'extensions',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Extension',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizExtension'],
				operation: ['setExtensions', 'setCourseExtensions'],
			},
		},
		description:
			'One entry per student. Extra Attempts, Extra Time and Manually Unlocked are stored exactly as entered, replacing what the student had before.',
		options: [
			{
				name: 'extensionValues',
				displayName: 'Extension',
				values: [
					{
						displayName: 'Extend From End At',
						name: 'extend_from_end_at',
						type: 'number',
						default: 0,
						description:
							'Minutes to add to the end time of an attempt the student has in progress (max 1440). Leave at 0 to not extend. Ignored when Extend From Now is set, and when the student has no attempt in progress.',
					},
					{
						displayName: 'Extend From Now',
						name: 'extend_from_now',
						type: 'number',
						default: 0,
						description:
							'Minutes from now until the attempt the student has in progress ends (max 1440). Leave at 0 to not extend. Ignored when the student has no attempt in progress.',
					},
					{
						displayName: 'Extra Attempts',
						name: 'extra_attempts',
						type: 'number',
						default: 0,
						description: 'Number of additional attempts allowed (max 1000)',
					},
					{
						displayName: 'Extra Time',
						name: 'extra_time',
						type: 'number',
						default: 0,
						description: 'Extra minutes to allow for all attempts (max 10080)',
					},
					{
						displayName: 'Manually Unlocked',
						name: 'manually_unlocked',
						type: 'boolean',
						default: false,
						description: 'Whether to allow access to a locked quiz',
					},
					{
						displayName: 'User ID',
						name: 'user_id',
						type: 'string',
						required: true,
						default: '',
						description: 'The ID of the student receiving the extension',
					},
				],
			},
		],
	},
];
