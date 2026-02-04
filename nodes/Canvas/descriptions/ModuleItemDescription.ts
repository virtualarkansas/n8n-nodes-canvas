import type { INodeProperties } from 'n8n-workflow';

export const moduleItemOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['moduleItem'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new module item',
				action: 'Create a module item',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a module item',
				action: 'Delete a module item',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single module item',
				action: 'Get a module item',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many module items',
				action: 'Get many module items',
			},
			{
				name: 'Mark Done',
				value: 'markDone',
				description: 'Mark a module item as done',
				action: 'Mark a module item as done',
			},
			{
				name: 'Mark Not Done',
				value: 'markNotDone',
				description: 'Mark a module item as not done',
				action: 'Mark a module item as not done',
			},
			{
				name: 'Select Mastery Path',
				value: 'selectMasteryPath',
				description: 'Select a mastery path for a module item',
				action: 'Select mastery path for a module item',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a module item',
				action: 'Update a module item',
			},
		],
		default: 'getAll',
	},
];

export const moduleItemFields: INodeProperties[] = [
	// ----------------------------------
	//         moduleItem: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moduleItem'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Module ID',
		name: 'moduleId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moduleItem'],
			},
		},
		description: 'The ID of the module',
	},

	// ----------------------------------
	//         moduleItem: get, update, delete, markDone, markNotDone, selectMasteryPath
	// ----------------------------------
	{
		displayName: 'Item ID',
		name: 'itemId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moduleItem'],
				operation: ['get', 'update', 'delete', 'markDone', 'markNotDone', 'selectMasteryPath'],
			},
		},
		description: 'The ID of the module item',
	},

	// ----------------------------------
	//         moduleItem: create
	// ----------------------------------
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		required: true,
		default: 'Page',
		displayOptions: {
			show: {
				resource: ['moduleItem'],
				operation: ['create'],
			},
		},
		options: [
			{
				name: 'Assignment',
				value: 'Assignment',
				description: 'Link to an assignment',
			},
			{
				name: 'Discussion',
				value: 'Discussion',
				description: 'Link to a discussion topic',
			},
			{
				name: 'External Tool',
				value: 'ExternalTool',
				description: 'Link to an external tool (LTI)',
			},
			{
				name: 'External URL',
				value: 'ExternalUrl',
				description: 'Link to an external URL',
			},
			{
				name: 'File',
				value: 'File',
				description: 'Link to a file',
			},
			{
				name: 'Page',
				value: 'Page',
				description: 'Link to a wiki page',
			},
			{
				name: 'Quiz',
				value: 'Quiz',
				description: 'Link to a quiz',
			},
			{
				name: 'Sub Header',
				value: 'SubHeader',
				description: 'A text header for organizing items',
			},
		],
		description: 'The type of module item',
	},
	{
		displayName: 'Content ID',
		name: 'contentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moduleItem'],
				operation: ['create'],
				type: ['File', 'Discussion', 'Assignment', 'Quiz'],
			},
		},
		description: 'The ID of the content item (file, discussion, assignment, or quiz)',
	},
	{
		displayName: 'Page URL',
		name: 'pageUrl',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moduleItem'],
				operation: ['create'],
				type: ['Page'],
			},
		},
		description: 'The URL slug of the page (e.g., "my-page-title")',
	},
	{
		displayName: 'External URL',
		name: 'externalUrl',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moduleItem'],
				operation: ['create'],
				type: ['ExternalUrl', 'ExternalTool'],
			},
		},
		description: 'The external URL for the item',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moduleItem'],
				operation: ['create'],
				type: ['SubHeader', 'ExternalUrl', 'ExternalTool'],
			},
		},
		description: 'The title of the module item',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['moduleItem'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Completion Requirement Min Score',
				name: 'completion_requirement_min_score',
				type: 'number',
				default: 0,
				description: 'Minimum score required for completion (when type is min_score)',
			},
			{
				displayName: 'Completion Requirement Type',
				name: 'completion_requirement_type',
				type: 'options',
				options: [
					{ name: 'Min Score', value: 'min_score' },
					{ name: 'Must Contribute', value: 'must_contribute' },
					{ name: 'Must Mark Done', value: 'must_mark_done' },
					{ name: 'Must Submit', value: 'must_submit' },
					{ name: 'Must View', value: 'must_view' },
				],
				default: 'must_view',
				description: 'The type of completion requirement for this item',
			},
			{
				displayName: 'Indent',
				name: 'indent',
				type: 'number',
				default: 0,
				description: 'The indentation level of the item (0-based)',
			},
			{
				displayName: 'New Tab',
				name: 'new_tab',
				type: 'boolean',
				default: false,
				description: 'Whether to open external tools in a new tab',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 1,
				description: 'The position of the item in the module (1-based)',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the module item (optional for content types)',
			},
		],
	},

	// ----------------------------------
	//         moduleItem: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['moduleItem'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Completion Requirement Min Score',
				name: 'completion_requirement_min_score',
				type: 'number',
				default: 0,
				description: 'Minimum score required for completion (when type is min_score)',
			},
			{
				displayName: 'Completion Requirement Type',
				name: 'completion_requirement_type',
				type: 'options',
				options: [
					{ name: 'Min Score', value: 'min_score' },
					{ name: 'Must Contribute', value: 'must_contribute' },
					{ name: 'Must Mark Done', value: 'must_mark_done' },
					{ name: 'Must Submit', value: 'must_submit' },
					{ name: 'Must View', value: 'must_view' },
				],
				default: 'must_view',
				description: 'The type of completion requirement for this item',
			},
			{
				displayName: 'External URL',
				name: 'external_url',
				type: 'string',
				default: '',
				description: 'The external URL (for ExternalUrl and ExternalTool items)',
			},
			{
				displayName: 'Indent',
				name: 'indent',
				type: 'number',
				default: 0,
				description: 'The indentation level of the item (0-based)',
			},
			{
				displayName: 'Move to Module ID',
				name: 'module_id',
				type: 'string',
				default: '',
				description: 'Move this item to a different module by specifying the target module ID',
			},
			{
				displayName: 'New Tab',
				name: 'new_tab',
				type: 'boolean',
				default: false,
				description: 'Whether to open external tools in a new tab',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 1,
				description: 'The position of the item in the module (1-based)',
			},
			{
				displayName: 'Published',
				name: 'published',
				type: 'boolean',
				default: false,
				description: 'Whether the item is published and visible to students',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the module item',
			},
		],
	},

	// ----------------------------------
	//         moduleItem: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['moduleItem'],
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

	// ----------------------------------
	//         moduleItem: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['moduleItem'],
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
				],
				default: [],
				description: 'Additional information to include with the item',
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

	// ----------------------------------
	//         moduleItem: selectMasteryPath
	// ----------------------------------
	{
		displayName: 'Assignment Set ID',
		name: 'assignmentSetId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moduleItem'],
				operation: ['selectMasteryPath'],
			},
		},
		description: 'The ID of the assignment set to select from the mastery paths data',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['moduleItem'],
				operation: ['selectMasteryPath'],
			},
		},
		options: [
			{
				displayName: 'Student ID',
				name: 'student_id',
				type: 'string',
				default: '',
				description: 'The student ID to select the path for (defaults to current user)',
			},
		],
	},
];
