import type { INodeProperties } from 'n8n-workflow';

export const gradingStandardOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['gradingStandard'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a grading standard',
				action: 'Create a grading standard',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a grading standard',
				action: 'Delete a grading standard',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single grading standard',
				action: 'Get a grading standard',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many grading standards',
				action: 'Get many grading standards',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a grading standard',
				action: 'Update a grading standard',
			},
		],
		default: 'getAll',
	},
];

export const gradingStandardFields: INodeProperties[] = [
	// ----------------------------------
	//         gradingStandard: context selection
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['gradingStandard'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
				description: 'Grading standard for an account',
			},
			{
				name: 'Course',
				value: 'course',
				description: 'Grading standard for a course',
			},
		],
		description: 'The context for the grading standard',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingStandard'],
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
				resource: ['gradingStandard'],
				context: ['course'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         gradingStandard: get, update, delete
	// ----------------------------------
	{
		displayName: 'Grading Standard ID',
		name: 'gradingStandardId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingStandard'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the grading standard',
	},

	// ----------------------------------
	//         gradingStandard: create
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingStandard'],
				operation: ['create'],
			},
		},
		description: 'The title of the grading standard',
	},
	{
		displayName: 'Grading Scheme',
		name: 'gradingScheme',
		type: 'fixedCollection',
		placeholder: 'Add Grade Entry',
		required: true,
		default: {},
		displayOptions: {
			show: {
				resource: ['gradingStandard'],
				operation: ['create'],
			},
		},
		typeOptions: {
			multipleValues: true,
		},
		options: [
			{
				displayName: 'Grade Entry',
				name: 'gradeEntry',
				values: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						required: true,
						default: '',
						description: 'The letter grade or classification (e.g., A, B+, Pass)',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'number',
						required: true,
						default: 0,
						description: 'The lower bound threshold value (as a decimal, e.g., 0.9 for 90%)',
					},
				],
			},
		],
		description: 'The grading scheme entries defining grade cutoffs',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['gradingStandard'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Points Based',
				name: 'points_based',
				type: 'boolean',
				default: false,
				description: 'Whether the grading standard is point-based instead of percentage-based',
			},
			{
				displayName: 'Scaling Factor',
				name: 'scaling_factor',
				type: 'number',
				default: 1,
				description: 'Maximum points for point-based schemes (defaults to 1)',
			},
		],
	},

	// ----------------------------------
	//         gradingStandard: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['gradingStandard'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the grading standard',
			},
		],
	},
];
