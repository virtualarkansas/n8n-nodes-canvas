import type { INodeProperties } from 'n8n-workflow';

export const assignmentGroupOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['assignmentGroup'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new assignment group',
				action: 'Create an assignment group',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an assignment group',
				action: 'Delete an assignment group',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single assignment group',
				action: 'Get an assignment group',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many assignment groups',
				action: 'Get many assignment groups',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an assignment group',
				action: 'Update an assignment group',
			},
		],
		default: 'getAll',
	},
];

export const assignmentGroupFields: INodeProperties[] = [
	// ----------------------------------
	//         assignmentGroup: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignmentGroup'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         assignmentGroup: get, update, delete
	// ----------------------------------
	{
		displayName: 'Assignment Group ID',
		name: 'assignmentGroupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignmentGroup'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the assignment group',
	},

	// ----------------------------------
	//         assignmentGroup: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignmentGroup'],
				operation: ['create'],
			},
		},
		description: 'The name of the assignment group',
	},

	// ----------------------------------
	//         assignmentGroup: create - additional fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignmentGroup'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Group Weight',
				name: 'group_weight',
				type: 'number',
				default: 0,
				description: 'The percentage of the total grade that assignments in this group contribute',
			},
			{
				displayName: 'Integration Data',
				name: 'integration_data',
				type: 'json',
				default: '{}',
				description: 'JSON object containing integration-specific metadata',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				description: 'The position of this assignment group relative to others',
			},
			{
				displayName: 'SIS Source ID',
				name: 'sis_source_id',
				type: 'string',
				default: '',
				description: 'The SIS identifier for this assignment group',
			},
		],
	},

	// ----------------------------------
	//         assignmentGroup: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignmentGroup'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Group Weight',
				name: 'group_weight',
				type: 'number',
				default: 0,
				description: 'The percentage of the total grade that assignments in this group contribute',
			},
			{
				displayName: 'Integration Data',
				name: 'integration_data',
				type: 'json',
				default: '{}',
				description: 'JSON object containing integration-specific metadata',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the assignment group',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				description: 'The position of this assignment group relative to others',
			},
			{
				displayName: 'Rules',
				name: 'rules',
				type: 'json',
				default: '{}',
				description: 'JSON object containing grading rules configuration (e.g., drop lowest scores)',
			},
			{
				displayName: 'SIS Source ID',
				name: 'sis_source_id',
				type: 'string',
				default: '',
				description: 'The SIS identifier for this assignment group',
			},
		],
	},

	// ----------------------------------
	//         assignmentGroup: delete - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignmentGroup'],
				operation: ['delete'],
			},
		},
		options: [
			{
				displayName: 'Move Assignments To',
				name: 'move_assignments_to',
				type: 'string',
				default: '',
				description: 'The ID of an assignment group to move assignments to before deletion',
			},
		],
	},

	// ----------------------------------
	//         assignmentGroup: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignmentGroup'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Assignment IDs',
				name: 'assignment_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of assignment IDs to filter by',
			},
			{
				displayName: 'Exclude Assignment Submission Types',
				name: 'exclude_assignment_submission_types',
				type: 'multiOptions',
				options: [
					{ name: 'Discussion Topic', value: 'discussion_topic' },
					{ name: 'External Tool', value: 'external_tool' },
					{ name: 'On Paper', value: 'on_paper' },
					{ name: 'Online Quiz', value: 'online_quiz' },
					{ name: 'Online Text Entry', value: 'online_text_entry' },
					{ name: 'Online Upload', value: 'online_upload' },
					{ name: 'Online URL', value: 'online_url' },
				],
				default: [],
				description: 'Exclude assignments with the specified submission types',
			},
			{
				displayName: 'Grading Period ID',
				name: 'grading_period_id',
				type: 'string',
				default: '',
				description: 'Scope assignments to a specific grading period',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Assignments', value: 'assignments' },
					{ name: 'Discussion Topic', value: 'discussion_topic' },
					{ name: 'Score Statistics', value: 'score_statistics' },
					{ name: 'Submission', value: 'submission' },
				],
				default: [],
				description: 'Additional information to include with each assignment group',
			},
			{
				displayName: 'Override Assignment Dates',
				name: 'override_assignment_dates',
				type: 'boolean',
				default: true,
				description: 'Whether to apply assignment overrides to dates',
			},
			{
				displayName: 'Scope Assignments to Student',
				name: 'scope_assignments_to_student',
				type: 'boolean',
				default: false,
				description: 'Whether to limit assignments to those visible to the current student',
			},
		],
	},

	// ----------------------------------
	//         assignmentGroup: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignmentGroup'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Grading Period ID',
				name: 'grading_period_id',
				type: 'string',
				default: '',
				description: 'Scope assignments to a specific grading period',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Assignments', value: 'assignments' },
					{ name: 'Discussion Topic', value: 'discussion_topic' },
					{ name: 'Score Statistics', value: 'score_statistics' },
					{ name: 'Submission', value: 'submission' },
				],
				default: [],
				description: 'Additional information to include with the assignment group',
			},
			{
				displayName: 'Override Assignment Dates',
				name: 'override_assignment_dates',
				type: 'boolean',
				default: true,
				description: 'Whether to apply assignment overrides to dates',
			},
		],
	},
];
