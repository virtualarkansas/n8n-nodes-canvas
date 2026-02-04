import type { INodeProperties } from 'n8n-workflow';

export const proficiencyRatingOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['proficiencyRating'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get proficiency ratings',
				action: 'Get proficiency ratings',
			},
			{
				name: 'Set',
				value: 'set',
				description: 'Create or update proficiency ratings',
				action: 'Set proficiency ratings',
			},
		],
		default: 'get',
	},
];

export const proficiencyRatingFields: INodeProperties[] = [
	// ----------------------------------
	//         proficiencyRating: context selection
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'account',
		displayOptions: {
			show: {
				resource: ['proficiencyRating'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
				description: 'Proficiency ratings for an account',
			},
			{
				name: 'Course',
				value: 'course',
				description: 'Proficiency ratings for a course',
			},
		],
		description: 'The context for the proficiency ratings',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['proficiencyRating'],
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
				resource: ['proficiencyRating'],
				context: ['course'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         proficiencyRating: set
	// ----------------------------------
	{
		displayName: 'Ratings',
		name: 'ratings',
		type: 'fixedCollection',
		placeholder: 'Add Rating',
		required: true,
		default: {},
		displayOptions: {
			show: {
				resource: ['proficiencyRating'],
				operation: ['set'],
			},
		},
		typeOptions: {
			multipleValues: true,
		},
		options: [
			{
				displayName: 'Rating',
				name: 'rating',
				values: [
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						required: true,
						default: '',
						description: 'The description of the rating level',
					},
					{
						displayName: 'Points',
						name: 'points',
						type: 'number',
						required: true,
						default: 0,
						description: 'The non-negative number of points for this rating level',
					},
					{
						displayName: 'Mastery',
						name: 'mastery',
						type: 'boolean',
						required: true,
						default: false,
						description: 'Whether this rating level represents mastery',
					},
					{
						displayName: 'Color',
						name: 'color',
						type: 'color',
						required: true,
						default: '#00FF00',
						description: 'The color associated with this rating level',
					},
				],
			},
		],
		description: 'The proficiency rating levels to set',
	},
];
