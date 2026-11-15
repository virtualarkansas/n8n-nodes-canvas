import type { INodeProperties } from 'n8n-workflow';

export const pollOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['poll'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a poll',
				action: 'Create a poll',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a poll',
				action: 'Delete a poll',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a poll',
				action: 'Get a poll',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many polls',
				action: 'Get many polls',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a poll',
				action: 'Update a poll',
			},
		],
		default: 'getAll',
	},
];

export const pollFields: INodeProperties[] = [
	// ----------------------------------
	//         poll: get, update, delete
	// ----------------------------------
	{
		displayName: 'Poll ID',
		name: 'pollId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['poll'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description:
			'The ID of the poll. Polls belong to the teacher who created them; other users only see polls that have a session in one of their courses.',
	},

	// ----------------------------------
	//         poll: create
	// ----------------------------------
	{
		displayName: 'Question',
		name: 'question',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['poll'],
				operation: ['create'],
			},
		},
		description: 'The title or question of the poll (at most 255 characters)',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['poll'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'A brief description or instructions for the poll (at most 255 characters)',
			},
		],
	},

	// ----------------------------------
	//         poll: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['poll'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'A brief description or instructions for the poll (at most 255 characters)',
			},
			{
				displayName: 'Question',
				name: 'question',
				type: 'string',
				default: '',
				description: 'The title or question of the poll (at most 255 characters)',
			},
		],
	},
];
