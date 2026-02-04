import type { INodeProperties } from 'n8n-workflow';

export const outcomeOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['outcome'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single outcome',
				action: 'Get an outcome',
			},
			{
				name: 'Get Aligned Assignments',
				value: 'getAlignedAssignments',
				description: 'Get assignments aligned to outcomes in a course',
				action: 'Get aligned assignments',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an outcome',
				action: 'Update an outcome',
			},
		],
		default: 'get',
	},
];

export const outcomeFields: INodeProperties[] = [
	// ----------------------------------
	//         outcome: get, update
	// ----------------------------------
	{
		displayName: 'Outcome ID',
		name: 'outcomeId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: ['get', 'update'],
			},
		},
		description: 'The ID of the outcome',
	},

	// ----------------------------------
	//         outcome: getAlignedAssignments
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: ['getAlignedAssignments'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         outcome: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Add Defaults',
				name: 'add_defaults',
				type: 'boolean',
				default: false,
				description: 'Whether to add color and mastery level defaults to outcome ratings',
			},
		],
	},

	// ----------------------------------
	//         outcome: getAlignedAssignments - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: ['getAlignedAssignments'],
			},
		},
		options: [
			{
				displayName: 'Assignment ID',
				name: 'assignment_id',
				type: 'string',
				default: '',
				description: 'Filter alignments to a specific assignment',
			},
			{
				displayName: 'Student ID',
				name: 'student_id',
				type: 'string',
				default: '',
				description: 'Filter alignments by student submissions',
			},
		],
	},

	// ----------------------------------
	//         outcome: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Add Defaults',
				name: 'add_defaults',
				type: 'boolean',
				default: false,
				description: 'Whether to add color and mastery level defaults to outcome ratings',
			},
			{
				displayName: 'Calculation Int',
				name: 'calculation_int',
				type: 'number',
				default: 65,
				description: 'Parameter for decaying_average or n_mastery calculation methods',
			},
			{
				displayName: 'Calculation Method',
				name: 'calculation_method',
				type: 'options',
				options: [
					{ name: 'Average', value: 'average' },
					{ name: 'Decaying Average', value: 'decaying_average' },
					{ name: 'Highest', value: 'highest' },
					{ name: 'Latest', value: 'latest' },
					{ name: 'N Mastery', value: 'n_mastery' },
					{ name: 'Weighted Average', value: 'weighted_average' },
				],
				default: 'decaying_average',
				description: 'The method used to calculate student scores',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description: 'The description of the outcome',
			},
			{
				displayName: 'Display Name',
				name: 'display_name',
				type: 'string',
				default: '',
				description: 'A friendly name for reporting purposes',
			},
			{
				displayName: 'Mastery Points',
				name: 'mastery_points',
				type: 'number',
				default: 3,
				description: 'The mastery threshold for the outcome',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the outcome',
			},
			{
				displayName: 'Vendor GUID',
				name: 'vendor_guid',
				type: 'string',
				default: '',
				description: 'A custom GUID for the learning standard',
			},
		],
	},
];
