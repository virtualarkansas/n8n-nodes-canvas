import type { INodeProperties } from 'n8n-workflow';

export const bookmarkOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['bookmark'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a bookmark',
				action: 'Create a bookmark',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a bookmark',
				action: 'Delete a bookmark',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a bookmark',
				action: 'Get a bookmark',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many bookmarks',
				action: 'Get many bookmarks',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a bookmark',
				action: 'Update a bookmark',
			},
		],
		default: 'getAll',
	},
];

export const bookmarkFields: INodeProperties[] = [
	// ----------------------------------
	//         bookmark: get, update, delete
	// ----------------------------------
	{
		displayName: 'Bookmark ID',
		name: 'bookmarkId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['bookmark'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the bookmark',
	},

	// ----------------------------------
	//         bookmark: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['bookmark'],
				operation: ['create'],
			},
		},
		description: 'The name of the bookmark',
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['bookmark'],
				operation: ['create'],
			},
		},
		description: 'The URL of the bookmark',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['bookmark'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Data',
				name: 'data',
				type: 'string',
				default: '',
				description: 'Additional data associated with the bookmark (JSON string)',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				description: 'The position of the bookmark. Defaults to the bottom.',
			},
		],
	},

	// ----------------------------------
	//         bookmark: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['bookmark'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Data',
				name: 'data',
				type: 'string',
				default: '',
				description: 'Additional data associated with the bookmark (JSON string)',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the bookmark',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				description: 'The position of the bookmark',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				description: 'The URL of the bookmark',
			},
		],
	},
];
