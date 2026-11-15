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
				description: 'Send one of your sent content shares to additional users',
				action: 'Add users to a content share',
			},
			{
				name: 'Create',
				value: 'create',
				description:
					'Share an assignment, discussion, page, quiz, module, module item or file directly with other users, who can then import it into their courses',
				action: 'Create a content share',
			},
			{
				name: 'Delete',
				value: 'delete',
				description:
					'Remove a content share from your own list (the copies of other users are not deleted)',
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
				description: 'Get the content shares a user has sent or received, newest first',
				action: 'Get many content shares',
			},
			{
				name: 'Get Unread Count',
				value: 'getUnreadCount',
				description: 'Get the number of received content shares a user has not read yet',
				action: 'Get unread content share count',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Mark one of your content shares as read or unread',
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
				operation: ['get', 'getAll', 'getUnreadCount'],
			},
		},
		description:
			'The ID of the user whose content shares to read, or "self" for the token\'s user. Only administrators and linked observers may read the shares of other users.',
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
		description:
			'The ID of the content share. Add Users, Update and Delete only work on the shares of the token\'s user.',
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
				name: 'File',
				value: 'attachment',
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
		description:
			'The numeric ID of the content to share (for a page its page ID, not its URL). The token\'s user must be allowed to export it from its course.',
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
		description: 'Comma-separated IDs of the users to share the content with',
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
		description:
			'Comma-separated IDs of the additional users to send the share to. Users who already have it are skipped.',
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
