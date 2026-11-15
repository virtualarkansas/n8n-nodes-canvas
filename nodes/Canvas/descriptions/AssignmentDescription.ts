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
				name: 'Batch Create Overrides',
				value: 'batchCreateOverrides',
				description: 'Create overrides for several assignments of a course in one request: all of them are created, or none',
				action: 'Create several assignment overrides',
			},
			{
				name: 'Batch Get Overrides',
				value: 'batchGetOverrides',
				description: 'Get overrides of several assignments of a course in one request',
				action: 'Get several assignment overrides',
			},
			{
				name: 'Batch Update Overrides',
				value: 'batchUpdateOverrides',
				description: 'Update overrides of several assignments of a course in one request: all of them are updated, or none',
				action: 'Update several assignment overrides',
			},
			{
				name: 'Bulk Update Dates',
				value: 'bulkUpdateDates',
				description: 'Change due and availability dates of several assignments at once (runs as a background job)',
				action: 'Bulk update assignment dates',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new assignment',
				action: 'Create an assignment',
			},
			{
				name: 'Create Override',
				value: 'createOverride',
				description: 'Give students, a section or a group their own dates for an assignment',
				action: 'Create an assignment override',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an assignment',
				action: 'Delete an assignment',
			},
			{
				name: 'Delete Override',
				value: 'deleteOverride',
				description: 'Delete an assignment override',
				action: 'Delete an assignment override',
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
				description: 'Get many assignments of a course, optionally of one assignment group or as seen by one user',
				action: 'Get many assignments',
			},
			{
				name: 'Get Override',
				value: 'getOverride',
				description: 'Get a single assignment override, by its ID or by the group or section it applies to',
				action: 'Get an assignment override',
			},
			{
				name: 'List Group Members',
				value: 'listGroupMembers',
				description: 'List the students who share a group assignment with a student (the members of their group)',
				action: 'List the group members of a student for an assignment',
			},
			{
				name: 'List Overrides',
				value: 'listOverrides',
				description: 'List the overrides of an assignment',
				action: 'List assignment overrides',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an assignment',
				action: 'Update an assignment',
			},
			{
				name: 'Update Override',
				value: 'updateOverride',
				description: 'Update an assignment override',
				action: 'Update an assignment override',
			},
		],
		default: 'getAll',
	},
];

const gradingTypeOptions = [
	{ name: 'GPA Scale', value: 'gpa_scale' },
	{ name: 'Letter Grade', value: 'letter_grade' },
	{ name: 'Not Graded', value: 'not_graded' },
	{ name: 'Pass/Fail', value: 'pass_fail' },
	{ name: 'Percent', value: 'percent' },
	{ name: 'Points', value: 'points' },
];

const submissionTypeOptions = [
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
];

/** Fields shared by Create and Update (alphabetical by display name). */
const assignmentFieldOptions: INodeProperties[] = [
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
		description: 'Comma-separated list of allowed file extensions for online uploads (e.g. "pdf,doc,docx"). Leave empty to allow every file type.',
	},
	{
		displayName: 'Annotatable Attachment ID',
		name: 'annotatable_attachment_id',
		type: 'string',
		default: '',
		description: 'ID of the course file students annotate. Canvas only takes it together with Submission Types that include Student Annotation, so set both.',
	},
	{
		displayName: 'Anonymous Grading',
		name: 'anonymous_grading',
		type: 'boolean',
		default: false,
		description: 'Whether graders cannot see student identities. Canvas ignores this unless the Anonymous Grading feature is enabled for the course.',
	},
	{
		displayName: 'Anonymous Peer Reviews',
		name: 'anonymous_peer_reviews',
		type: 'boolean',
		default: false,
		description: 'Whether peer reviewers stay anonymous to the reviewed student',
	},
	{
		displayName: 'Assignment Group ID',
		name: 'assignment_group_id',
		type: 'string',
		default: '',
		description: 'The ID of the assignment group to place this assignment in',
	},
	{
		displayName: 'Automatic Peer Reviews',
		name: 'automatic_peer_reviews',
		type: 'boolean',
		default: false,
		description: 'Whether Canvas assigns peer reviews automatically (requires Peer Reviews). Otherwise they are assigned manually.',
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
		description: 'The due date for the assignment (ISO 8601 format). Must lie between Unlock At and Lock At.',
	},
	{
		displayName: 'External Tool New Tab',
		name: 'external_tool_new_tab',
		type: 'boolean',
		default: false,
		description: 'Whether the external tool opens in a new tab (External Tool submission type)',
	},
	{
		displayName: 'External Tool URL',
		name: 'external_tool_url',
		type: 'string',
		default: '',
		description: 'Launch URL of the external (LTI) tool. Required when the submission type is External Tool; the URL must match a tool installed in the course or account.',
	},
	{
		displayName: 'Final Grader ID',
		name: 'final_grader_id',
		type: 'string',
		default: '',
		description: 'User ID of the instructor who chooses the final grade of a moderated assignment. Must be an active teacher or TA of the course.',
	},
	{
		displayName: 'Grade Group Students Individually',
		name: 'grade_group_students_individually',
		type: 'boolean',
		default: false,
		description: 'Whether the students of a group assignment are graded individually instead of sharing one grade',
	},
	{
		displayName: 'Grader Comments Visible to Graders',
		name: 'grader_comments_visible_to_graders',
		type: 'boolean',
		default: true,
		description: 'Whether graders of a moderated assignment can see each other\'s comments',
	},
	{
		displayName: 'Grader Count',
		name: 'grader_count',
		type: 'number',
		default: 2,
		description: 'Number of provisional graders of a moderated assignment (at most the number of instructors in the course minus one)',
	},
	{
		displayName: 'Grader Names Visible to Final Grader',
		name: 'grader_names_visible_to_final_grader',
		type: 'boolean',
		default: true,
		description: 'Whether the final grader of a moderated assignment can see the names of the other graders',
	},
	{
		displayName: 'Graders Anonymous to Graders',
		name: 'graders_anonymous_to_graders',
		type: 'boolean',
		default: false,
		description: 'Whether graders of a moderated assignment cannot see each other\'s names (only applies when grader comments are visible to graders)',
	},
	{
		displayName: 'Grading Standard ID',
		name: 'grading_standard_id',
		type: 'string',
		default: '',
		description: 'ID of the grading scheme to use (Letter Grade and GPA Scale grading types). Leave empty for the course default.',
	},
	{
		displayName: 'Grading Type',
		name: 'grading_type',
		type: 'options',
		options: gradingTypeOptions,
		default: 'points',
		description: 'The type of grading for this assignment',
	},
	{
		displayName: 'Group Category ID',
		name: 'group_category_id',
		type: 'string',
		default: '',
		description: 'The ID of the group set that makes this a group assignment',
	},
	{
		displayName: 'Hide in Gradebook',
		name: 'hide_in_gradebook',
		type: 'boolean',
		default: false,
		description: 'Whether to hide the assignment from the gradebook and the student grades page. Canvas only accepts this for assignments worth no points that are also omitted from the final grade.',
	},
	{
		displayName: 'Important Dates',
		name: 'important_dates',
		type: 'boolean',
		default: false,
		description: 'Whether the due date is shown in the Important Dates list of the calendar (Canvas for Elementary)',
	},
	{
		displayName: 'Integration Data',
		name: 'integration_data',
		type: 'json',
		default: '{}',
		description: 'JSON object with data of an external integration (e.g. SIS). Replaces the stored data.',
	},
	{
		displayName: 'Integration ID',
		name: 'integration_id',
		type: 'string',
		default: '',
		description: 'Unique identifier of the assignment in an external integration',
	},
	{
		displayName: 'Intra-Group Peer Reviews',
		name: 'intra_group_peer_reviews',
		type: 'boolean',
		default: false,
		description: 'Whether automatic peer reviews of a group assignment may be assigned to members of the same group',
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
		description: 'Whether the assignment uses moderated grading (several graders, one final grader). Cannot be combined with peer reviews or group assignments.',
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
		displayName: 'Peer Review Count',
		name: 'peer_review_count',
		type: 'number',
		default: 1,
		description: 'Number of reviews each student has to complete (automatic peer reviews)',
	},
	{
		displayName: 'Peer Reviews',
		name: 'peer_reviews',
		type: 'boolean',
		default: false,
		description: 'Whether students can review each other\'s submissions',
	},
	{
		displayName: 'Peer Reviews Assign At',
		name: 'peer_reviews_assign_at',
		type: 'dateTime',
		default: '',
		description: 'When Canvas assigns the automatic peer reviews. Must not be earlier than the due date.',
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
		default: 1,
		description: 'The position of the assignment within its assignment group (1-based)',
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
		description: 'Whether the assignment is published and visible to students. An assignment with student submissions cannot be unpublished.',
	},
	{
		displayName: 'SIS Assignment ID',
		name: 'sis_assignment_id',
		type: 'string',
		default: '',
		description: 'The SIS ID of the assignment (requires permission to manage SIS data)',
	},
	{
		displayName: 'Submission Types',
		name: 'submission_types',
		type: 'multiOptions',
		options: submissionTypeOptions,
		default: [],
		description: 'The allowed submission types. Online Quiz, Discussion Topic, External Tool, None and On Paper cannot be combined with other types.',
	},
	{
		displayName: 'Unlock At',
		name: 'unlock_at',
		type: 'dateTime',
		default: '',
		description: 'The date/time when the assignment becomes available to students',
	},
];

/** Update offers the same fields plus the ones that only make sense for an existing assignment. */
const updateFieldOptions: INodeProperties[] = [
	...assignmentFieldOptions,
	{
		displayName: 'Force Updated At',
		name: 'force_updated_at',
		type: 'boolean',
		default: false,
		description: 'Whether to bump the assignment\'s updated_at even when nothing changed',
	} as INodeProperties,
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		description: 'The name of the assignment',
	} as INodeProperties,
].sort((a, b) => a.displayName.localeCompare(b.displayName));

const overrideDateFields: INodeProperties[] = [
	{
		displayName: 'Due At',
		name: 'due_at',
		type: 'dateTime',
		default: '',
		description: 'The due date for the targeted students. Leave the field out to keep the assignment\'s own due date.',
	},
	{
		displayName: 'Lock At',
		name: 'lock_at',
		type: 'dateTime',
		default: '',
		description: 'When the assignment locks for the targeted students',
	},
	{
		displayName: 'Unlock At',
		name: 'unlock_at',
		type: 'dateTime',
		default: '',
		description: 'When the assignment unlocks for the targeted students',
	},
];

const byDisplayName = (a: INodeProperties, b: INodeProperties): number => a.displayName.localeCompare(b.displayName);

const createOverrideFieldOptions: INodeProperties[] = [
	...overrideDateFields,
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		description: 'Title of an override for individual students (Canvas names section and group overrides after their target)',
	} as INodeProperties,
].sort(byDisplayName);

const updateOverrideFieldOptions: INodeProperties[] = [
	...overrideDateFields,
	{
		displayName: 'Student IDs',
		name: 'student_ids',
		type: 'string',
		default: '',
		description: 'Comma-separated list of user IDs replacing the students of an override for individual students. Ignored for section and group overrides.',
	} as INodeProperties,
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		description: 'Title of an override for individual students. Ignored for section and group overrides.',
	} as INodeProperties,
].sort(byDisplayName);

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
				operation: [
					'batchCreateOverrides',
					'batchGetOverrides',
					'batchUpdateOverrides',
					'bulkUpdateDates',
					'create',
					'createOverride',
					'delete',
					'deleteOverride',
					'duplicate',
					'get',
					'getAll',
					'listGroupMembers',
					'listOverrides',
					'update',
					'updateOverride',
				],
			},
		},
		description: 'The ID of the course',
	},
	// Get Override: a group or a section identifies the course by itself.
	{
		displayName: 'Find Override By',
		name: 'overrideBy',
		type: 'options',
		required: true,
		default: 'id',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['getOverride'],
			},
		},
		options: [
			{ name: 'Group', value: 'group', description: 'The override that applies to a group (group assignments)' },
			{ name: 'Override ID', value: 'id' },
			{ name: 'Section', value: 'section', description: 'The override that applies to a section' },
		],
		description: 'Whether to look the override up by its own ID or by the group or section it was made for',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['getOverride'],
				overrideBy: ['id'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['getOverride'],
				overrideBy: ['group'],
			},
		},
		description: 'The ID of the group the override applies to',
	},
	{
		displayName: 'Section ID',
		name: 'courseSectionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['getOverride'],
				overrideBy: ['section'],
			},
		},
		description: 'The ID of the course section the override applies to',
	},
	{
		displayName: 'Assignment ID',
		name: 'assignmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: [
					'get',
					'update',
					'delete',
					'duplicate',
					'listGroupMembers',
					'listOverrides',
					'getOverride',
					'createOverride',
					'updateOverride',
					'deleteOverride',
				],
			},
		},
		description: 'The ID of the assignment',
	},

	// ----------------------------------
	//         assignment: listGroupMembers
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['listGroupMembers'],
			},
		},
		description: 'The numeric ID of a student of the course (SIS IDs are not accepted here). The result is that student alone when the assignment is not a group assignment or the student is in none of its groups.',
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
		options: assignmentFieldOptions,
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
		options: updateFieldOptions,
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
				displayName: 'Assignment Group ID',
				name: 'assignment_group_id',
				type: 'string',
				default: '',
				description: 'Only return the assignments of this assignment group',
			},
			{
				displayName: 'Assignment IDs',
				name: 'assignment_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of assignment IDs to return (at most 100). Canvas answers with an error when one of them does not exist or is filtered out.',
			},
			{
				displayName: 'Bucket',
				name: 'bucket',
				type: 'options',
				options: [
					{ name: 'Future', value: 'future' },
					{ name: 'Overdue', value: 'overdue' },
					{ name: 'Past', value: 'past' },
					{ name: 'Undated', value: 'undated' },
					{ name: 'Ungraded', value: 'ungraded' },
					{ name: 'Unsubmitted', value: 'unsubmitted' },
					{ name: 'Upcoming', value: 'upcoming' },
				],
				default: 'upcoming',
				description: 'Only return assignments in this state, judged by due date and by the submissions of the user of the credential (or of the user given under User ID)',
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
				default: true,
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
				default: true,
				description: 'Whether to return only assignments that are posted to the SIS (on) or only those that are not (off). Leave this option out to return both.',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Partial match for assignment title',
			},
			{
				displayName: 'User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description: 'Return the assignments this user can see in the course (as that user would see them) instead of those visible to the user of the credential',
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
					{ name: 'Quiz', value: 'Quiz' },
				],
				default: 'Quiz',
				description: 'Return the copy of a New Quizzes assignment in quiz format instead of assignment format (only with the "New Quizzes on the Quizzes page" feature)',
			},
		],
	},

	// ----------------------------------
	//         assignment: bulkUpdateDates
	// ----------------------------------
	{
		displayName: 'Dates',
		name: 'dates',
		type: 'json',
		required: true,
		default: '[]',
		// The placeholder is JSON Canvas reads: its key is "id", not "ID".
		// eslint-disable-next-line n8n-nodes-base/node-param-placeholder-miscased-id
		placeholder: '[{"id": 12, "all_dates": [{"base": true, "due_at": "2030-01-31T23:59:00Z"}]}]',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['bulkUpdateDates'],
			},
		},
		description: 'JSON array with one entry per assignment: its "ID" and "all_dates", a list of date sets. A date set with "base": true changes the assignment\'s own dates, one with the "ID" of an existing override changes that override. Each set may carry due_at, unlock_at and lock_at; use null to clear a date. A list from an expression can be passed as it is.',
	},

	// ----------------------------------
	//         assignment: batch overrides
	// ----------------------------------
	{
		displayName: 'Overrides',
		name: 'overrides',
		type: 'json',
		required: true,
		default: '[\n  { "id": 0, "assignment_id": 0 }\n]',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['batchGetOverrides'],
			},
		},
		description: 'JSON array with one entry per override to fetch: its "ID" and the "assignment_id" it belongs to. The overrides come back in this order; one that does not exist, or that the user of the credential may not see, comes back as { "ID", "assignment_id", "not_found": true }. A list from an expression can be passed as it is.',
	},
	{
		displayName: 'Overrides',
		name: 'overrides',
		type: 'json',
		required: true,
		default: '[]',
		placeholder: '[{"assignment_id": 34, "course_section_id": 56, "due_at": "2030-01-31T23:59:00Z"}]',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['batchCreateOverrides'],
			},
		},
		description: 'JSON array with one entry per new override: "assignment_id", its target (one of "student_ids" (a list), "group_id" or "course_section_id") and optionally "title" (student overrides), "due_at", "unlock_at" and "lock_at". Canvas creates all of them or, when one is refused, none. A list from an expression can be passed as it is.',
	},
	{
		displayName: 'Overrides',
		name: 'overrides',
		type: 'json',
		required: true,
		default: '[]',
		// The placeholder is JSON Canvas reads: its key is "id", not "ID".
		// eslint-disable-next-line n8n-nodes-base/node-param-placeholder-miscased-id
		placeholder: '[{"id": 12, "assignment_id": 34, "due_at": "2030-01-31T23:59:00Z"}]',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['batchUpdateOverrides'],
			},
		},
		description: 'JSON array with one entry per override to change: its "ID", its "assignment_id" and the new values ("due_at", "unlock_at", "lock_at"; for student overrides also "student_ids" and "title"). Every date the override should keep has to be given again: a date that is left out is no longer overridden. Canvas updates all of them or, when one is refused, none. A list from an expression can be passed as it is.',
	},

	// ----------------------------------
	//         assignment: overrides
	// ----------------------------------
	{
		displayName: 'Override ID',
		name: 'overrideId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['updateOverride', 'deleteOverride'],
			},
		},
		description: 'The ID of the assignment override',
	},
	{
		displayName: 'Override ID',
		name: 'overrideId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['getOverride'],
				overrideBy: ['id'],
			},
		},
		description: 'The ID of the assignment override',
	},
	{
		displayName: 'Override Target',
		name: 'overrideTarget',
		type: 'options',
		required: true,
		default: 'students',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['createOverride'],
			},
		},
		options: [
			{ name: 'Group', value: 'group', description: 'A group of the assignment\'s group set (group assignments only)' },
			{ name: 'Section', value: 'section', description: 'A section of the course' },
			{ name: 'Students', value: 'students', description: 'Individual students' },
		],
		description: 'Who the override applies to. A section, group or student can only be targeted by one override per assignment.',
	},
	{
		displayName: 'Student IDs',
		name: 'studentIds',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['createOverride'],
				overrideTarget: ['students'],
			},
		},
		description: 'Comma-separated list of user IDs of students enrolled in the course',
	},
	{
		displayName: 'Section ID',
		name: 'courseSectionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['createOverride'],
				overrideTarget: ['section'],
			},
		},
		description: 'The ID of the course section',
	},
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['createOverride'],
				overrideTarget: ['group'],
			},
		},
		description: 'The ID of the group',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['createOverride'],
			},
		},
		options: createOverrideFieldOptions,
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignment'],
				operation: ['updateOverride'],
			},
		},
		description: 'Every date the override should keep has to be given again: a date that is left out is no longer overridden',
		options: updateOverrideFieldOptions,
	},
];
