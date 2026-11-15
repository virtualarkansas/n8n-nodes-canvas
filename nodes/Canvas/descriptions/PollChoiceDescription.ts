import type { INodeProperties } from 'n8n-workflow';

export const pollChoiceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['pollChoice'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Add a choice to a poll',
				action: 'Create a poll choice',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a poll choice',
				action: 'Delete a poll choice',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single poll choice',
				action: 'Get a poll choice',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the choices of a poll',
				action: 'Get many poll choices',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a poll choice',
				action: 'Update a poll choice',
			},
		],
		default: 'getAll',
	},
];

export const pollChoiceFields: INodeProperties[] = [
	{
		displayName: 'Poll ID',
		name: 'pollId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['pollChoice'],
			},
		},
		description: 'The ID of the poll',
	},
	{
		displayName: 'Poll Choice ID',
		name: 'pollChoiceId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['pollChoice'],
				operation: ['delete', 'get', 'update'],
			},
		},
		description: 'The ID of the poll choice',
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['pollChoice'],
				operation: ['create'],
			},
		},
		description: 'The text shown for this choice',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['pollChoice'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Is Correct',
				name: 'is_correct',
				type: 'boolean',
				default: false,
				description: 'Whether this choice is the correct answer',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 1,
				description: 'The position of this choice in the list (1 is first)',
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
				resource: ['pollChoice'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Is Correct',
				name: 'is_correct',
				type: 'boolean',
				default: false,
				description: 'Whether this choice is the correct answer',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 1,
				description: 'The position of this choice in the list (1 is first)',
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				default: '',
				description: 'The text shown for this choice',
			},
		],
	},
];
