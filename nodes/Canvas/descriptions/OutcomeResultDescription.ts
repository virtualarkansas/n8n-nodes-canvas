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
				name: 'Get Contributing Scores',
				value: 'getContributingScores',
				description: 'Get the alignments of an outcome in a course and the scores students got on them',
				action: 'Get contributing scores',
			},
			{
				name: 'Get Gradebook Settings',
				value: 'getGradebookSettings',
				description:
					"Get the current user's display settings of the Learning Mastery Gradebook of a course",
				action: 'Get learning mastery gradebook settings',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the outcome results of the students of a course, one item per result',
				action: 'Get many outcome results',
			},
			{
				name: 'Get Rollups',
				value: 'getRollups',
				description:
					'Get the calculated outcome scores of a course, one item per student (or one for the whole course)',
				action: 'Get outcome rollups',
			},
			{
				name: 'Get User Details',
				value: 'getUserDetails',
				description:
					'Get what the Learning Mastery Gradebook shows about a student: their sections in the course and their last login (the one before their current session)',
				action: 'Get learning mastery gradebook details of a user',
			},
			{
				name: 'Update Gradebook Settings',
				value: 'updateGradebookSettings',
				description:
					"Update the current user's display settings of the Learning Mastery Gradebook of a course",
				action: 'Update learning mastery gradebook settings',
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
	//         outcomeResult: getGradebookSettings, updateGradebookSettings
	// ----------------------------------
	{
		displayName:
			'These settings are how the Learning Mastery Gradebook of the course is displayed for the user whose token is used (teachers and admins); other users have their own. The course needs the "Learning Mastery Gradebook" feature: without it Canvas answers with an empty response.',
		name: 'gradebookSettingsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['outcomeResult'],
				operation: ['getGradebookSettings', 'updateGradebookSettings'],
			},
		},
	},
	{
		displayName: 'Settings',
		name: 'settings',
		type: 'collection',
		placeholder: 'Add Setting',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcomeResult'],
				operation: ['updateGradebookSettings'],
			},
		},
		description: 'The settings to change (at least one). Settings that are not listed keep their value.',
		options: [
			{
				displayName: 'Name Display Format',
				name: 'name_display_format',
				type: 'options',
				options: [
					{ name: 'First Name Last Name', value: 'first_last' },
					{ name: 'Last Name, First Name', value: 'last_first' },
				],
				default: 'first_last',
				description: 'How the names of the students are written',
			},
			{
				displayName: 'Outcome Arrangement',
				name: 'outcome_arrangement',
				type: 'options',
				options: [
					{ name: 'Alphabetical', value: 'alphabetical' },
					{ name: 'Custom', value: 'custom' },
					{ name: 'Upload Order', value: 'upload_order' },
				],
				default: 'alphabetical',
				description: 'The order of the outcome columns',
			},
			{
				displayName: 'Score Display Format',
				name: 'score_display_format',
				type: 'options',
				options: [
					{ name: 'Icon and Label', value: 'icon_and_label' },
					{ name: 'Icon and Points', value: 'icon_and_points' },
					{ name: 'Icon Only', value: 'icon_only' },
				],
				default: 'icon_only',
				description: 'How a score is shown in a cell',
			},
			{
				displayName: 'Secondary Info Display',
				name: 'secondary_info_display',
				type: 'options',
				options: [
					{ name: 'Integration ID', value: 'integration_id' },
					{ name: 'Login ID', value: 'login_id' },
					{ name: 'None', value: 'none' },
					{ name: 'SIS ID', value: 'sis_id' },
				],
				default: 'none',
				description: 'What to show below the name of each student',
			},
			{
				displayName: 'Show Outcomes with No Results',
				name: 'show_outcomes_with_no_results',
				type: 'boolean',
				default: true,
				description: 'Whether to show outcomes nobody has a result for',
			},
			{
				displayName: 'Show Student Avatars',
				name: 'show_student_avatars',
				type: 'boolean',
				default: true,
				description: 'Whether to show the avatars of the students',
			},
			{
				displayName: 'Show Students with No Results',
				name: 'show_students_with_no_results',
				type: 'boolean',
				default: true,
				description: 'Whether to show students without any outcome result',
			},
			{
				displayName: 'Show Unpublished Assignments',
				name: 'show_unpublished_assignments',
				type: 'boolean',
				default: false,
				description: 'Whether to include unpublished assignments',
			},
			{
				displayName: 'Students Per Page',
				name: 'students_per_page',
				type: 'options',
				options: [
					{ name: '100', value: 100 },
					{ name: '15', value: 15 },
					{ name: '30', value: 30 },
					{ name: '50', value: 50 },
				],
				default: 15,
				description: 'How many students the gradebook shows on a page',
			},
		],
	},

	// ----------------------------------
	//         outcomeResult: getUserDetails
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcomeResult'],
				operation: ['getUserDetails'],
			},
		},
		description:
			'The numeric ID of the user (SIS IDs are not accepted here). Students can only ask about themselves.',
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
