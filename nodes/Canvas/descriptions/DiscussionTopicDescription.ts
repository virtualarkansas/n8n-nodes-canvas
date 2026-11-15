import type { INodeProperties } from 'n8n-workflow';

export const discussionTopicOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new discussion topic',
				action: 'Create a discussion topic',
			},
			{
				name: 'Create Entry',
				value: 'createEntry',
				description: 'Post a top-level entry in a discussion topic',
				action: 'Create a discussion entry',
			},
			{
				name: 'Create Reply',
				value: 'createReply',
				description: 'Reply to an entry of a discussion topic',
				action: 'Create a reply to a discussion entry',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a discussion topic',
				action: 'Delete a discussion topic',
			},
			{
				name: 'Delete Entry',
				value: 'deleteEntry',
				description: 'Delete an entry or reply of a discussion topic',
				action: 'Delete a discussion entry',
			},
			{
				name: 'Duplicate',
				value: 'duplicate',
				description: 'Duplicate a discussion topic',
				action: 'Duplicate a discussion topic',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single discussion topic',
				action: 'Get a discussion topic',
			},
			{
				name: 'Get Entries by ID',
				value: 'getEntriesById',
				description: 'Get specific entries or replies of a discussion topic by their IDs',
				action: 'Get discussion entries by ID',
			},
			{
				name: 'Get Full Topic',
				value: 'getFullTopic',
				description:
					'Get the whole discussion in one item: the threaded entries, the participants and which entries are unread',
				action: 'Get the full discussion topic',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many discussion topics',
				action: 'Get many discussion topics',
			},
			{
				name: 'Get Many Entries',
				value: 'getAllEntries',
				description: 'Get the top-level entries of a discussion topic, newest first',
				action: 'Get many discussion entries',
			},
			{
				name: 'Get Many Replies',
				value: 'getAllReplies',
				description: 'Get the replies to a top-level entry of a discussion topic, newest first',
				action: 'Get many replies to a discussion entry',
			},
			{
				name: 'Mark All Topics as Read',
				value: 'markAllTopicsRead',
				description: 'Mark every discussion topic (or every announcement) of the course or group as read',
				action: 'Mark all discussion topics as read',
			},
			{
				name: 'Mark as Read',
				value: 'markRead',
				description: 'Mark a topic, a topic with all its entries, or one entry as read',
				action: 'Mark a discussion topic or entry as read',
			},
			{
				name: 'Mark as Unread',
				value: 'markUnread',
				description: 'Mark a topic, a topic with all its entries, or one entry as unread',
				action: 'Mark a discussion topic or entry as unread',
			},
			{
				name: 'Rate Entry',
				value: 'rateEntry',
				description: 'Like an entry of a discussion topic, or take the like back',
				action: 'Rate a discussion entry',
			},
			{
				name: 'Reorder Pinned',
				value: 'reorderPinned',
				description: 'Reorder pinned discussion topics',
				action: 'Reorder pinned discussion topics',
			},
			{
				name: 'Subscribe',
				value: 'subscribe',
				description: 'Subscribe to a topic to be notified about new entries',
				action: 'Subscribe to a discussion topic',
			},
			{
				name: 'Unsubscribe',
				value: 'unsubscribe',
				description: 'Stop being notified about new entries of a topic',
				action: 'Unsubscribe from a discussion topic',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a discussion topic',
				action: 'Update a discussion topic',
			},
			{
				name: 'Update Entry',
				value: 'updateEntry',
				description: 'Change the text of an entry or reply of a discussion topic',
				action: 'Update a discussion entry',
			},
		],
		default: 'getAll',
	},
];

/** Operations that act on a course or group as a whole and take no topic ID. */
const WITHOUT_TOPIC = ['create', 'getAll', 'reorderPinned', 'markAllTopicsRead'];

const WITH_TOPIC = [
	'createEntry',
	'createReply',
	'delete',
	'deleteEntry',
	'duplicate',
	'get',
	'getEntriesById',
	'getFullTopic',
	'getAllEntries',
	'getAllReplies',
	'markRead',
	'markUnread',
	'rateEntry',
	'subscribe',
	'unsubscribe',
	'update',
	'updateEntry',
];

/** Settings accepted by both "Create" and "Update". */
const topicSettings: INodeProperties[] = [
	{
		displayName: 'Allow Rating',
		name: 'allow_rating',
		type: 'boolean',
		default: false,
		description: 'Whether users can rate (like) entries in this topic',
	},
	{
		displayName: 'Assignment',
		name: 'assignment',
		type: 'json',
		default: '{}',
		description:
			'Course topics only. JSON object with assignment settings that makes this a graded discussion, for example {"points_possible": 10, "due_at": "2030-01-31T23:59:00Z"}. Send {"set_assignment": false} to make a graded discussion ungraded again.',
	},
	{
		displayName: 'Delayed Post At',
		name: 'delayed_post_at',
		type: 'dateTime',
		default: '',
		description: 'Course topics only. The topic stays hidden from students until this time (ISO 8601 format).',
	},
	{
		displayName: 'Discussion Type',
		name: 'discussion_type',
		type: 'options',
		options: [
			{ name: 'Not Threaded', value: 'not_threaded' },
			{ name: 'Side Comment', value: 'side_comment' },
			{ name: 'Threaded', value: 'threaded' },
		],
		default: 'threaded',
		description:
			'"Threaded" allows replies to replies; "Side Comment" and "Not Threaded" allow one level of replies only',
	},
	{
		displayName: 'Expanded',
		name: 'expanded',
		type: 'boolean',
		default: false,
		description: 'Whether threads are shown expanded by default',
	},
	{
		displayName: 'Expanded Locked',
		name: 'expanded_locked',
		type: 'boolean',
		default: false,
		description: 'Whether users are prevented from changing the thread expansion setting',
	},
	{
		displayName: 'Group Category ID',
		name: 'group_category_id',
		type: 'string',
		default: '',
		description:
			'Course topics only. The ID of a group set: the topic becomes a group discussion with a separate copy for each group of the set. Leave empty to turn a group discussion back into a discussion of the whole course.',
	},
	{
		displayName: 'Is Announcement',
		name: 'is_announcement',
		type: 'boolean',
		default: false,
		description: 'Whether this topic is an announcement',
	},
	{
		displayName: 'Lock At',
		name: 'lock_at',
		type: 'dateTime',
		default: '',
		description:
			'Course topics only. The topic is closed for comments from this time on (ISO 8601 format); a time in the past closes it right away.',
	},
	{
		displayName: 'Lock Comment',
		name: 'lock_comment',
		type: 'boolean',
		default: false,
		description: 'Whether comments are disabled. Announcements only; use "Locked" for discussions.',
	},
	{
		displayName: 'Locked',
		name: 'locked',
		type: 'boolean',
		default: false,
		description:
			'Whether the topic is closed for comments. Canvas ignores this in a request that also changes "Lock At".',
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		default: '',
		description: 'The body content of the discussion topic (supports HTML)',
	},
	{
		displayName: 'Only Graders Can Rate',
		name: 'only_graders_can_rate',
		type: 'boolean',
		default: false,
		description: 'Whether only graders can rate entries',
	},
	{
		displayName: 'Pinned',
		name: 'pinned',
		type: 'boolean',
		default: false,
		description: 'Whether to pin this topic to the top',
	},
	{
		displayName: 'Podcast Enabled',
		name: 'podcast_enabled',
		type: 'boolean',
		default: false,
		description: 'Whether this topic has an associated podcast feed',
	},
	{
		displayName: 'Podcast Has Student Posts',
		name: 'podcast_has_student_posts',
		type: 'boolean',
		default: false,
		description: 'Whether the podcast feed includes student posts (implies Podcast Enabled). Course topics only.',
	},
	{
		displayName: 'Position After',
		name: 'position_after',
		type: 'string',
		default: '',
		description: 'The ID of another topic of the same course or group to place this one after',
	},
	{
		displayName: 'Published',
		name: 'published',
		type: 'boolean',
		default: true,
		description:
			'Whether the topic is published. When this is not set, Canvas creates topics of teachers as unpublished drafts and topics of students as published.',
	},
	{
		displayName: 'Require Initial Post',
		name: 'require_initial_post',
		type: 'boolean',
		default: false,
		description: 'Whether users must post before seeing other replies. Course topics only.',
	},
	{
		displayName: 'Sort By Rating',
		name: 'sort_by_rating',
		type: 'boolean',
		default: false,
		description: 'Whether to sort entries by rating (deprecated by Canvas)',
	},
	{
		displayName: 'Sort Order',
		name: 'sort_order',
		type: 'options',
		options: [
			{ name: 'Ascending (Oldest First)', value: 'asc' },
			{ name: 'Descending (Newest First)', value: 'desc' },
		],
		default: 'desc',
		description: 'Default sort order of the entries',
	},
	{
		displayName: 'Sort Order Locked',
		name: 'sort_order_locked',
		type: 'boolean',
		default: false,
		description: 'Whether users are prevented from choosing their own sort order',
	},
	{
		displayName: 'Specific Sections',
		name: 'specific_sections',
		type: 'string',
		default: '',
		description:
			'Course topics only. Comma-separated list of section IDs to limit this topic to, or "all" to make it available to every section again.',
	},
	{
		displayName: 'To-Do Date',
		name: 'todo_date',
		type: 'dateTime',
		default: '',
		description: 'Show the topic on the students\' to-do list for this date. Not possible for graded discussions.',
	},
];

const sortedByDisplayName = (fields: INodeProperties[]): INodeProperties[] =>
	[...fields].sort((a, b) => a.displayName.localeCompare(b.displayName));

const includeOptions = [
	{ name: 'All Dates', value: 'all_dates' },
	{ name: 'Overrides', value: 'overrides' },
	{ name: 'Sections', value: 'sections' },
	{ name: 'Sections User Count', value: 'sections_user_count' },
];

export const discussionTopicFields: INodeProperties[] = [
	// ----------------------------------
	//         discussionTopic: shared
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		options: [
			{ name: 'Course', value: 'course' },
			{ name: 'Group', value: 'group' },
		],
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: [...WITHOUT_TOPIC, ...WITH_TOPIC],
			},
		},
		description: 'Whether this is a course or group discussion topic',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: [...WITHOUT_TOPIC, ...WITH_TOPIC],
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
				resource: ['discussionTopic'],
				operation: [...WITHOUT_TOPIC, ...WITH_TOPIC],
				contextType: ['group'],
			},
		},
		description: 'The ID of the group',
	},
	{
		displayName: 'Topic ID',
		name: 'topicId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: WITH_TOPIC,
			},
		},
		description: 'The ID of the discussion topic (announcements are discussion topics too)',
	},

	// ----------------------------------
	//         discussionTopic: create
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['create'],
			},
		},
		description: 'The title of the discussion topic',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['create'],
			},
		},
		options: topicSettings,
	},

	// ----------------------------------
	//         discussionTopic: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['update'],
			},
		},
		// Canvas decides whether a topic is an announcement when it is created; on an update the
		// flag only makes it look the topic up among the announcements (a discussion is then not found).
		options: sortedByDisplayName([
			...topicSettings.filter((field) => field.name !== 'is_announcement'),
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the discussion topic',
			},
		]),
	},

	// ----------------------------------
	//         discussionTopic: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: includeOptions,
				default: [],
				description: 'Additional information to include in the response',
			},
		],
	},

	// ----------------------------------
	//         discussionTopic: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Exclude Context Module Locked Topics',
				name: 'exclude_context_module_locked_topics',
				type: 'boolean',
				default: false,
				description:
					'Whether to exclude topics that are locked for the user by a module (only applies to students)',
			},
			{
				displayName: 'Filter By',
				name: 'filter_by',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Unread', value: 'unread' },
				],
				default: 'all',
				description: 'Return all topics, or only those with unread content for the user of the credential',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: includeOptions,
				default: [],
				description: 'Additional information to include in the response',
			},
			{
				displayName: 'Only Announcements',
				name: 'only_announcements',
				type: 'boolean',
				default: false,
				description: 'Whether to return announcements instead of discussion topics',
			},
			{
				displayName: 'Order By',
				name: 'order_by',
				type: 'options',
				options: [
					{ name: 'Position', value: 'position' },
					{ name: 'Recent Activity', value: 'recent_activity' },
					{ name: 'Title', value: 'title' },
				],
				default: 'position',
				description: 'The order of the topics',
			},
			{
				displayName: 'Scope',
				name: 'scope',
				type: 'multiOptions',
				options: [
					{ name: 'Locked', value: 'locked' },
					{ name: 'Pinned', value: 'pinned' },
					{ name: 'Unlocked', value: 'unlocked' },
					{ name: 'Unpinned', value: 'unpinned' },
				],
				default: [],
				description:
					'Only return topics in all of the chosen states. Canvas filters after paging, so pages can hold fewer topics than requested.',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Partial title of the topics to match and return',
			},
		],
	},

	// ----------------------------------
	//         discussionTopic: reorderPinned
	// ----------------------------------
	{
		displayName: 'Order',
		name: 'order',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['reorderPinned'],
			},
		},
		description:
			'Comma-separated IDs of the pinned topics in the desired order (first ID gets position 1). Every ID must be a pinned topic of this course or group.',
	},

	// ----------------------------------
	//         discussionTopic: getFullTopic - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['getFullTopic'],
			},
		},
		options: [
			{
				displayName: 'Include New Entries',
				name: 'include_new_entries',
				type: 'boolean',
				default: true,
				description:
					'Whether to fill the "new_entries" list with the entries that are not part of the cached view yet (Canvas builds the view in the background)',
			},
		],
	},

	// ----------------------------------
	//         discussionTopic: markAllTopicsRead - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['markAllTopicsRead'],
			},
		},
		options: [
			{
				displayName: 'Only Announcements',
				name: 'only_announcements',
				type: 'boolean',
				default: false,
				description: 'Whether to mark the announcements as read instead of the discussion topics',
			},
		],
	},

	// ----------------------------------
	//         discussionTopic: markRead, markUnread
	// ----------------------------------
	{
		displayName: 'Target',
		name: 'target',
		type: 'options',
		options: [
			{
				name: 'Single Entry',
				value: 'entry',
				description: 'One entry or reply of the topic',
			},
			{
				name: 'Topic',
				value: 'topic',
				description: 'The initial text of the topic',
			},
			{
				name: 'Topic and All Entries',
				value: 'topicAndEntries',
				description: 'The topic and every entry in it',
			},
		],
		default: 'topic',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['markRead', 'markUnread'],
			},
		},
		description: 'What to change the read state of, for the user of the credential',
	},
	{
		displayName: 'Options',
		name: 'readOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['markRead', 'markUnread'],
				target: ['entry', 'topicAndEntries'],
			},
		},
		options: [
			{
				displayName: 'Forced Read State',
				name: 'forced_read_state',
				type: 'boolean',
				default: true,
				description:
					'Whether the read state counts as set by hand, so Canvas does not mark the entry as read automatically when it is displayed',
			},
		],
	},

	// ----------------------------------
	//         discussionTopic: entries
	// ----------------------------------
	{
		displayName: 'Entry ID',
		name: 'entryId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['createReply', 'deleteEntry', 'getAllReplies', 'rateEntry', 'updateEntry'],
			},
		},
		description: 'The ID of the entry',
	},
	{
		displayName: 'Entry ID',
		name: 'entryId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['markRead', 'markUnread'],
				target: ['entry'],
			},
		},
		description: 'The ID of the entry',
	},
	{
		displayName: 'Entry IDs',
		name: 'entryIds',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['getEntriesById'],
			},
		},
		description: 'Comma-separated IDs of the entries or replies to return',
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['createEntry', 'createReply', 'updateEntry'],
			},
		},
		description: 'The text of the entry (supports HTML)',
	},
	{
		displayName: 'Rating',
		name: 'rating',
		type: 'options',
		options: [
			{ name: 'Like', value: 1 },
			{ name: 'Remove Like', value: 0 },
		],
		default: 1,
		displayOptions: {
			show: {
				resource: ['discussionTopic'],
				operation: ['rateEntry'],
			},
		},
		description: 'The rating of the user of the credential for this entry. The topic must allow rating.',
	},
];
