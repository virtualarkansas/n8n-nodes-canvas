import type { INodeProperties } from 'n8n-workflow';

export const conversationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['conversation'],
			},
		},
		options: [
			{
				name: 'Add Message',
				value: 'addMessage',
				description: 'Add a message to an existing conversation',
				action: 'Add a message to a conversation',
			},
			{
				name: 'Add Recipients',
				value: 'addRecipients',
				description: 'Add recipients to an existing conversation',
				action: 'Add recipients to a conversation',
			},
			{
				name: 'Batch Update',
				value: 'batchUpdate',
				description: 'Perform bulk operations on multiple conversations',
				action: 'Batch update conversations',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new conversation',
				action: 'Create a conversation',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a conversation',
				action: 'Delete a conversation',
			},
			{
				name: 'Delete Messages',
				value: 'deleteMessages',
				description: 'Delete specific messages from a conversation',
				action: 'Delete messages from a conversation',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single conversation',
				action: 'Get a conversation',
			},
			{
				name: 'Get Batches',
				value: 'getBatches',
				description: 'Get currently running conversation batches',
				action: 'Get conversation batches',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many conversations',
				action: 'Get many conversations',
			},
			{
				name: 'Get Unread Count',
				value: 'getUnreadCount',
				description: 'Get the number of unread conversations',
				action: 'Get unread conversation count',
			},
			{
				name: 'Mark All as Read',
				value: 'markAllAsRead',
				description: 'Mark all conversations as read',
				action: 'Mark all conversations as read',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a conversation',
				action: 'Update a conversation',
			},
		],
		default: 'getAll',
	},
];

export const conversationFields: INodeProperties[] = [
	// ----------------------------------
	//         conversation: shared
	// ----------------------------------
	{
		displayName: 'Conversation ID',
		name: 'conversationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['get', 'update', 'delete', 'addMessage', 'addRecipients', 'deleteMessages'],
			},
		},
		description: 'The ID of the conversation',
	},

	// ----------------------------------
	//         conversation: create
	// ----------------------------------
	{
		displayName: 'Recipients',
		name: 'recipients',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['create'],
			},
		},
		description: 'Comma-separated list of user IDs, course IDs (prefixed with "course_"), or group IDs (prefixed with "group_")',
	},
	{
		displayName: 'Body',
		name: 'body',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['create'],
			},
		},
		description: 'The message content',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Attachment IDs',
				name: 'attachment_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of previously uploaded file IDs to attach',
			},
			{
				displayName: 'Context Code',
				name: 'context_code',
				type: 'string',
				default: '',
				description: 'The course or group context code (e.g., "course_123" or "group_456")',
			},
			{
				displayName: 'Force New',
				name: 'force_new',
				type: 'boolean',
				default: false,
				description: 'Whether to create a new conversation even if one already exists with these recipients',
			},
			{
				displayName: 'Group Conversation',
				name: 'group_conversation',
				type: 'boolean',
				default: false,
				description: 'Whether to create a single group conversation (true) or individual conversations with each recipient (false)',
			},
			{
				displayName: 'Media Comment ID',
				name: 'media_comment_id',
				type: 'string',
				default: '',
				description: 'The ID of an audio or video file to attach',
			},
			{
				displayName: 'Media Comment Type',
				name: 'media_comment_type',
				type: 'options',
				options: [
					{ name: 'Audio', value: 'audio' },
					{ name: 'Video', value: 'video' },
				],
				default: 'audio',
				description: 'The type of media comment',
			},
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				options: [
					{ name: 'Async', value: 'async' },
					{ name: 'Sync', value: 'sync' },
				],
				default: 'sync',
				description: 'Whether to create the message synchronously or asynchronously',
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
				description: 'The subject of the conversation (max 255 characters)',
			},
		],
	},

	// ----------------------------------
	//         conversation: get
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Auto Mark as Read',
				name: 'auto_mark_as_read',
				type: 'boolean',
				default: true,
				description: 'Whether to automatically mark the conversation as read',
			},
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'string',
				default: '',
				description: 'Comma-separated list of course or group IDs to filter by',
			},
			{
				displayName: 'Scope',
				name: 'scope',
				type: 'options',
				options: [
					{ name: 'Archived', value: 'archived' },
					{ name: 'Sent', value: 'sent' },
					{ name: 'Starred', value: 'starred' },
					{ name: 'Unread', value: 'unread' },
				],
				default: 'unread',
				description: 'Filter by conversation type',
			},
		],
	},

	// ----------------------------------
	//         conversation: getAll
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['getAll'],
			},
		},
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		default: 50,
		description: 'Max number of results to return',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'string',
				default: '',
				description: 'Comma-separated list of course IDs, group IDs, or user IDs to filter by',
			},
			{
				displayName: 'Filter Mode',
				name: 'filter_mode',
				type: 'options',
				options: [
					{ name: 'And', value: 'and' },
					{ name: 'Default Or', value: 'default or' },
					{ name: 'Or', value: 'or' },
				],
				default: 'or',
				description: 'How to combine multiple filters',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Participant Avatars', value: 'participant_avatars' },
					{ name: 'UUID', value: 'uuid' },
				],
				default: [],
				description: 'Additional information to include',
			},
			{
				displayName: 'Include All Conversation IDs',
				name: 'include_all_conversation_ids',
				type: 'boolean',
				default: false,
				description: 'Whether to include all conversation IDs in the response',
			},
			{
				displayName: 'Scope',
				name: 'scope',
				type: 'options',
				options: [
					{ name: 'Archived', value: 'archived' },
					{ name: 'Sent', value: 'sent' },
					{ name: 'Starred', value: 'starred' },
					{ name: 'Unread', value: 'unread' },
				],
				default: 'unread',
				description: 'Filter by conversation type',
			},
		],
	},

	// ----------------------------------
	//         conversation: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Starred',
				name: 'starred',
				type: 'boolean',
				default: false,
				description: 'Whether the conversation is starred',
			},
			{
				displayName: 'Subscribed',
				name: 'subscribed',
				type: 'boolean',
				default: true,
				description: 'Whether to receive notifications for this conversation',
			},
			{
				displayName: 'Workflow State',
				name: 'workflow_state',
				type: 'options',
				options: [
					{ name: 'Archived', value: 'archived' },
					{ name: 'Read', value: 'read' },
					{ name: 'Unread', value: 'unread' },
				],
				default: 'read',
				description: 'The state of the conversation',
			},
		],
	},

	// ----------------------------------
	//         conversation: addMessage
	// ----------------------------------
	{
		displayName: 'Message Body',
		name: 'messageBody',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['addMessage'],
			},
		},
		description: 'The message content to add',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['addMessage'],
			},
		},
		options: [
			{
				displayName: 'Attachment IDs',
				name: 'attachment_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of previously uploaded file IDs to attach',
			},
			{
				displayName: 'Included Messages',
				name: 'included_messages',
				type: 'string',
				default: '',
				description: 'Comma-separated list of message IDs to forward',
			},
			{
				displayName: 'Media Comment ID',
				name: 'media_comment_id',
				type: 'string',
				default: '',
				description: 'The ID of an audio or video file to attach',
			},
			{
				displayName: 'Media Comment Type',
				name: 'media_comment_type',
				type: 'options',
				options: [
					{ name: 'Audio', value: 'audio' },
					{ name: 'Video', value: 'video' },
				],
				default: 'audio',
				description: 'The type of media comment',
			},
			{
				displayName: 'Recipients',
				name: 'recipients',
				type: 'string',
				default: '',
				description: 'Comma-separated list of recipient IDs to limit message delivery to',
			},
		],
	},

	// ----------------------------------
	//         conversation: addRecipients
	// ----------------------------------
	{
		displayName: 'Recipients',
		name: 'recipients',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['addRecipients'],
			},
		},
		description: 'Comma-separated list of user IDs, course IDs (prefixed with "course_"), or group IDs (prefixed with "group_") to add',
	},

	// ----------------------------------
	//         conversation: deleteMessages
	// ----------------------------------
	{
		displayName: 'Message IDs',
		name: 'messageIds',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['deleteMessages'],
			},
		},
		description: 'Comma-separated list of message IDs to delete',
	},

	// ----------------------------------
	//         conversation: batchUpdate
	// ----------------------------------
	{
		displayName: 'Conversation IDs',
		name: 'conversationIds',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['batchUpdate'],
			},
		},
		description: 'Comma-separated list of conversation IDs (up to 500)',
	},
	{
		displayName: 'Event',
		name: 'event',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['batchUpdate'],
			},
		},
		options: [
			{ name: 'Archive', value: 'archive' },
			{ name: 'Destroy', value: 'destroy' },
			{ name: 'Mark as Read', value: 'mark_as_read' },
			{ name: 'Mark as Unread', value: 'mark_as_unread' },
			{ name: 'Star', value: 'star' },
			{ name: 'Unstar', value: 'unstar' },
		],
		default: 'mark_as_read',
		description: 'Archive marks conversations for later reference, Destroy permanently removes them, Star/Unstar toggles favorites',
	},
];
