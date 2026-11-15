import type { INodeProperties } from 'n8n-workflow';

/** Filters shared by Get Many and Get Rollups. */
const filterOptions: Record<'outcomeGroupId' | 'outcomeIds' | 'sectionId' | 'userIds', INodeProperties> = {
	outcomeGroupId: {
		displayName: 'Outcome Group ID',
		name: 'outcome_group_id',
		type: 'string',
		default: '',
		description:
			'Only the outcomes linked directly into this outcome group of the course. Cannot be combined with Outcome IDs.',
	},
	outcomeIds: {
		displayName: 'Outcome IDs',
		name: 'outcome_ids',
		type: 'string',
		default: '',
		placeholder: '12,15',
		description:
			'Comma-separated IDs of the outcomes to return. Canvas refuses outcomes that are not linked into the course.',
	},
	sectionId: {
		displayName: 'Section ID',
		name: 'section_id',
		type: 'string',
		default: '',
		description: 'Only the students of this section of the course. Cannot be combined with User IDs.',
	},
	userIds: {
		displayName: 'User IDs',
		name: 'user_ids',
		type: 'string',
		default: '',
		placeholder: '101,102',
		description:
			'Comma-separated IDs of the students to return ("sis_user_id:..." works too). Canvas refuses users who are not students of the course.',
	},
};

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
				name: 'Assign Outcome Order',
				value: 'assignOutcomeOrder',
				description:
					'Save the order of the outcomes in the Learning Mastery Gradebook of a course for the user of the access token. Canvas uses it when that user arranges the gradebook as "custom".',
				action: 'Assign the outcome order of a course',
			},
			{
				name: 'Get Contributing Scores',
				value: 'getContributingScores',
				description: 'Get the alignments of an outcome in a course and the scores students got on them',
				action: 'Get contributing scores',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the outcome results of the students of a course, one item per result',
				action: 'Get many outcome results',
			},
			{
				name: 'Get Mastery Distribution',
				value: 'getMasteryDistribution',
				description:
					'Get, for every outcome of a course, how many (and which) students reached each mastery level. One item for the whole course.',
				action: 'Get the mastery distribution of a course',
			},
			{
				name: 'Get Rollups',
				value: 'getRollups',
				description:
					'Get the calculated outcome scores of a course, one item per student (or one for the whole course)',
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
		description: 'The ID of an outcome that is linked into the course',
	},

	// ----------------------------------
	//         outcomeResult: assignOutcomeOrder
	// ----------------------------------
	{
		displayName: 'Outcome IDs',
		name: 'outcomeIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: '15,12,13',
		displayOptions: {
			show: {
				resource: ['outcomeResult'],
				operation: ['assignOutcomeOrder'],
			},
		},
		description:
			'Comma-separated numeric IDs of outcomes of the course, in the order they should appear. The list replaces the order saved before; outcomes that are left out come last.',
	},

	// ----------------------------------
	//         outcomeResult: getMasteryDistribution - options
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
				operation: ['getMasteryDistribution'],
			},
		},
		options: [
			{
				displayName: 'Add Defaults',
				name: 'add_defaults',
				type: 'boolean',
				default: false,
				description:
					'Whether to add color and mastery level defaults to the ratings (no effect when the account uses mastery scales)',
			},
			{
				displayName: 'Exclude Outcomes Without Results',
				name: 'exclude_missing_outcome_results',
				type: 'boolean',
				default: false,
				description: 'Whether to leave out the outcomes nobody has a result for',
			},
			{
				displayName: 'Include Alignment Distributions',
				name: 'include_alignment_distributions',
				type: 'boolean',
				default: false,
				description:
					'Whether to add, per outcome, the distribution of the scores on each assignment, quiz or rubric aligned with it',
			},
			{
				displayName: 'Only Assignment Alignments',
				name: 'only_assignment_alignments',
				type: 'boolean',
				default: false,
				description:
					'Whether the alignment distributions are limited to alignments with assignments (with Include Alignment Distributions)',
			},
			filterOptions.outcomeIds,
			{
				displayName: 'Show Unpublished Assignments',
				name: 'show_unpublished_assignments',
				type: 'boolean',
				default: false,
				description:
					'Whether the alignment distributions include unpublished assignments (with Include Alignment Distributions)',
			},
			{
				displayName: 'Student IDs',
				name: 'student_ids',
				type: 'string',
				default: '',
				placeholder: '101,102',
				description: 'Comma-separated numeric IDs of the students to count. Without it every student of the course is counted.',
			},
		],
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
				displayName: 'Include Hidden',
				name: 'include_hidden',
				type: 'boolean',
				default: false,
				description:
					'Whether to include results that are hidden from the learning mastery gradebook and from student rollups',
			},
			filterOptions.outcomeGroupId,
			filterOptions.outcomeIds,
			filterOptions.sectionId,
			filterOptions.userIds,
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
				description:
					'Whether to add color and mastery level defaults to the ratings (no effect when the account uses mastery scales)',
			},
			{
				displayName: 'Aggregate',
				name: 'aggregate',
				type: 'options',
				options: [
					{ name: 'Course', value: 'course' },
				],
				default: 'course',
				description: 'Return one rollup for the whole course instead of one per student',
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
				description: 'The statistic used for the course rollup (with Aggregate)',
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
				description: 'Leave out outcomes without any result, or students without any score',
			},
			filterOptions.outcomeGroupId,
			filterOptions.outcomeIds,
			filterOptions.sectionId,
			{
				displayName: 'Sort By',
				name: 'sort_by',
				type: 'options',
				options: [
					{ name: 'Outcome Score', value: 'outcome', description: 'Requires Sort Outcome ID' },
					{ name: 'Student', value: 'student', description: 'By the sortable name of the student' },
				],
				default: 'student',
				description: 'How to order the student rollups. Rollups are sorted by student unless set otherwise.',
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
				description: 'The direction of the sort (with Sort By)',
			},
			{
				displayName: 'Sort Outcome ID',
				name: 'sort_outcome_id',
				type: 'string',
				default: '',
				description: 'The outcome whose score orders the students when Sort By is Outcome Score',
			},
			filterOptions.userIds,
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
				description: 'Whether to return only alignments with assignments (not with question banks or rubrics)',
			},
			{
				displayName: 'Show Unpublished Assignments',
				name: 'show_unpublished_assignments',
				type: 'boolean',
				default: false,
				description: 'Whether to include alignments with unpublished assignments',
			},
			filterOptions.userIds,
		],
	},
];
