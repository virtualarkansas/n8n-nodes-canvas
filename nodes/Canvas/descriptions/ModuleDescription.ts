import type { INodeProperties } from 'n8n-workflow';

export const moduleOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['module'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new module',
				action: 'Create a module',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a module',
				action: 'Delete a module',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single module',
				action: 'Get a module',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many modules',
				action: 'Get many modules',
			},
			{
				name: 'List Items',
				value: 'listItems',
				description: 'List items in a module',
				action: 'List items in a module',
			},
			{
				name: 'List Overrides',
				value: 'listOverrides',
				description: 'List the sections and students a module is assigned to (none means everyone)',
				action: 'List the overrides of a module',
			},
			{
				name: 'Relock',
				value: 'relock',
				description: 'Reset module progressions to their default locked state',
				action: 'Relock a module',
			},
			{
				name: 'Set Overrides',
				value: 'setOverrides',
				description: 'Assign a module to certain sections and/or students only, or to everyone again',
				action: 'Set the overrides of a module',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a module',
				action: 'Update a module',
			},
		],
		default: 'getAll',
	},
];

export const moduleFields: INodeProperties[] = [
	// ----------------------------------
	//         module: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['module'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         module: get, update, delete, relock, listItems
	// ----------------------------------
	{
		displayName: 'Module ID',
		name: 'moduleId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['module'],
				operation: ['get', 'update', 'delete', 'relock', 'listItems', 'listOverrides', 'setOverrides'],
			},
		},
		description: 'The ID of the module',
	},

	// ----------------------------------
	//         module: setOverrides
	// ----------------------------------
	{
		displayName: 'Overrides',
		name: 'overrides',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Override',
		default: {},
		displayOptions: {
			show: {
				resource: ['module'],
				operation: ['setOverrides'],
			},
		},
		description: 'The complete list of who the module is assigned to. Existing overrides that are not listed (by their override ID) are deleted; without any entry the module is assigned to everyone again.',
		options: [
			{
				name: 'overrideValues',
				displayName: 'Override',
				values: [
					{
						displayName: 'Override ID',
						name: 'id',
						type: 'string',
						default: '',
						description: 'ID of an existing override to keep or change. Leave empty to create a new override.',
					},
					{
						displayName: 'Section ID',
						name: 'course_section_id',
						type: 'string',
						default: '',
						description: 'Assign the module to this course section (not together with Student IDs)',
					},
					{
						displayName: 'Student IDs',
						name: 'student_ids',
						type: 'string',
						default: '',
						description: 'Comma-separated list of user IDs of the students the module is assigned to (not together with Section ID)',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'Title of an override for individual students. Section overrides are named after their section.',
					},
				],
			},
		],
	},

	// ----------------------------------
	//         module: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['module'],
				operation: ['create'],
			},
		},
		description: 'The name of the module',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['module'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 1,
				description: 'The position of the module in the course (1-based)',
			},
			{
				displayName: 'Prerequisite Module IDs',
				name: 'prerequisite_module_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of module IDs that must be completed before this module is unlocked. Prerequisites must come before this module in the course.',
			},
			{
				displayName: 'Publish Final Grade',
				name: 'publish_final_grade',
				type: 'boolean',
				default: false,
				description: 'Whether to publish the final grade when this module is completed',
			},
			{
				displayName: 'Require Sequential Progress',
				name: 'require_sequential_progress',
				type: 'boolean',
				default: false,
				description: 'Whether items in this module must be completed in order',
			},
			{
				displayName: 'Unlock At',
				name: 'unlock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the module becomes available',
			},
		],
	},

	// ----------------------------------
	//         module: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['module'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the module',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 1,
				description: 'The position of the module in the course (1-based)',
			},
			{
				displayName: 'Prerequisite Module IDs',
				name: 'prerequisite_module_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of module IDs that must be completed before this module is unlocked. Replaces the current list; leave empty to remove all prerequisites. Prerequisites must come before this module in the course.',
			},
			{
				displayName: 'Publish Final Grade',
				name: 'publish_final_grade',
				type: 'boolean',
				default: false,
				description: 'Whether to publish the final grade when this module is completed',
			},
			{
				displayName: 'Published',
				name: 'published',
				type: 'boolean',
				default: false,
				description: 'Whether the module is published and visible to students. Publishing or unpublishing a module also publishes or unpublishes its items.',
			},
			{
				displayName: 'Require Sequential Progress',
				name: 'require_sequential_progress',
				type: 'boolean',
				default: false,
				description: 'Whether items in this module must be completed in order',
			},
			{
				displayName: 'Unlock At',
				name: 'unlock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the module becomes available',
			},
		],
	},

	// ----------------------------------
	//         module: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['module'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Content Details', value: 'content_details' },
					{ name: 'Items', value: 'items' },
				],
				default: [],
				description: 'Additional information to include with each module',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Partial match for module name',
			},
			{
				displayName: 'Student ID',
				name: 'student_id',
				type: 'string',
				default: '',
				description: 'Returns module completion information (state, completed_at, item completion) for the specified student',
			},
		],
	},

	// ----------------------------------
	//         module: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['module'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Content Details', value: 'content_details' },
					{ name: 'Items', value: 'items' },
				],
				default: [],
				description: 'Additional information to include with the module',
			},
			{
				displayName: 'Student ID',
				name: 'student_id',
				type: 'string',
				default: '',
				description: 'Returns module completion information (state, completed_at, item completion) for the specified student',
			},
		],
	},

	// ----------------------------------
	//         module: listItems - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['module'],
				operation: ['listItems'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Content Details', value: 'content_details' },
				],
				default: [],
				description: 'Additional information to include with each item',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Partial match for item title',
			},
			{
				displayName: 'Student ID',
				name: 'student_id',
				type: 'string',
				default: '',
				description: 'Returns completion information for the specified student',
			},
		],
	},
];
