import type { INodeProperties } from 'n8n-workflow';

export const submissionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['submission'],
			},
		},
		options: [
			{
				name: 'Bulk Grade',
				value: 'bulkGrade',
				description: 'Grade or comment on the submissions of several students for one assignment (runs as a background job)',
				action: 'Grade multiple submissions',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single submission',
				action: 'Get a submission',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the submissions of many students for one assignment',
				action: 'Get many submissions',
			},
			{
				name: 'Get Many for Students',
				value: 'getAllForStudents',
				description: 'Get submissions across assignments for some or all students of a course or section',
				action: 'Get many submissions for students',
			},
			{
				name: 'Get Summary',
				value: 'getSummary',
				description: 'Count the graded, ungraded and missing submissions of an assignment',
				action: 'Get the submission summary of an assignment',
			},
			{
				name: 'Grade',
				value: 'grade',
				description: 'Grade or comment on a submission',
				action: 'Grade a submission',
			},
			{
				name: 'List Gradeable Students',
				value: 'listGradeableStudents',
				description: 'List the students who can be graded for an assignment',
				action: 'List gradeable students of an assignment',
			},
			{
				name: 'Mark Read',
				value: 'markRead',
				description: 'Mark a submission, or its grade, comments or rubric assessment, as read for the user of the credential',
				action: 'Mark a submission as read',
			},
			{
				name: 'Mark Unread',
				value: 'markUnread',
				description: 'Mark a submission as unread for the user of the credential',
				action: 'Mark a submission as unread',
			},
			{
				name: 'Submit',
				value: 'submit',
				description: 'Submit an assignment',
				action: 'Submit an assignment',
			},
		],
		default: 'getAll',
	},
];

/** Operations that Canvas offers per course and per section. */
const contextOperations = [
	'bulkGrade',
	'get',
	'getAll',
	'getAllForStudents',
	'grade',
	'markRead',
	'markUnread',
	'submit',
];

export const submissionFields: INodeProperties[] = [
	// ----------------------------------
	//         submission: context
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: contextOperations,
			},
		},
		options: [
			{ name: 'Course', value: 'course' },
			{ name: 'Section', value: 'section', description: 'Limits the operation to the students of one section' },
		],
		description: 'Whether to address the submissions through the course or through one of its sections',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: contextOperations,
				contextType: ['course'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Section ID',
		name: 'sectionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: contextOperations,
				contextType: ['section'],
			},
		},
		description: 'The ID of the course section',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['getSummary', 'listGradeableStudents'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Assignment ID',
		name: 'assignmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: [
					'bulkGrade',
					'get',
					'getAll',
					'getSummary',
					'grade',
					'listGradeableStudents',
					'markRead',
					'markUnread',
					'submit',
				],
			},
		},
		description: 'The ID of the assignment',
	},

	// ----------------------------------
	//         submission: get, grade, markRead, markUnread
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['get', 'grade', 'markRead', 'markUnread'],
			},
		},
		description: 'The ID of the student the submission belongs to',
	},

	// ----------------------------------
	//         submission: markRead - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['markRead'],
			},
		},
		options: [
			{
				displayName: 'Item',
				name: 'item',
				type: 'options',
				options: [
					{ name: 'Comment', value: 'comment' },
					{ name: 'Grade', value: 'grade' },
					{ name: 'Rubric', value: 'rubric' },
				],
				default: 'comment',
				description: 'Mark only this part of the submission as read. A submission with unread comments or an unread rubric assessment stays unread until those are marked as read too.',
			},
		],
	},

	// ----------------------------------
	//         submission: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Course', value: 'course' },
					{ name: 'Full Rubric Assessment', value: 'full_rubric_assessment' },
					{
						name: 'Read State',
						value: 'read_state',
						description: 'Adds read_state; reading it marks the submission as read for the user of the credential',
					},
					{ name: 'Rubric Assessment', value: 'rubric_assessment' },
					{ name: 'Student Entered Score', value: 'student_entered_score' },
					{ name: 'Submission Comments', value: 'submission_comments' },
					{ name: 'Submission History', value: 'submission_history' },
					{ name: 'Submission HTML Comments', value: 'submission_html_comments' },
					{ name: 'User', value: 'user' },
					{ name: 'Visibility', value: 'visibility' },
				],
				default: [],
				description: 'Additional information to include with the submission',
			},
		],
	},

	// ----------------------------------
	//         submission: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Grouped',
				name: 'grouped',
				type: 'boolean',
				default: true,
				description: 'Whether to return one submission per student group instead of one per student (group assignments)',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Assignment', value: 'assignment' },
					{ name: 'Course', value: 'course' },
					{ name: 'Group', value: 'group' },
					{
						name: 'Read State',
						value: 'read_state',
						description: 'Adds read_state; reading it marks the submission as read for the user of the credential',
					},
					{ name: 'Rubric Assessment', value: 'rubric_assessment' },
					{ name: 'Student Entered Score', value: 'student_entered_score' },
					{ name: 'Submission Comments', value: 'submission_comments' },
					{ name: 'Submission History', value: 'submission_history' },
					{ name: 'Submission HTML Comments', value: 'submission_html_comments' },
					{ name: 'User', value: 'user' },
					{ name: 'Visibility', value: 'visibility' },
				],
				default: [],
				description: 'Additional information to include with each submission',
			},
		],
	},

	// ----------------------------------
	//         submission: getAllForStudents
	// ----------------------------------
	{
		displayName: 'Student IDs',
		name: 'studentIds',
		type: 'string',
		default: 'all',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['getAllForStudents'],
			},
		},
		description: 'Comma-separated list of student IDs, or "all" for every student of the course or section. Leave empty for the submissions of the user of the credential. Students may only list their own submissions.',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['getAllForStudents'],
			},
		},
		options: [
			{
				displayName: 'Assignment IDs',
				name: 'assignment_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of assignment IDs. Without it the submissions for all assignments are returned.',
			},
			{
				displayName: 'Enrollment State',
				name: 'enrollment_state',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Concluded', value: 'concluded' },
				],
				default: 'active',
				description: 'Only return submissions of students whose enrollment is in this state. Without it every enrollment that is not deleted counts.',
			},
			{
				displayName: 'Graded Since',
				name: 'graded_since',
				type: 'dateTime',
				default: '',
				description: 'Only return submissions graded after this date/time (leaves out ungraded submissions)',
			},
			{
				displayName: 'Grading Period ID',
				name: 'grading_period_id',
				type: 'string',
				default: '',
				description: 'Only return submissions that fall into this grading period',
			},
			{
				displayName: 'Grouped',
				name: 'grouped',
				type: 'boolean',
				default: true,
				description: 'Whether to return one item per student, with the submissions in a "submissions" list, instead of one item per submission',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Assignment', value: 'assignment' },
					{ name: 'Course', value: 'course' },
					{ name: 'Rubric Assessment', value: 'rubric_assessment' },
					{ name: 'Student Entered Score', value: 'student_entered_score' },
					{ name: 'Submission Comments', value: 'submission_comments' },
					{ name: 'Submission History', value: 'submission_history' },
					{ name: 'Submission HTML Comments', value: 'submission_html_comments' },
					{ name: 'Total Scores', value: 'total_scores', description: 'Requires Grouped' },
					{ name: 'User', value: 'user' },
					{ name: 'Visibility', value: 'visibility' },
				],
				default: [],
				description: 'Additional information to include with each submission',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Graded At', value: 'graded_at' },
					{ name: 'ID', value: 'id' },
				],
				default: 'id',
				description: 'The order of the submissions (no effect when grouped)',
			},
			{
				displayName: 'Order Direction',
				name: 'order_direction',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'ascending' },
					{ name: 'Descending', value: 'descending' },
				],
				default: 'ascending',
				description: 'The direction of the order (no effect when grouped)',
			},
			{
				displayName: 'Post to SIS',
				name: 'post_to_sis',
				type: 'boolean',
				default: true,
				description: 'Whether to return only submissions for assignments that are posted to the SIS, of students who were enrolled through the SIS',
			},
			{
				displayName: 'State Based on Date',
				name: 'state_based_on_date',
				type: 'boolean',
				default: true,
				description: 'Whether the Enrollment State filter takes course, section and term dates into account. Turn off to go by the stored state of the enrollment alone.',
			},
			{
				displayName: 'Submitted Since',
				name: 'submitted_since',
				type: 'dateTime',
				default: '',
				description: 'Only return submissions handed in after this date/time (leaves out unsubmitted ones)',
			},
			{
				displayName: 'Workflow State',
				name: 'workflow_state',
				type: 'options',
				options: [
					{ name: 'Graded', value: 'graded' },
					{ name: 'Pending Review', value: 'pending_review' },
					{ name: 'Submitted', value: 'submitted' },
					{ name: 'Unsubmitted', value: 'unsubmitted' },
				],
				default: 'submitted',
				description: 'Only return submissions in this state',
			},
		],
	},

	// ----------------------------------
	//         submission: getSummary - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['getSummary'],
			},
		},
		options: [
			{
				displayName: 'Grouped',
				name: 'grouped',
				type: 'boolean',
				default: true,
				description: 'Whether to count student groups instead of students (group assignments that are graded per group)',
			},
			{
				displayName: 'Include Deactivated',
				name: 'include_deactivated',
				type: 'boolean',
				default: true,
				description: 'Whether to count deactivated students too',
			},
		],
	},

	// ----------------------------------
	//         submission: listGradeableStudents - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['listGradeableStudents'],
			},
		},
		options: [
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
				description: 'The direction of the sort (only with Sort)',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Name', value: 'name' },
				],
				default: 'name',
				description: 'Sort the students by this field. Without it they are ordered by user ID.',
			},
		],
	},

	// ----------------------------------
	//         submission: grade
	// ----------------------------------
	{
		displayName: 'Grade Fields',
		name: 'gradeFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['grade'],
			},
		},
		options: [
			{
				displayName: 'Comment',
				name: 'comment',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'Add a text comment to the submission',
			},
			{
				displayName: 'Excuse',
				name: 'excuse',
				type: 'boolean',
				default: false,
				description: 'Whether to excuse the student from this assignment',
			},
			{
				displayName: 'Grade',
				name: 'posted_grade',
				type: 'string',
				default: '',
				description: 'The grade for the submission: points ("13.5"), a percentage ("40%"), a letter grade ("A-") or "pass"/"complete"/"fail"/"incomplete", whatever the grading type of the assignment. An empty value removes the grade.',
			},
			{
				displayName: 'Group Comment',
				name: 'group_comment',
				type: 'boolean',
				default: false,
				description: 'Whether the comment should be sent to all group members (for group assignments)',
			},
			{
				displayName: 'Late Policy Status',
				name: 'late_policy_status',
				type: 'options',
				options: [
					{ name: 'Extended', value: 'extended' },
					{ name: 'Late', value: 'late' },
					{ name: 'Missing', value: 'missing' },
					{ name: 'None', value: 'none' },
				],
				default: 'none',
				description: 'The late policy status for the submission',
			},
			{
				displayName: 'Prefer Points Over Scheme',
				name: 'prefer_points_over_scheme',
				type: 'boolean',
				default: true,
				description: 'Whether a numeric Grade is read as points even when the assignment uses a grading scheme whose labels are numbers',
			},
			{
				displayName: 'Rubric Assessment',
				name: 'rubric_assessment',
				type: 'json',
				default: '{}',
				description: 'JSON object keyed by rubric criterion ID, each with "points" and optionally "rating_id" and "comments", e.g. {"_1234": {"points": 4, "comments": "Well done"}}. Requires a rubric attached to the assignment; when the rubric is used for grading, the grade becomes the sum of the points.',
			},
			{
				displayName: 'Seconds Late Override',
				name: 'seconds_late_override',
				type: 'number',
				default: 0,
				description: 'How late the submission counts as, in seconds. Only applies together with the late policy status "Late".',
			},
		],
	},

	// ----------------------------------
	//         submission: bulkGrade
	// ----------------------------------
	{
		displayName: 'Grades',
		name: 'grades',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Grade',
		default: {},
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['bulkGrade'],
			},
		},
		description: 'One entry per student. Canvas applies them in a background job and returns its progress object.',
		options: [
			{
				name: 'gradeValues',
				displayName: 'Grade',
				values: [
					{
						displayName: 'Comment',
						name: 'text_comment',
						type: 'string',
						default: '',
						description: 'Add a text comment to the submission',
					},
					{
						displayName: 'Excuse',
						name: 'excuse',
						type: 'boolean',
						default: false,
						description: 'Whether to excuse the student from this assignment',
					},
					{
						displayName: 'Grade',
						name: 'posted_grade',
						type: 'string',
						default: '',
						description: 'The grade: points ("13.5"), a percentage ("40%"), a letter grade ("A-") or "pass"/"complete"/"fail"/"incomplete"',
					},
					{
						displayName: 'Group Comment',
						name: 'group_comment',
						type: 'boolean',
						default: false,
						description: 'Whether the comment should be sent to all group members (for group assignments)',
					},
					{
						displayName: 'Student ID',
						name: 'student_id',
						type: 'string',
						required: true,
						default: '',
						description: 'The ID of the student',
					},
				],
			},
		],
	},

	// ----------------------------------
	//         submission: submit
	// ----------------------------------
	{
		displayName: 'Submission Type',
		name: 'submissionType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['submit'],
			},
		},
		options: [
			{ name: 'Basic LTI Launch', value: 'basic_lti_launch' },
			{ name: 'Media Recording', value: 'media_recording' },
			{ name: 'Online Text Entry', value: 'online_text_entry' },
			{ name: 'Online Upload', value: 'online_upload' },
			{ name: 'Online URL', value: 'online_url' },
			{ name: 'Student Annotation', value: 'student_annotation' },
		],
		default: 'online_text_entry',
		description: 'The type of submission. The assignment must allow it.',
	},
	{
		displayName: 'Body',
		name: 'body',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['submit'],
				submissionType: ['online_text_entry'],
			},
		},
		description: 'The text content of the submission (supports HTML)',
	},
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['submit'],
				submissionType: ['online_url', 'basic_lti_launch'],
			},
		},
		description: 'The URL for the submission',
	},
	{
		displayName: 'File IDs',
		name: 'fileIds',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['submit'],
				submissionType: ['online_upload'],
			},
		},
		description: 'Comma-separated list of file IDs to hand in. The files must belong to the submitting student (their user files or their submission uploads for this assignment).',
	},
	{
		displayName: 'Media Comment ID',
		name: 'mediaCommentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['submit'],
				submissionType: ['media_recording'],
			},
		},
		description: 'The ID of the media recording (a media object ID such as "m-1234")',
	},
	{
		displayName: 'Media Comment Type',
		name: 'mediaCommentType',
		type: 'options',
		required: true,
		default: 'video',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['submit'],
				submissionType: ['media_recording'],
			},
		},
		options: [
			{ name: 'Audio', value: 'audio' },
			{ name: 'Video', value: 'video' },
		],
		description: 'Whether the media recording is audio or video',
	},
	{
		displayName: 'Annotatable Attachment ID',
		name: 'annotatableAttachmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['submit'],
				submissionType: ['student_annotation'],
			},
		},
		description: 'The ID of the file the assignment asks students to annotate',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['submission'],
				operation: ['submit'],
			},
		},
		options: [
			{
				displayName: 'Comment',
				name: 'comment',
				type: 'string',
				typeOptions: {
					rows: 2,
				},
				default: '',
				description: 'Add a text comment along with the submission',
			},
			{
				displayName: 'Group Comment',
				name: 'group_comment',
				type: 'boolean',
				default: false,
				description: 'Whether the comment should be sent to all group members (for group assignments)',
			},
			{
				displayName: 'Submitted At',
				name: 'submitted_at',
				type: 'dateTime',
				default: '',
				description: 'The time the submission counts as handed in. Requires permission to grade.',
			},
			{
				displayName: 'User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description: 'Submit on behalf of this student. Requires permission to grade.',
			},
		],
	},
];
