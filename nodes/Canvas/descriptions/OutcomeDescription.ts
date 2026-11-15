import type { INodeProperties } from 'n8n-workflow';

const calculationMethodOptions = [
	{ name: 'Average', value: 'average' },
	{ name: 'Decaying Average', value: 'decaying_average' },
	{ name: 'Highest', value: 'highest' },
	{ name: 'Latest', value: 'latest' },
	{ name: 'N Mastery', value: 'n_mastery' },
	{ name: 'Weighted Average', value: 'weighted_average' },
];

/** The Ratings collection of Create and Update. */
function ratingsField(operation: string, description: string): INodeProperties {
	return {
		displayName: 'Ratings',
		name: 'ratings',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: [operation],
			},
		},
		placeholder: 'Add Rating',
		description,
		options: [
			{
				displayName: 'Rating',
				name: 'rating',
				values: [
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						default: '',
						description: 'Name of the rating, for example "Exceeds Expectations"',
					},
					{
						displayName: 'Points',
						name: 'points',
						type: 'number',
						default: 0,
						description: 'Points of the rating',
					},
				],
			},
		],
	};
}

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
				name: 'Create',
				value: 'create',
				description: 'Create an outcome in an outcome group',
				action: 'Create an outcome',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single outcome',
				action: 'Get an outcome',
			},
			{
				name: 'Get Aligned Assignments',
				value: 'getAlignedAssignments',
				description: 'Get the outcome alignments of a student or an assignment in a course',
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
	//         outcome: create
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: ['create'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
			},
			{
				name: 'Course',
				value: 'course',
			},
			{
				name: 'Global',
				value: 'global',
				description: 'Outcomes shared by the whole Canvas instance (site administrators only)',
			},
		],
		default: 'course',
		description: 'Where the outcome group lives. The new outcome belongs to the same context.',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: ['create'],
				context: ['account'],
			},
		},
		description: 'ID of the account',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: ['create'],
				context: ['course'],
			},
		},
		description: 'ID of the course',
	},
	{
		displayName: 'Outcome Group ID',
		name: 'outcomeGroupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: ['create'],
			},
		},
		description:
			'ID of the outcome group to create the outcome in (see Outcome Group > Get Root for the top-level group)',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: ['create'],
			},
		},
		description: 'Title of the outcome',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Calculation Int',
				name: 'calculation_int',
				type: 'number',
				default: 65,
				description:
					'Parameter of the calculation method: the weight of the latest score in percent (Decaying / Weighted Average, 1-99) or the number of mastery scores needed (N Mastery, 1-10)',
			},
			{
				displayName: 'Calculation Method',
				name: 'calculation_method',
				type: 'options',
				options: calculationMethodOptions,
				default: 'decaying_average',
				description: 'How the score of a student for this outcome is calculated from its results',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description: 'Description of the outcome (HTML)',
			},
			{
				displayName: 'Display Name',
				name: 'display_name',
				type: 'string',
				default: '',
				description: 'A friendly name shown to students and in reports',
			},
			{
				displayName: 'Mastery Points',
				name: 'mastery_points',
				type: 'number',
				default: 3,
				description: 'Points needed for mastery. Only used together with Ratings.',
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
	ratingsField(
		'create',
		'The rubric criterion of the outcome. Without Mastery Points the highest rating counts as mastery.',
	),

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
				description:
					'Whether to add color and mastery level defaults to the ratings of the outcome (no effect when the account uses mastery scales)',
			},
		],
	},

	// ----------------------------------
	//         outcome: getAlignedAssignments - options
	// ----------------------------------
	{
		displayName: 'Canvas requires a Student ID or an Assignment ID (or both) for this operation.',
		name: 'alignmentsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['outcome'],
				operation: ['getAlignedAssignments'],
			},
		},
	},
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
				description: 'Return the outcomes aligned with this assignment',
			},
			{
				displayName: 'Student ID',
				name: 'student_id',
				type: 'string',
				default: '',
				description: 'Return the alignments of the outcomes this student can be assessed on',
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
				displayName: 'Calculation Int',
				name: 'calculation_int',
				type: 'number',
				default: 65,
				description:
					'Parameter of the calculation method. When the account uses account-level mastery scales, Canvas takes this from the proficiency ratings of the account or course and refuses to change it on an individual outcome.',
			},
			{
				displayName: 'Calculation Method',
				name: 'calculation_method',
				type: 'options',
				options: calculationMethodOptions,
				default: 'decaying_average',
				description:
					'How the score of a student for this outcome is calculated. When the account uses account-level mastery scales, Canvas takes this from the proficiency ratings of the account or course and refuses to change it on an individual outcome.',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description: 'The description of the outcome (HTML)',
			},
			{
				displayName: 'Display Name',
				name: 'display_name',
				type: 'string',
				default: '',
				description: 'A friendly name shown to students and in reports',
			},
			{
				displayName: 'Mastery Points',
				name: 'mastery_points',
				type: 'number',
				default: 3,
				description:
					'The mastery threshold of the outcome. When the account uses account-level mastery scales, Canvas takes this from the proficiency ratings of the account or course and refuses to change it on an individual outcome.',
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
	ratingsField(
		'update',
		'Replaces all ratings of the outcome (leave empty to keep them). When the account uses account-level mastery scales, Canvas takes this from the proficiency ratings of the account or course and refuses to change it on an individual outcome.',
	),
];
