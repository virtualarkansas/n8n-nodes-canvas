import type { INodeProperties } from 'n8n-workflow';

export const contentShareOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['contentShare'],
			},
		},
		options: [
			{
				name: 'Add Users',
				value: 'addUsers',
				description: 'Add users to an existing content share',
				action: 'Add users to a content share',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a content share',
				action: 'Create a content share',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a content share',
				action: 'Delete a content share',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a content share',
				action: 'Get a content share',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many content shares',
				action: 'Get many content shares',
			},
			{
				name: 'Get Unread Count',
				value: 'getUnreadCount',
				description: 'Get unread content share count',
				action: 'Get unread content share count',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a content share',
				action: 'Update a content share',
			},
		],
		default: 'getAll',
	},
];

export const contentShareFields: INodeProperties[] = [
	// ----------------------------------
	//         contentShare: shared
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: 'self',
		displayOptions: {
			show: {
				resource: ['contentShare'],
				operation: ['addUsers', 'create', 'delete', 'get', 'getAll', 'getUnreadCount', 'update'],
			},
		},
		description: 'The ID of the user (use "self" for the current user)',
	},

	// ----------------------------------
	//         contentShare: get, delete, update, addUsers
	// ----------------------------------
	{
		displayName: 'Content Share ID',
		name: 'contentShareId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentShare'],
				operation: ['addUsers', 'delete', 'get', 'update'],
			},
		},
		description: 'The ID of the content share',
	},

	// ----------------------------------
	//         contentShare: getAll
	// ----------------------------------
	{
		displayName: 'Share Type',
		name: 'shareType',
		type: 'options',
		required: true,
		default: 'received',
		displayOptions: {
			show: {
				resource: ['contentShare'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				name: 'Received',
				value: 'received',
			},
			{
				name: 'Sent',
				value: 'sent',
			},
		],
		description: 'Whether to list sent or received content shares',
	},

	// ----------------------------------
	//         contentShare: create
	// ----------------------------------
	{
		displayName: 'Content Type',
		name: 'contentType',
		type: 'options',
		required: true,
		default: 'assignment',
		displayOptions: {
			show: {
				resource: ['contentShare'],
				operation: ['create'],
			},
		},
		options: [
			{
				name: 'Assignment',
				value: 'assignment',
			},
			{
				name: 'Discussion Topic',
				value: 'discussion_topic',
			},
			{
				name: 'Module',
				value: 'module',
			},
			{
				name: 'Module Item',
				value: 'module_item',
			},
			{
				name: 'Page',
				value: 'page',
			},
			{
				name: 'Quiz',
				value: 'quiz',
			},
		],
		description: 'The type of content to share',
	},
	{
		displayName: 'Content ID',
		name: 'contentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentShare'],
				operation: ['create'],
			},
		},
		description: 'The ID of the content to share',
	},
	{
		displayName: 'Receiver IDs',
		name: 'receiverIds',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentShare'],
				operation: ['create'],
			},
		},
		description: 'Comma-separated list of user IDs to share with',
	},

	// ----------------------------------
	//         contentShare: addUsers
	// ----------------------------------
	{
		displayName: 'Receiver IDs',
		name: 'receiverIds',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['contentShare'],
				operation: ['addUsers'],
			},
		},
		description: 'Comma-separated list of user IDs to add to the share',
	},

	// ----------------------------------
	//         contentShare: update
	// ----------------------------------
	{
		displayName: 'Read State',
		name: 'readState',
		type: 'options',
		required: true,
		default: 'read',
		displayOptions: {
			show: {
				resource: ['contentShare'],
				operation: ['update'],
			},
		},
		options: [
			{
				name: 'Read',
				value: 'read',
			},
			{
				name: 'Unread',
				value: 'unread',
			},
		],
		description: 'The read state to set for the content share',
	},
];
