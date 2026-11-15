import type { INodeProperties } from 'n8n-workflow';

export const searchOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['search'],
			},
		},
		options: [
			{
				name: 'Find Recipients',
				value: 'findRecipients',
				description:
					'Find the users, courses, sections and groups the token\'s user can send messages to. Returns nothing unless a Search term, a Context or a User ID is given.',
				action: 'Find recipients',
			},
			{
				name: 'List All Courses',
				value: 'listAllCourses',
				description:
					'Get the published courses listed in the public course index. Answers 403 unless the course catalog is turned on in the root account settings. Each item holds the course under the key "course".',
				action: 'List all courses',
			},
		],
		default: 'findRecipients',
	},
];

export const searchFields: INodeProperties[] = [
	// ----------------------------------
	//         search: findRecipients
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['search'],
				operation: ['findRecipients'],
			},
		},
		options: [
			{
				displayName: 'Context',
				name: 'context',
				type: 'string',
				default: '',
				description:
					'Limit the search to a course, section or group, e.g. "course_3", "section_7" or "group_5". A suffix narrows it to one role: "course_3_teachers", "course_3_students", "course_3_tas", "course_3_observers".',
			},
			{
				displayName: 'Exclude',
				name: 'exclude',
				type: 'string',
				default: '',
				description:
					'Comma-separated IDs to leave out of the results: user IDs as plain numbers, courses and groups with their prefix, e.g. "12,34,course_2,group_5"',
			},
			{
				displayName: 'From Conversation ID',
				name: 'from_conversation_id',
				type: 'string',
				default: '',
				description:
					'With User ID: also find the user if both of you take part in this conversation, even without a shared course or group',
			},
			{
				displayName: 'Permissions',
				name: 'permissions',
				type: 'multiOptions',
				default: [],
				options: [
					{
						name: 'Send Messages',
						value: 'send_messages',
					},
					{
						name: 'Send Messages All',
						value: 'send_messages_all',
					},
				],
				description:
					'Permissions to report for each course, section or group found (in its "permissions" field). Does not filter the results.',
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description:
					'Search term to match against users/courses/groups (whitespace-separated terms)',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				default: '',
				options: [
					{
						name: 'All',
						value: '',
					},
					{
						name: 'Context',
						value: 'context',
					},
					{
						name: 'User',
						value: 'user',
					},
				],
				description: 'Return only users or only contexts (courses, sections and groups)',
			},
			{
				displayName: 'User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description:
					'Look up one user by ID. Every other option except From Conversation ID is ignored, and nothing is returned if you cannot message that user.',
			},
		],
	},

	// ----------------------------------
	//         search: listAllCourses
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['search'],
				operation: ['listAllCourses'],
			},
		},
		options: [
			{
				displayName: 'Open Enrollment Only',
				name: 'open_enrollment_only',
				type: 'boolean',
				default: false,
				description: 'Whether to return only courses that allow self enrollment',
			},
			{
				displayName: 'Public Only',
				name: 'public_only',
				type: 'boolean',
				default: false,
				description: 'Whether to return only courses with public content',
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Search term to match against courses (whitespace-separated terms)',
			},
		],
	},
];
