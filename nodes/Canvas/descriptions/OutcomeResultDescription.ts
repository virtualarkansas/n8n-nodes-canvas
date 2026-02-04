import type { INodeProperties } from 'n8n-workflow';

export const outcomeResultOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['outcomeResult'],
			},
		},
		options: [
			{
				name: 'Get Contributing Scores',
				value: 'getContributingScores',
				description: 'Get contributing scores for an outcome',
				action: 'Get contributing scores',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many outcome results',
				action: 'Get many outcome results',
			},
			{
				name: 'Get Rollups',
				value: 'getRollups',
				description: 'Get outcome result rollups',
				action: 'Get outcome rollups',
			},
		],
		default: 'getAll',
	},
];

export const outcomeResultFields: INodeProperties[] = [
	// ----------------------------------
	//         outcomeResult: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcomeResult'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         outcomeResult: getContributingScores
	// ----------------------------------
	{
		displayName: 'Outcome ID',
		name: 'outcomeId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcomeResult'],
				operation: ['getContributingScores'],
			},
		},
		description: 'The ID of the outcome',
	},

	// ----------------------------------
	//         outcomeResult: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcomeResult'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Alignments', value: 'alignments' },
				],
				default: [],
				description: 'Additional information to include with the results',
			},
			{
				displayName: 'Include Hidden',
				name: 'include_hidden',
				type: 'boolean',
				default: false,
				description: 'Whether to include hidden results',
			},
			{
				displayName: 'Outcome IDs',
				name: 'outcome_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of outcome IDs to filter by',
			},
			{
				displayName: 'User IDs',
				name: 'user_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of student IDs to filter by',
			},
		],
	},

	// ----------------------------------
	//         outcomeResult: getRollups - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcomeResult'],
				operation: ['getRollups'],
			},
		},
		options: [
			{
				displayName: 'Add Defaults',
				name: 'add_defaults',
				type: 'boolean',
				default: false,
				description: 'Whether to add mastery level defaults to ratings',
			},
			{
				displayName: 'Aggregate',
				name: 'aggregate',
				type: 'options',
				options: [
					{ name: 'Course', value: 'course' },
				],
				default: 'course',
				description: 'Aggregate rollups for the entire course',
			},
			{
				displayName: 'Aggregate Stat',
				name: 'aggregate_stat',
				type: 'options',
				options: [
					{ name: 'Mean', value: 'mean' },
					{ name: 'Median', value: 'median' },
				],
				default: 'mean',
				description: 'The statistic to use for aggregation',
			},
			{
				displayName: 'Exclude',
				name: 'exclude',
				type: 'multiOptions',
				options: [
					{ name: 'Missing Outcome Results', value: 'missing_outcome_results' },
					{ name: 'Missing User Rollups', value: 'missing_user_rollups' },
				],
				default: [],
				description: 'What to exclude from the results',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Courses', value: 'courses' },
				],
				default: [],
				description: 'Additional information to include with the rollups',
			},
			{
				displayName: 'Outcome IDs',
				name: 'outcome_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of outcome IDs to filter by',
			},
			{
				displayName: 'Sort By',
				name: 'sort_by',
				type: 'options',
				options: [
					{ name: 'Outcome', value: 'outcome' },
					{ name: 'Student', value: 'student' },
				],
				default: 'student',
				description: 'The field to sort results by',
			},
			{
				displayName: 'Sort Order',
				name: 'sort_order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
				description: 'The sort order for results',
			},
			{
				displayName: 'Sort Outcome ID',
				name: 'sort_outcome_id',
				type: 'string',
				default: '',
				description: 'The outcome ID to use for sorting when sort_by is outcome',
			},
			{
				displayName: 'User IDs',
				name: 'user_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of student IDs to filter by',
			},
		],
	},

	// ----------------------------------
	//         outcomeResult: getContributingScores - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcomeResult'],
				operation: ['getContributingScores'],
			},
		},
		options: [
			{
				displayName: 'Only Assignment Alignments',
				name: 'only_assignment_alignments',
				type: 'boolean',
				default: false,
				description: 'Whether to only return assignment-aligned results',
			},
			{
				displayName: 'Show Unpublished Assignments',
				name: 'show_unpublished_assignments',
				type: 'boolean',
				default: false,
				description: 'Whether to include unpublished assignments',
			},
			{
				displayName: 'User IDs',
				name: 'user_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of student IDs to filter by',
			},
		],
	},
];
