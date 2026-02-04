import type { INodeProperties } from 'n8n-workflow';

export const sisIntegrationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['sisIntegration'],
			},
		},
		options: [
			{
				name: 'Disable Post to SIS',
				value: 'disablePostToSis',
				description: 'Disable all assignments flagged as post_to_sis in a course',
				action: 'Disable post to SIS for a course',
			},
			{
				name: 'Get Assignments',
				value: 'getAssignments',
				description: 'Get assignments enabled for grade export to SIS',
				action: 'Get assignments for SIS grade export',
			},
		],
		default: 'getAssignments',
	},
];

export const sisIntegrationFields: INodeProperties[] = [
	// ----------------------------------
	//         sisIntegration: getAssignments - context selection
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'account',
		displayOptions: {
			show: {
				resource: ['sisIntegration'],
				operation: ['getAssignments'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
				description: 'Get assignments for an account',
			},
			{
				name: 'Course',
				value: 'course',
				description: 'Get assignments for a course',
			},
		],
		description: 'The context for retrieving assignments',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['sisIntegration'],
				operation: ['getAssignments'],
				context: ['account'],
			},
		},
		description: 'The ID of the account',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['sisIntegration'],
				operation: ['getAssignments', 'disablePostToSis'],
			},
			hide: {
				context: ['account'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         sisIntegration: getAssignments - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['sisIntegration'],
				operation: ['getAssignments'],
			},
		},
		options: [
			{
				displayName: 'Ends After',
				name: 'ends_after',
				type: 'dateTime',
				default: '',
				description: 'Restrict to courses ending after this date (ISO 8601 format)',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Student Overrides', value: 'student_overrides' },
				],
				default: [],
				description: 'Additional information to include with each assignment',
			},
			{
				displayName: 'Starts Before',
				name: 'starts_before',
				type: 'dateTime',
				default: '',
				description: 'Restrict to courses starting before this date (ISO 8601 format)',
			},
		],
	},

	// ----------------------------------
	//         sisIntegration: disablePostToSis - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['sisIntegration'],
				operation: ['disablePostToSis'],
			},
		},
		options: [
			{
				displayName: 'Grading Period ID',
				name: 'grading_period_id',
				type: 'string',
				default: '',
				description: 'Limit to assignments in a specific grading period',
			},
		],
	},
];
