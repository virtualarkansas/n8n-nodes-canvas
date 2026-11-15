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
				description: 'The percentage of the total grade that assignments in this group contribute. Only used when the course weights final grades by assignment group.',
			},
			{
				displayName: 'Integration Data',
				name: 'integration_data',
				type: 'json',
				default: '{}',
				description: 'JSON object with data of an external integration (e.g. SIS). Keys are merged into the data already stored.',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 1,
				description: 'The position of this assignment group relative to others (1-based)',
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
				description: 'The percentage of the total grade that assignments in this group contribute. Only used when the course weights final grades by assignment group.',
			},
			{
				displayName: 'Integration Data',
				name: 'integration_data',
				type: 'json',
				default: '{}',
				description: 'JSON object with data of an external integration (e.g. SIS). Keys are merged into the data already stored.',
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
				default: 1,
				description: 'The position of this assignment group relative to others (1-based)',
			},
			{
				displayName: 'Rules',
				name: 'rules',
				type: 'json',
				default: '{"drop_lowest": 1}',
				description: 'JSON object with the grading rules of the group: drop_lowest (number of lowest scores to drop), drop_highest (number of highest scores to drop) and never_drop (array of assignment IDs that are never dropped). Canvas refuses rules that drop more scores than the group has assignments. Use {} to remove all rules.',
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
				description: 'The ID of an assignment group to move the assignments to before deletion. Without it the assignments of the group are deleted too.',
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
				description: 'Comma-separated list of assignment IDs: only these assignments are listed in the groups (requires Include: Assignments)',
			},
			{
				displayName: 'Exclude Assignment Submission Types',
				name: 'exclude_assignment_submission_types',
				type: 'multiOptions',
				options: [
					{ name: 'Discussion Topic', value: 'discussion_topic' },
					{ name: 'External Tool', value: 'external_tool' },
					{ name: 'Online Quiz', value: 'online_quiz' },
					{ name: 'Wiki Page', value: 'wiki_page' },
				],
				default: [],
				description: 'Leave assignments of these kinds out of the groups (requires Include: Assignments)',
			},
			{
				displayName: 'Grading Period ID',
				name: 'grading_period_id',
				type: 'string',
				default: '',
				description: 'Only list the assignments that fall into this grading period (requires Include: Assignments)',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'All Dates', value: 'all_dates' },
					{ name: 'Assignment Visibility', value: 'assignment_visibility' },
					{ name: 'Assignments', value: 'assignments' },
					{ name: 'Can Edit', value: 'can_edit' },
					{ name: 'Discussion Topic', value: 'discussion_topic' },
					{ name: 'Observed Users', value: 'observed_users' },
					{ name: 'Overrides', value: 'overrides' },
					{ name: 'Peer Review', value: 'peer_review' },
					{ name: 'Score Statistics', value: 'score_statistics' },
					{ name: 'Submission', value: 'submission' },
				],
				default: [],
				description: 'Additional information to include with each assignment group. Everything except Assignments adds detail to the assignments and has no effect without it.',
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
				description: 'Whether to list only the assignments the user of the credential can see as a student (only has an effect for student credentials, with Include: Assignments)',
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
				description: 'Only list the assignments that fall into this grading period (requires Include: Assignments)',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Assignment Visibility', value: 'assignment_visibility' },
					{ name: 'Assignments', value: 'assignments' },
					{ name: 'Discussion Topic', value: 'discussion_topic' },
					{ name: 'Score Statistics', value: 'score_statistics' },
					{ name: 'Submission', value: 'submission' },
				],
				default: [],
				description: 'Additional information to include with the assignment group. Everything except Assignments adds detail to the assignments and has no effect without it.',
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
