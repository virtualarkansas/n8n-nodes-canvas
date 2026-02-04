import type { INodeProperties } from 'n8n-workflow';

export const rubricOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['rubric'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new rubric',
				action: 'Create a rubric',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a rubric',
				action: 'Delete a rubric',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single rubric',
				action: 'Get a rubric',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many rubrics',
				action: 'Get many rubrics',
			},
			{
				name: 'Get Used Locations',
				value: 'getUsedLocations',
				description: 'Get locations where a rubric is used',
				action: 'Get rubric used locations',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a rubric',
				action: 'Update a rubric',
			},
		],
		default: 'getAll',
	},
];

export const rubricFields: INodeProperties[] = [
	// ----------------------------------
	//         rubric: context selection
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['rubric'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
				description: 'Rubric for an account',
			},
			{
				name: 'Course',
				value: 'course',
				description: 'Rubric for a course',
			},
		],
		description: 'The context for the rubric',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				context: ['account'],
			},
		},
		description: 'The ID of the account',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				context: ['course'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         rubric: get, update, delete, getUsedLocations
	// ----------------------------------
	{
		displayName: 'Rubric ID',
		name: 'rubricId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['get', 'update', 'delete', 'getUsedLocations'],
			},
		},
		description: 'The ID of the rubric',
	},

	// ----------------------------------
	//         rubric: create
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['create'],
			},
		},
		description: 'The title of the rubric',
	},
	{
		displayName: 'Criteria',
		name: 'criteria',
		type: 'fixedCollection',
		placeholder: 'Add Criterion',
		required: true,
		default: {},
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['create'],
			},
		},
		typeOptions: {
			multipleValues: true,
		},
		options: [
			{
				displayName: 'Criterion',
				name: 'criterion',
				values: [
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						required: true,
						default: '',
						description: 'The description of the criterion',
					},
					{
						displayName: 'Points',
						name: 'points',
						type: 'number',
						required: true,
						default: 0,
						description: 'The maximum points for this criterion',
					},
					{
						displayName: 'Long Description',
						name: 'long_description',
						type: 'string',
						default: '',
						description: 'A longer description of the criterion',
					},
				],
			},
		],
		description: 'The criteria for the rubric',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Association ID',
				name: 'rubric_association_association_id',
				type: 'string',
				default: '',
				description: 'The ID of the object to associate the rubric with',
			},
			{
				displayName: 'Association Type',
				name: 'rubric_association_association_type',
				type: 'options',
				options: [
					{ name: 'Account', value: 'Account' },
					{ name: 'Assignment', value: 'Assignment' },
					{ name: 'Course', value: 'Course' },
				],
				default: 'Assignment',
				description: 'The type of object to associate the rubric with',
			},
			{
				displayName: 'Free Form Criterion Comments',
				name: 'free_form_criterion_comments',
				type: 'boolean',
				default: false,
				description: 'Whether free-form comments are allowed on criteria',
			},
			{
				displayName: 'Hide Score Total',
				name: 'rubric_association_hide_score_total',
				type: 'boolean',
				default: false,
				description: 'Whether to hide the total score from students',
			},
			{
				displayName: 'Purpose',
				name: 'rubric_association_purpose',
				type: 'options',
				options: [
					{ name: 'Bookmark', value: 'bookmark' },
					{ name: 'Grading', value: 'grading' },
				],
				default: 'grading',
				description: 'The purpose of the rubric association',
			},
			{
				displayName: 'Use for Grading',
				name: 'rubric_association_use_for_grading',
				type: 'boolean',
				default: false,
				description: 'Whether the rubric is used for grading',
			},
		],
	},

	// ----------------------------------
	//         rubric: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Free Form Criterion Comments',
				name: 'free_form_criterion_comments',
				type: 'boolean',
				default: false,
				description: 'Whether free-form comments are allowed on criteria',
			},
			{
				displayName: 'Skip Updating Points Possible',
				name: 'skip_updating_points_possible',
				type: 'boolean',
				default: false,
				description: 'Whether to skip updating the points possible on associated assignments',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the rubric',
			},
		],
	},

	// ----------------------------------
	//         rubric: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Account Associations', value: 'account_associations' },
					{ name: 'Assessments', value: 'assessments' },
					{ name: 'Assignment Associations', value: 'assignment_associations' },
					{ name: 'Associations', value: 'associations' },
					{ name: 'Course Associations', value: 'course_associations' },
					{ name: 'Graded Assessments', value: 'graded_assessments' },
					{ name: 'Peer Assessments', value: 'peer_assessments' },
				],
				default: [],
				description: 'Additional information to include with the rubric',
			},
			{
				displayName: 'Style',
				name: 'style',
				type: 'options',
				options: [
					{ name: 'Comments Only', value: 'comments_only' },
					{ name: 'Full', value: 'full' },
				],
				default: 'full',
				description: 'The style of the returned assessments',
			},
		],
	},
];
