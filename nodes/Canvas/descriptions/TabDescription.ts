import type { INodeProperties } from 'n8n-workflow';

export const tabOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['tab'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many tabs',
				action: 'Get many tabs',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a tab',
				action: 'Update a tab',
			},
		],
		default: 'getAll',
	},
];

export const tabFields: INodeProperties[] = [
	// ----------------------------------
	//         tab: shared
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		options: [
			{ name: 'Account', value: 'account' },
			{ name: 'Course', value: 'course' },
			{ name: 'Group', value: 'group' },
			{ name: 'User', value: 'user' },
		],
		displayOptions: {
			show: {
				resource: ['tab'],
			},
		},
		description: 'The type of context to get tabs for',
	},
	{
		displayName: 'Context ID',
		name: 'contextId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['tab'],
			},
		},
		description: 'The ID of the context (account, course, group, or user)',
	},

	// ----------------------------------
	//         tab: update
	// ----------------------------------
	{
		displayName: 'Tab ID',
		name: 'tabId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['tab'],
				operation: ['update'],
			},
		},
		description: 'The ID of the tab to update',
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['tab'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Hidden',
				name: 'hidden',
				type: 'boolean',
				default: false,
				description: 'Whether the tab is hidden from the navigation',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 1,
				description: 'The new position of the tab (1-based)',
			},
		],
	},

	// ----------------------------------
	//         tab: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['tab'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Course Subject Tabs', value: 'course_subject_tabs' },
				],
				default: [],
				description: 'Additional information to include. Use "Course Subject Tabs" for Canvas for Elementary subject course home pages.',
			},
		],
	},
];
