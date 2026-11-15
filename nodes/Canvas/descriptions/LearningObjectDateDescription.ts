import type { INodeProperties } from 'n8n-workflow';

export const learningObjectDateOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['learningObjectDate'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get the due date, availability dates and every override of an assignment, quiz, discussion, page or module',
				action: 'Get the dates of a learning object',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Change the due date, availability dates and overrides of an assignment, quiz, discussion or page',
				action: 'Update the dates of a learning object',
			},
		],
		default: 'get',
	},
];

export const learningObjectDateFields: INodeProperties[] = [
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['learningObjectDate'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Object Type',
		name: 'objectType',
		type: 'options',
		required: true,
		options: [
			{ name: 'Assignment', value: 'assignment' },
			{ name: 'Discussion Topic', value: 'discussionTopic' },
			{ name: 'Module', value: 'module' },
			{ name: 'Page', value: 'page' },
			{ name: 'Quiz', value: 'quiz' },
		],
		default: 'assignment',
		displayOptions: {
			show: {
				resource: ['learningObjectDate'],
				operation: ['get'],
			},
		},
		description: 'The kind of item whose dates to read',
	},
	{
		displayName: 'Object Type',
		name: 'objectType',
		type: 'options',
		required: true,
		options: [
			{ name: 'Assignment', value: 'assignment' },
			{ name: 'Discussion Topic', value: 'discussionTopic' },
			{ name: 'Page', value: 'page' },
			{ name: 'Quiz', value: 'quiz' },
		],
		default: 'assignment',
		displayOptions: {
			show: {
				resource: ['learningObjectDate'],
				operation: ['update'],
			},
		},
		description: 'The kind of item whose dates to change. Module overrides are managed through the module itself.',
	},
	{
		displayName: 'Object ID',
		name: 'objectId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['learningObjectDate'],
			},
		},
		description: 'The ID of the item. For a page, its ID or the last part of its URL.',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['learningObjectDate'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Exclude',
				name: 'exclude',
				type: 'multiOptions',
				options: [
					{ name: 'Checkpoint Due Dates on Each Override', value: 'child_override_due_dates' },
					{ name: 'Peer Review Overrides', value: 'peer_review_overrides' },
				],
				default: [],
				description: 'Information to leave out of the response',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Peer Review', value: 'peer_review' },
					{ name: 'Peer Review Dates on Each Override', value: 'child_peer_review_override_dates' },
				],
				default: [],
				description: 'Extra information to return',
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
				resource: ['learningObjectDate'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Assignment Overrides',
				name: 'assignment_overrides',
				type: 'json',
				default: '[]',
				description: 'The complete list of overrides as a JSON array. Existing overrides need their ID; overrides left out are deleted; an empty array removes all overrides. Keys: ID, title, due_at, unlock_at, lock_at, student_ids, course_section_ID, course_ID, noop_ID, unassign_item.',
			},
			{
				displayName: 'Clear Dates',
				name: 'clear',
				type: 'multiOptions',
				options: [
					{ name: 'Due At', value: 'due_at' },
					{ name: 'Lock At', value: 'lock_at' },
					{ name: 'Unlock At', value: 'unlock_at' },
				],
				default: [],
				description: 'Dates to remove from the item',
			},
			{
				displayName: 'Due At',
				name: 'due_at',
				type: 'dateTime',
				default: '',
				description: 'The due date. Not applicable to ungraded discussions, pages and modules.',
			},
			{
				displayName: 'Lock At',
				name: 'lock_at',
				type: 'dateTime',
				default: '',
				description: 'When the item stops being available',
			},
			{
				displayName: 'Only Visible to Overrides',
				name: 'only_visible_to_overrides',
				type: 'boolean',
				default: false,
				description: 'Whether the item is assigned only to the students, sections and groups named in its overrides',
			},
			{
				displayName: 'Unlock At',
				name: 'unlock_at',
				type: 'dateTime',
				default: '',
				description: 'When the item becomes available',
			},
		],
	},
];
