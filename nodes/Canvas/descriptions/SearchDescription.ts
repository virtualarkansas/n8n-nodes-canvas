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
				description: 'Find valid message recipients (users, courses, groups)',
				action: 'Find recipients',
			},
			{
				name: 'List All Courses',
				value: 'listAllCourses',
				description: 'Get a paginated list of all courses visible in the public index',
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
					'Limit the search to a specific course or group (e.g., "course_3" or "group_5")',
			},
			{
				displayName: 'Exclude',
				name: 'exclude',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of identifiers to exclude from results (e.g., "user_1,course_2")',
			},
			{
				displayName: 'From Conversation ID',
				name: 'from_conversation_id',
				type: 'string',
				default: '',
				description: 'Reference an existing conversation for shared context lookup',
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
				description: 'Check context permissions',
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
				description: 'Filter results to only users or only contexts',
			},
			{
				displayName: 'User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description: 'Search for a specific user ID (returns at most one result)',
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
				description: 'Whether to return only courses with self-enrollment enabled',
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
