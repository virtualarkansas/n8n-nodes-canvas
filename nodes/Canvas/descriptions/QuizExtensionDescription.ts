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
				name: 'Set Extensions',
				value: 'setExtensions',
				description: 'Set extensions for student quiz submissions',
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
				operation: ['setExtensions'],
			},
		},
		description: 'The extensions to set for students',
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
						description: 'Minutes to extend beyond quiz end time (max 1440). Mutually exclusive with Extend From Now.',
					},
					{
						displayName: 'Extend From Now',
						name: 'extend_from_now',
						type: 'number',
						default: 0,
						description: 'Minutes to extend from the current time (max 1440). Mutually exclusive with Extend From End At.',
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
