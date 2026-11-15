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
						description:
							'The lowest score that earns this grade: a percentage (90 for 90%), or points when the scheme is points based. The lowest grade must have the value 0 and no two grades may share a value.',
					},
				],
			},
		],
		description: 'The grades of the scheme with their lower bounds',
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
				description: 'Whether the grade values are points instead of percentages',
			},
			{
				displayName: 'Scaling Factor',
				name: 'scaling_factor',
				type: 'number',
				default: 1,
				description:
					'The points that correspond to 100% in a points based scheme (for example 4 for a 4-point scale). Canvas only accepts 1 when the scheme is not points based.',
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
				displayName: 'Points Based',
				name: 'points_based',
				type: 'boolean',
				default: false,
				description:
					'Whether the grade values are points instead of percentages. Canvas rebuilds the scheme when this changes: send the complete Grading Scheme as well.',
			},
			{
				displayName: 'Scaling Factor',
				name: 'scaling_factor',
				type: 'number',
				default: 1,
				description:
					'The points that correspond to 100% in a points based scheme. Canvas rebuilds the scheme when this changes: send the complete Grading Scheme as well.',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the grading standard',
			},
		],
	},
	{
		displayName: 'Grading Scheme',
		name: 'gradingScheme',
		type: 'fixedCollection',
		placeholder: 'Add Grade Entry',
		default: {},
		displayOptions: {
			show: {
				resource: ['gradingStandard'],
				operation: ['update'],
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
						description:
							'The lowest score that earns this grade: a percentage (90 for 90%), or points when the scheme is points based. The lowest grade must have the value 0 and no two grades may share a value.',
					},
				],
			},
		],
		description:
			'Replaces all grades of the scheme (leave empty to keep them). Canvas refuses to change the grades of a scheme that has been used for grading.',
	},
];
