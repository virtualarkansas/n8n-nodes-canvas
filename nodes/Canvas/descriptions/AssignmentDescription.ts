import type { INodeProperties } from 'n8n-workflow';

export const assignmentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['assignment'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new assignment',
				action: 'Create an assignment',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an assignment',
				action: 'Delete an assignment',
			},
			{
				name: 'Duplicate',
				value: 'duplicate',
				description: 'Duplicate an existing assignment',
				action: 'Duplicate an assignment',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single assignment',
				action: 'Get an assignment',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many assignments',
				action: 'Get many assignments',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an assignment',
				action: 'Update an assignment',
			},
		],
		default: 'getAll',
	},
];

export const assignmentFields: INodeProperties[] = [
	// ----------------------------------
	//         assignment: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         assignment: get, update, delete, duplicate
	// ----------------------------------
	{
		displayName: 'Assignment ID',
		name: 'assignmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['get', 'update', 'delete', 'duplicate'],
			},
		},
		description: 'The ID of the assignment',
	},

	// ----------------------------------
	//         assignment: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['create'],
			},
		},
		description: 'The name of the assignment',
	},

	// ----------------------------------
	//         assignment: create - additional fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Allowed Attempts',
				name: 'allowed_attempts',
				type: 'number',
				default: -1,
				description: 'Number of allowed submission attempts. Set to -1 for unlimited attempts.',
			},
			{
				displayName: 'Allowed Extensions',
				name: 'allowed_extensions',
				type: 'string',
				default: '',
				description: 'Comma-separated list of allowed file extensions (e.g., "pdf,doc,docx")',
			},
			{
				displayName: 'Anonymous Grading',
				name: 'anonymous_grading',
				type: 'boolean',
				default: false,
				description: 'Whether graders cannot see student identities',
			},
			{
				displayName: 'Assignment Group ID',
				name: 'assignment_group_id',
				type: 'string',
				default: '',
				description: 'The ID of the assignment group to place this assignment in',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The assignment description (supports HTML)',
			},
			{
				displayName: 'Due At',
				name: 'due_at',
				type: 'dateTime',
				default: '',
				description: 'The due date for the assignment (ISO 8601 format)',
			},
			{
				displayName: 'Grading Type',
				name: 'grading_type',
				type: 'options',
				options: [
					{ name: 'GPA Scale', value: 'gpa_scale' },
					{ name: 'Letter Grade', value: 'letter_grade' },
					{ name: 'Not Graded', value: 'not_graded' },
					{ name: 'Pass/Fail', value: 'pass_fail' },
					{ name: 'Percent', value: 'percent' },
					{ name: 'Points', value: 'points' },
				],
				default: 'points',
				description: 'The type of grading for this assignment',
			},
			{
				displayName: 'Group Category ID',
				name: 'group_category_id',
				type: 'string',
				default: '',
				description: 'The ID of the group category for group assignments',
			},
			{
				displayName: 'Lock At',
				name: 'lock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the assignment is locked and submissions are no longer accepted',
			},
			{
				displayName: 'Moderated Grading',
				name: 'moderated_grading',
				type: 'boolean',
				default: false,
				description: 'Whether the assignment uses moderated grading',
			},
			{
				displayName: 'Notify of Update',
				name: 'notify_of_update',
				type: 'boolean',
				default: false,
				description: 'Whether to notify students that the content has changed',
			},
			{
				displayName: 'Omit From Final Grade',
				name: 'omit_from_final_grade',
				type: 'boolean',
				default: false,
				description: 'Whether the assignment is excluded from final grade calculations',
			},
			{
				displayName: 'Only Visible to Overrides',
				name: 'only_visible_to_overrides',
				type: 'boolean',
				default: false,
				description: 'Whether the assignment is only visible to students with overrides',
			},
			{
				displayName: 'Peer Reviews',
				name: 'peer_reviews',
				type: 'boolean',
				default: false,
				description: 'Whether students can review each other\'s submissions',
			},
			{
				displayName: 'Points Possible',
				name: 'points_possible',
				type: 'number',
				default: 0,
				description: 'The maximum number of points for the assignment',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				description: 'The position of the assignment within the assignment group',
			},
			{
				displayName: 'Post to SIS',
				name: 'post_to_sis',
				type: 'boolean',
				default: false,
				description: 'Whether grades should be posted to the SIS',
			},
			{
				displayName: 'Published',
				name: 'published',
				type: 'boolean',
				default: false,
				description: 'Whether the assignment is published and visible to students',
			},
			{
				displayName: 'Submission Types',
				name: 'submission_types',
				type: 'multiOptions',
				options: [
					{ name: 'Discussion Topic', value: 'discussion_topic' },
					{ name: 'External Tool', value: 'external_tool' },
					{ name: 'Media Recording', value: 'media_recording' },
					{ name: 'None', value: 'none' },
					{ name: 'On Paper', value: 'on_paper' },
					{ name: 'Online Quiz', value: 'online_quiz' },
					{ name: 'Online Text Entry', value: 'online_text_entry' },
					{ name: 'Online Upload', value: 'online_upload' },
					{ name: 'Online URL', value: 'online_url' },
					{ name: 'Student Annotation', value: 'student_annotation' },
				],
				default: [],
				description: 'The allowed submission types for this assignment',
			},
			{
				displayName: 'Unlock At',
				name: 'unlock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the assignment becomes available to students',
			},
		],
	},

	// ----------------------------------
	//         assignment: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Allowed Attempts',
				name: 'allowed_attempts',
				type: 'number',
				default: -1,
				description: 'Number of allowed submission attempts. Set to -1 for unlimited attempts.',
			},
			{
				displayName: 'Allowed Extensions',
				name: 'allowed_extensions',
				type: 'string',
				default: '',
				description: 'Comma-separated list of allowed file extensions (e.g., "pdf,doc,docx")',
			},
			{
				displayName: 'Anonymous Grading',
				name: 'anonymous_grading',
				type: 'boolean',
				default: false,
				description: 'Whether graders cannot see student identities',
			},
			{
				displayName: 'Assignment Group ID',
				name: 'assignment_group_id',
				type: 'string',
				default: '',
				description: 'The ID of the assignment group to place this assignment in',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The assignment description (supports HTML)',
			},
			{
				displayName: 'Due At',
				name: 'due_at',
				type: 'dateTime',
				default: '',
				description: 'The due date for the assignment (ISO 8601 format)',
			},
			{
				displayName: 'Force Updated At',
				name: 'force_updated_at',
				type: 'boolean',
				default: false,
				description: 'Whether to force the updated_at timestamp to refresh',
			},
			{
				displayName: 'Grading Type',
				name: 'grading_type',
				type: 'options',
				options: [
					{ name: 'GPA Scale', value: 'gpa_scale' },
					{ name: 'Letter Grade', value: 'letter_grade' },
					{ name: 'Not Graded', value: 'not_graded' },
					{ name: 'Pass/Fail', value: 'pass_fail' },
					{ name: 'Percent', value: 'percent' },
					{ name: 'Points', value: 'points' },
				],
				default: 'points',
				description: 'The type of grading for this assignment',
			},
			{
				displayName: 'Group Category ID',
				name: 'group_category_id',
				type: 'string',
				default: '',
				description: 'The ID of the group category for group assignments',
			},
			{
				displayName: 'Lock At',
				name: 'lock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the assignment is locked and submissions are no longer accepted',
			},
			{
				displayName: 'Moderated Grading',
				name: 'moderated_grading',
				type: 'boolean',
				default: false,
				description: 'Whether the assignment uses moderated grading',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the assignment',
			},
			{
				displayName: 'Notify of Update',
				name: 'notify_of_update',
				type: 'boolean',
				default: false,
				description: 'Whether to notify students that the content has changed',
			},
			{
				displayName: 'Omit From Final Grade',
				name: 'omit_from_final_grade',
				type: 'boolean',
				default: false,
				description: 'Whether the assignment is excluded from final grade calculations',
			},
			{
				displayName: 'Only Visible to Overrides',
				name: 'only_visible_to_overrides',
				type: 'boolean',
				default: false,
				description: 'Whether the assignment is only visible to students with overrides',
			},
			{
				displayName: 'Peer Reviews',
				name: 'peer_reviews',
				type: 'boolean',
				default: false,
				description: 'Whether students can review each other\'s submissions',
			},
			{
				displayName: 'Points Possible',
				name: 'points_possible',
				type: 'number',
				default: 0,
				description: 'The maximum number of points for the assignment',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				description: 'The position of the assignment within the assignment group',
			},
			{
				displayName: 'Post to SIS',
				name: 'post_to_sis',
				type: 'boolean',
				default: false,
				description: 'Whether grades should be posted to the SIS',
			},
			{
				displayName: 'Published',
				name: 'published',
				type: 'boolean',
				default: false,
				description: 'Whether the assignment is published and visible to students',
			},
			{
				displayName: 'Submission Types',
				name: 'submission_types',
				type: 'multiOptions',
				options: [
					{ name: 'Discussion Topic', value: 'discussion_topic' },
					{ name: 'External Tool', value: 'external_tool' },
					{ name: 'Media Recording', value: 'media_recording' },
					{ name: 'None', value: 'none' },
					{ name: 'On Paper', value: 'on_paper' },
					{ name: 'Online Quiz', value: 'online_quiz' },
					{ name: 'Online Text Entry', value: 'online_text_entry' },
					{ name: 'Online Upload', value: 'online_upload' },
					{ name: 'Online URL', value: 'online_url' },
					{ name: 'Student Annotation', value: 'student_annotation' },
				],
				default: [],
				description: 'The allowed submission types for this assignment',
			},
			{
				displayName: 'Unlock At',
				name: 'unlock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the assignment becomes available to students',
			},
		],
	},

	// ----------------------------------
	//         assignment: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Assignment IDs',
				name: 'assignment_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of assignment IDs to retrieve',
			},
			{
				displayName: 'Bucket',
				name: 'bucket',
				type: 'options',
				options: [
					{ name: 'All', value: '' },
					{ name: 'Future', value: 'future' },
					{ name: 'Overdue', value: 'overdue' },
					{ name: 'Past', value: 'past' },
					{ name: 'Undated', value: 'undated' },
					{ name: 'Ungraded', value: 'ungraded' },
					{ name: 'Unsubmitted', value: 'unsubmitted' },
					{ name: 'Upcoming', value: 'upcoming' },
				],
				default: '',
				description: 'Filter assignments by bucket type',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'AB GUID', value: 'ab_guid' },
					{ name: 'All Dates', value: 'all_dates' },
					{ name: 'Assignment Visibility', value: 'assignment_visibility' },
					{ name: 'Can Edit', value: 'can_edit' },
					{ name: 'Observed Users', value: 'observed_users' },
					{ name: 'Overrides', value: 'overrides' },
					{ name: 'Score Statistics', value: 'score_statistics' },
					{ name: 'Submission', value: 'submission' },
				],
				default: [],
				description: 'Additional information to include with each assignment',
			},
			{
				displayName: 'Needs Grading Count by Section',
				name: 'needs_grading_count_by_section',
				type: 'boolean',
				default: false,
				description: 'Whether to split the needs_grading count by section',
			},
			{
				displayName: 'New Quizzes Only',
				name: 'new_quizzes',
				type: 'boolean',
				default: false,
				description: 'Whether to return only New Quizzes assignments',
			},
			{
				displayName: 'Order By',
				name: 'order_by',
				type: 'options',
				options: [
					{ name: 'Due Date', value: 'due_at' },
					{ name: 'Name', value: 'name' },
					{ name: 'Position', value: 'position' },
				],
				default: 'position',
				description: 'The field to sort assignments by',
			},
			{
				displayName: 'Override Assignment Dates',
				name: 'override_assignment_dates',
				type: 'boolean',
				default: true,
				description: 'Whether to apply assignment overrides to dates',
			},
			{
				displayName: 'Post to SIS',
				name: 'post_to_sis',
				type: 'boolean',
				default: false,
				description: 'Whether to filter by SIS posting status',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Partial match for assignment title',
			},
		],
	},

	// ----------------------------------
	//         assignment: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'All Dates',
				name: 'all_dates',
				type: 'boolean',
				default: false,
				description: 'Whether to include all dates associated with the assignment',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'AB GUID', value: 'ab_guid' },
					{ name: 'Assignment Visibility', value: 'assignment_visibility' },
					{ name: 'Can Edit', value: 'can_edit' },
					{ name: 'Observed Users', value: 'observed_users' },
					{ name: 'Overrides', value: 'overrides' },
					{ name: 'Peer Review', value: 'peer_review' },
					{ name: 'Score Statistics', value: 'score_statistics' },
					{ name: 'Submission', value: 'submission' },
				],
				default: [],
				description: 'Additional information to include with the assignment',
			},
			{
				displayName: 'Needs Grading Count by Section',
				name: 'needs_grading_count_by_section',
				type: 'boolean',
				default: false,
				description: 'Whether to split the needs_grading count by section',
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

	// ----------------------------------
	//         assignment: duplicate - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['duplicate'],
			},
		},
		options: [
			{
				displayName: 'Result Type',
				name: 'result_type',
				type: 'options',
				options: [
					{ name: 'Assignment', value: '' },
					{ name: 'Quiz', value: 'Quiz' },
				],
				default: '',
				description: 'The type of object to create from the duplicate',
			},
		],
	},
];
