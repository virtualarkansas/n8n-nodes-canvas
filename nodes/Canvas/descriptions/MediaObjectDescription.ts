import type { INodeProperties } from 'n8n-workflow';

export const mediaObjectOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['mediaObject'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many media objects',
				action: 'Get many media objects',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a media object',
				action: 'Update a media object',
			},
		],
		default: 'getAll',
	},
];

export const mediaObjectFields: INodeProperties[] = [
	// ----------------------------------
	//         mediaObject: getAll - context type
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'user',
		displayOptions: {
			show: {
				resource: ['mediaObject'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				name: 'Course',
				value: 'course',
				description: 'Media objects in a course',
			},
			{
				name: 'Group',
				value: 'group',
				description: 'Media objects in a group',
			},
			{
				name: 'User',
				value: 'user',
				description: 'Media objects for the current user',
			},
		],
		description: 'The context to list media objects from',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['mediaObject'],
				operation: ['getAll'],
				contextType: ['course'],
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
				resource: ['mediaObject'],
				operation: ['getAll'],
				contextType: ['group'],
			},
		},
		description: 'The ID of the group',
	},

	// ----------------------------------
	//         mediaObject: update
	// ----------------------------------
	{
		displayName: 'Media Object ID',
		name: 'mediaObjectId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['mediaObject'],
				operation: ['update'],
			},
		},
		description: 'The ID of the media object',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['mediaObject'],
				operation: ['update'],
			},
		},
		description: 'The new title for the media object',
	},

	// ----------------------------------
	//         mediaObject: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['mediaObject'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Exclude',
				name: 'exclude',
				type: 'multiOptions',
				options: [
					{ name: 'Sources', value: 'sources' },
					{ name: 'Tracks', value: 'tracks' },
				],
				default: [],
				description: 'Exclude certain data from the response to improve performance',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
				description: 'The sort order',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Created At', value: 'created_at' },
					{ name: 'Title', value: 'title' },
				],
				default: 'title',
				description: 'The field to sort media objects by',
			},
		],
	},
];
