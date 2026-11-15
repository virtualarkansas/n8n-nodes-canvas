import type { INodeProperties } from 'n8n-workflow';

export const pollSessionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['pollSession'],
			},
		},
		options: [
			{
				name: 'Close',
				value: 'close',
				description: 'Close an open poll session so no more answers are accepted',
				action: 'Close a poll session',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a session in which a course (or one section) can answer a poll',
				action: 'Create a poll session',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a poll session',
				action: 'Delete a poll session',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a poll session, including its results',
				action: 'Get a poll session',
			},
			{
				name: 'Get Closed',
				value: 'getClosed',
				description: 'List the closed poll sessions visible to the current user',
				action: 'Get closed poll sessions',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the sessions of a poll',
				action: 'Get many poll sessions',
			},
			{
				name: 'Get Opened',
				value: 'getOpened',
				description: 'List the open poll sessions visible to the current user',
				action: 'Get opened poll sessions',
			},
			{
				name: 'Open',
				value: 'open',
				description: 'Open a poll session so students can answer',
				action: 'Open a poll session',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a poll session',
				action: 'Update a poll session',
			},
		],
		default: 'getAll',
	},
];

export const pollSessionFields: INodeProperties[] = [
	{
		displayName: 'Poll ID',
		name: 'pollId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['pollSession'],
				operation: ['close', 'create', 'delete', 'get', 'getAll', 'open', 'update'],
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
				resource: ['pollSession'],
				operation: ['close', 'delete', 'get', 'open', 'update'],
			},
		},
		description: 'The ID of the poll session',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['pollSession'],
				operation: ['create'],
			},
		},
		description: 'The ID of the course the session is held in',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['pollSession'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Course Section ID',
				name: 'course_section_id',
				type: 'string',
				default: '',
				description: 'Hold the session for this section only',
			},
			{
				displayName: 'Has Public Results',
				name: 'has_public_results',
				type: 'boolean',
				default: false,
				description: 'Whether students can see the results while the session is open',
			},
		],
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['pollSession'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Course ID',
				name: 'course_id',
				type: 'string',
				default: '',
				description: 'The ID of the course the session is held in',
			},
			{
				displayName: 'Course Section ID',
				name: 'course_section_id',
				type: 'string',
				default: '',
				description: 'Hold the session for this section only',
			},
			{
				displayName: 'Has Public Results',
				name: 'has_public_results',
				type: 'boolean',
				default: false,
				description: 'Whether students can see the results while the session is open',
			},
		],
	},
];
