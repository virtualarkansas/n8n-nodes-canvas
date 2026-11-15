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
				name: 'Delete for All',
				value: 'deleteForAll',
				description: 'Permanently delete a conversation for all participants (Site Admin only)',
				action: 'Delete a conversation for all participants',
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
				name: 'Get Deleted Conversations',
				value: 'getDeleted',
				description: 'List the messages a user has deleted from their inbox (Site Admin only)',
				action: 'List deleted conversations',
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
				name: 'Restore',
				value: 'restore',
				description: 'Put a message a user deleted back into their inbox (Site Admin only)',
				action: 'Restore a deleted message',
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
				operation: [
					'get',
					'update',
					'delete',
					'deleteForAll',
					'addMessage',
					'addRecipients',
					'deleteMessages',
					'restore',
				],
			},
		},
		description: 'The ID of the conversation',
	},

	// ----------------------------------
	//         conversation: admin
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['getDeleted', 'restore'],
			},
		},
		description: 'The ID of the user whose deleted messages to inspect or restore',
	},
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conversation'],
				operation: ['restore'],
			},
		},
		description: 'The ID of the deleted message to restore',
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
				operation: ['getDeleted'],
			},
		},
		options: [
			{
				displayName: 'Conversation ID',
				name: 'conversation_id',
				type: 'string',
				default: '',
				description: 'Limit results to a single conversation',
			},
			{
				displayName: 'Deleted After',
				name: 'deleted_after',
				type: 'dateTime',
				default: '',
				description: 'Only return messages the user deleted after this time',
			},
			{
				displayName: 'Deleted Before',
				name: 'deleted_before',
				type: 'dateTime',
				default: '',
				description: 'Only return messages the user deleted before this time',
			},
		],
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
		description: 'Comma-separated list of recipients: user IDs (e.g. "123"), "course_123" or "group_456" for everyone in a course or group, or "course_123_students" / "course_123_teachers" for one role. Without "Group Conversation" each recipient gets a private conversation.',
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
				description: 'Comma-separated list of file IDs to attach. The files must be in the sender\'s "conversation attachments" folder.',
			},
			{
				displayName: 'Bulk Message',
				name: 'bulk_message',
				type: 'boolean',
				default: false,
				description: 'Whether to give every recipient their own new conversation although "Group Conversation" is on. Canvas requires both when a course or group with more than 100 members is addressed.',
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
				description: 'Whether to always start a new conversation. By default a message to a single person is added to the existing private conversation with them. With several recipients each one gets their own new conversation.',
			},
			{
				displayName: 'Group Conversation',
				name: 'group_conversation',
				type: 'boolean',
				default: false,
				description: 'Whether all recipients share one conversation and see each other\'s replies. When off, each recipient gets a private conversation with the sender.',
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
				description: 'Only used when several private conversations are created at once. With Async Canvas answers immediately and the node outputs no items; follow the progress with the Get Batches operation.',
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
				description: 'Whether reading an unread conversation marks it as read. Canvas does this unless it is turned off here.',
			},
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'string',
				default: '',
				description: 'Comma-separated list of prefixed IDs (e.g. "course_123, user_456"). Only used to compute the "visible" field of the result.',
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
				description: 'Only used to compute the "visible" field of the result: whether the conversation would be listed under this scope',
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
				description: 'Comma-separated list of prefixed IDs to filter by, e.g. "course_123", "group_456" or "user_789"',
			},
			{
				displayName: 'Filter Mode',
				name: 'filter_mode',
				type: 'options',
				options: [
					{ name: 'And', value: 'and' },
					{ name: 'Or', value: 'or' },
				],
				default: 'or',
				description: 'Whether a conversation must match all filters (And) or at least one (Or)',
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
				description: 'Whether to output a single item with "conversations" (the first page only) and "conversation_ids" (the IDs of every matching conversation) instead of one item per conversation',
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
				description: 'Which conversations to list. Without a scope Canvas returns the inbox (everything that is not archived).',
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
