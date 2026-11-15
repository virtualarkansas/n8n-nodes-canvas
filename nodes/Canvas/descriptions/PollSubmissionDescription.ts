import type { INodeProperties } from 'n8n-workflow';

export const pollSubmissionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['pollSubmission'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Answer an open poll session as the current user',
				action: 'Create a poll submission',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single poll submission',
				action: 'Get a poll submission',
			},
		],
		default: 'get',
	},
];

export const pollSubmissionFields: INodeProperties[] = [
	{
		displayName: 'Poll ID',
		name: 'pollId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['pollSubmission'],
			},
		},
		description: 'The ID of the poll',
	},
	{
		displayName: 'Poll Session ID',
		name: 'pollSessionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['pollSubmission'],
			},
		},
		description: 'The ID of the poll session',
	},
	{
		displayName: 'Poll Submission ID',
		name: 'pollSubmissionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['pollSubmission'],
				operation: ['get'],
			},
		},
		description: 'The ID of the poll submission',
	},
	{
		displayName: 'Poll Choice ID',
		name: 'pollChoiceId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['pollSubmission'],
				operation: ['create'],
			},
		},
		description: 'The ID of the choice to answer with',
	},
];
