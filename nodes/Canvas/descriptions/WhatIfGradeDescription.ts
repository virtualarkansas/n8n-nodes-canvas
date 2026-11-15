import type { INodeProperties } from 'n8n-workflow';

export const whatIfGradeOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['whatIfGrade'],
			},
		},
		options: [
			{
				name: 'Reset',
				value: 'reset',
				description: 'Remove every what-if score of the current user in a course and recalculate',
				action: 'Reset what if grades',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Set a what-if score on one of the current user\'s submissions and get the resulting grades',
				action: 'Update a what if grade',
			},
		],
		default: 'update',
	},
];

export const whatIfGradeFields: INodeProperties[] = [
	{
		displayName: 'What-if grades belong to the student whose token is used: a student can try out scores on their own submissions and see the effect on their course grade. They never change real grades.',
		name: 'whatIfNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['whatIfGrade'],
			},
		},
	},
	{
		displayName: 'Submission ID',
		name: 'submissionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['whatIfGrade'],
				operation: ['update'],
			},
		},
		description: 'The ID of the submission (not of the assignment)',
	},
	{
		displayName: 'Clear What-If Score',
		name: 'clearScore',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['whatIfGrade'],
				operation: ['update'],
			},
		},
		description: 'Whether to remove the what-if score from this submission instead of setting one',
	},
	{
		displayName: 'What-If Score',
		name: 'studentEnteredScore',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: {
			show: {
				resource: ['whatIfGrade'],
				operation: ['update'],
				clearScore: [false],
			},
		},
		description: 'The score to try out',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['whatIfGrade'],
				operation: ['reset'],
			},
		},
		description: 'The ID of the course whose what-if scores to reset',
	},
];
