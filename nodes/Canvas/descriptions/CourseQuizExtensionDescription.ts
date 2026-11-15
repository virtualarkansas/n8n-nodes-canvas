import type { INodeProperties } from 'n8n-workflow';

export const courseQuizExtensionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['courseQuizExtension'],
			},
		},
		options: [
			{
				name: 'Set',
				value: 'set',
				description: 'Give students extra time or attempts on every quiz of a course',
				action: 'Set course quiz extensions',
			},
		],
		default: 'set',
	},
];

export const courseQuizExtensionFields: INodeProperties[] = [
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['courseQuizExtension'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Extensions',
		name: 'extensions',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Extension',
		default: {},
		displayOptions: {
			show: {
				resource: ['courseQuizExtension'],
				operation: ['set'],
			},
		},
		description: 'One entry per student. The extension applies to every quiz of the course.',
		options: [
			{
				displayName: 'Extension',
				name: 'extension',
				values: [
					{
						displayName: 'Extend From End At (Minutes)',
						name: 'extend_from_end_at',
						type: 'number',
						default: 0,
						description: 'Minutes to add after the current end of a quiz attempt in progress (at most 1440). Cannot be combined with Extend From Now.',
					},
					{
						displayName: 'Extend From Now (Minutes)',
						name: 'extend_from_now',
						type: 'number',
						default: 0,
						description: 'Minutes to give from now for a quiz attempt in progress (at most 1440). Cannot be combined with Extend From End At.',
					},
					{
						displayName: 'Extra Attempts',
						name: 'extra_attempts',
						type: 'number',
						default: 0,
						description: 'Number of additional attempts (at most 1000)',
					},
					{
						displayName: 'Extra Time (Minutes)',
						name: 'extra_time',
						type: 'number',
						default: 0,
						description: 'Extra minutes on every attempt (at most 10080)',
					},
					{
						displayName: 'Manually Unlocked',
						name: 'manually_unlocked',
						type: 'boolean',
						default: false,
						description: 'Whether the student may take quizzes that are locked for everyone else',
					},
					{
						displayName: 'User ID',
						name: 'user_id',
						type: 'string',
						default: '',
						description: 'The ID of the student',
					},
				],
			},
		],
	},
];
