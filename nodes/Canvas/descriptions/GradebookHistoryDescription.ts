import type { INodeProperties } from 'n8n-workflow';

export const gradebookHistoryOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['gradebookHistory'],
			},
		},
		options: [
			{
				name: 'Get Day Details',
				value: 'getDayDetails',
				description: 'List the graders who worked on a given day, with the assignments they graded',
				action: 'Get gradebook history for a day',
			},
			{
				name: 'Get Days',
				value: 'getDays',
				description: 'List the days on which grading happened in a course',
				action: 'Get days in gradebook history',
			},
			{
				name: 'Get Feed',
				value: 'getFeed',
				description: 'List every submission version of a course, newest first',
				action: 'Get gradebook history feed',
			},
			{
				name: 'Get Submissions',
				value: 'getSubmissions',
				description: 'List the submissions one grader graded for one assignment on a given day',
				action: 'Get graded submissions for a day',
			},
		],
		default: 'getFeed',
	},
];

export const gradebookHistoryFields: INodeProperties[] = [
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradebookHistory'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Date',
		name: 'date',
		type: 'string',
		required: true,
		default: '',
		placeholder: '2026-03-31',
		displayOptions: {
			show: {
				resource: ['gradebookHistory'],
				operation: ['getDayDetails', 'getSubmissions'],
			},
		},
		description: 'The day to look at, as YYYY-MM-DD (a full date-time is accepted too)',
	},
	{
		displayName: 'Grader ID',
		name: 'graderId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradebookHistory'],
				operation: ['getSubmissions'],
			},
		},
		description: 'The ID of the user who graded',
	},
	{
		displayName: 'Assignment ID',
		name: 'assignmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradebookHistory'],
				operation: ['getSubmissions'],
			},
		},
		description: 'The ID of the assignment',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['gradebookHistory'],
				operation: ['getFeed'],
			},
		},
		options: [
			{
				displayName: 'Ascending',
				name: 'ascending',
				type: 'boolean',
				default: false,
				description: 'Whether to return the oldest versions first instead of the newest',
			},
			{
				displayName: 'Assignment ID',
				name: 'assignment_id',
				type: 'string',
				default: '',
				description: 'Only return versions of submissions to this assignment',
			},
			{
				displayName: 'User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description: 'Only return versions of submissions by this student',
			},
		],
	},
];
