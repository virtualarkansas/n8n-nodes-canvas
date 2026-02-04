import type { INodeProperties } from 'n8n-workflow';

export const conferenceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['conference'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many conferences',
				action: 'Get many conferences',
			},
			{
				name: 'Get Many for User',
				value: 'getAllForUser',
				description: 'Get all conferences for the current user',
				action: 'Get all conferences for user',
			},
		],
		default: 'getAll',
	},
];

export const conferenceFields: INodeProperties[] = [
	// ----------------------------------
	//         conference: getAll
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['conference'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				name: 'Course',
				value: 'course',
			},
			{
				name: 'Group',
				value: 'group',
			},
		],
		description: 'The context to list conferences from',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conference'],
				operation: ['getAll'],
				context: ['course'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conference'],
				operation: ['getAll'],
				context: ['group'],
			},
		},
		description: 'The ID of the group',
	},

	// ----------------------------------
	//         conference: getAllForUser - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['conference'],
				operation: ['getAllForUser'],
			},
		},
		options: [
			{
				displayName: 'State',
				name: 'state',
				type: 'options',
				options: [
					{ name: 'All', value: '' },
					{ name: 'Live', value: 'live' },
				],
				default: '',
				description: 'Filter conferences by state (live returns only active conferences)',
			},
		],
	},
];
