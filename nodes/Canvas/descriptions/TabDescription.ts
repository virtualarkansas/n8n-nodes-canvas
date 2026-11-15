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
				description: 'Get the navigation tabs of a course, account, group or user',
				action: 'Get many tabs',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Hide, show or move a navigation tab of a course',
				action: 'Update a tab',
			},
		],
		default: 'getAll',
	},
];

export const tabFields: INodeProperties[] = [
	// ----------------------------------
	//         tab: getAll
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
				operation: ['getAll'],
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
				operation: ['getAll'],
			},
		},
		description: 'The ID of the context (account, course, group, or user)',
	},

	// ----------------------------------
	//         tab: update
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'contextId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['tab'],
				operation: ['update'],
			},
		},
		description: 'The ID of the course. Canvas only allows changing the navigation of courses.',
	},
	{
		displayName: 'Tab ID',
		name: 'tabId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'assignments',
		displayOptions: {
			show: {
				resource: ['tab'],
				operation: ['update'],
			},
		},
		description:
			'The ID of the tab as returned by "Get Many", e.g. "assignments" or "context_external_tool_4". The Home and Settings tabs cannot be changed.',
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
				default: 2,
				typeOptions: {
					minValue: 2,
				},
				description:
					'The new position of the tab (1-based). Position 1 belongs to Home, so the lowest valid position is 2 and the highest is the number of tabs (Settings always stays last).',
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
				options: [{ name: 'Course Subject Tabs', value: 'course_subject_tabs' }],
				default: [],
				description:
					'Additional information to include. "Course Subject Tabs" returns the home page tabs of a Canvas for Elementary subject course instead of the sidebar navigation.',
			},
		],
	},
];
