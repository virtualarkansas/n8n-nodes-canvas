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
				name: 'Get',
				value: 'get',
				description: 'Get a single submission',
				action: 'Get a submission',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many submissions',
				action: 'Get many submissions',
			},
			{
				name: 'Grade',
				value: 'grade',
				description: 'Grade or comment on a submission',
				action: 'Grade a submission',
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

export const submissionFields: INodeProperties[] = [
	// ----------------------------------
	//         submission: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submission'],
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
			},
		},
		description: 'The ID of the assignment',
	},

	// ----------------------------------
	//         submission: get
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
				operation: ['get', 'grade'],
			},
		},
		description: 'The ID of the user whose submission to retrieve',
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
					{ name: 'Rubric Assessment', value: 'rubric_assessment' },
					{ name: 'Submission Comments', value: 'submission_comments' },
					{ name: 'Submission History', value: 'submission_history' },
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
				default: false,
				description: 'Whether to group submissions by student for group assignments',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Assignment', value: 'assignment' },
					{ name: 'Course', value: 'course' },
					{ name: 'Full Rubric Assessment', value: 'full_rubric_assessment' },
					{ name: 'Group', value: 'group' },
					{ name: 'Rubric Assessment', value: 'rubric_assessment' },
					{ name: 'Submission Comments', value: 'submission_comments' },
					{ name: 'Submission History', value: 'submission_history' },
					{ name: 'Total Scores', value: 'total_scores' },
					{ name: 'User', value: 'user' },
					{ name: 'Visibility', value: 'visibility' },
				],
				default: [],
				description: 'Additional information to include with each submission',
			},
			{
				displayName: 'Student IDs',
				name: 'student_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of student IDs to filter submissions. Use "all" for all students.',
			},
			{
				displayName: 'Workflow State',
				name: 'workflow_state',
				type: 'options',
				options: [
					{ name: 'All', value: '' },
					{ name: 'Graded', value: 'graded' },
					{ name: 'Pending Review', value: 'pending_review' },
					{ name: 'Submitted', value: 'submitted' },
					{ name: 'Ungraded', value: 'ungraded' },
				],
				default: '',
				description: 'Filter submissions by workflow state',
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
				description: 'The grade for the submission. Can be points (e.g., "95"), percentage (e.g., "95%"), letter grade (e.g., "A"), pass/fail (e.g., "pass" or "complete").',
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
					{ name: 'None', value: 'none' },
					{ name: 'Missing', value: 'missing' },
					{ name: 'Late', value: 'late' },
					{ name: 'Extended', value: 'extended' },
				],
				default: 'none',
				description: 'The late policy status for the submission',
			},
			{
				displayName: 'Score',
				name: 'score',
				type: 'number',
				default: 0,
				description: 'The numeric score for the submission',
			},
			{
				displayName: 'Seconds Late Override',
				name: 'seconds_late_override',
				type: 'number',
				default: 0,
				description: 'Override the number of seconds the submission is late by',
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
		description: 'The type of submission',
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
		description: 'Comma-separated list of file IDs to attach to the submission. Files must be uploaded first using the Files API.',
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
		description: 'The ID of the media comment for media recording submissions',
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
		description: 'The ID of the attachment to annotate',
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
				displayName: 'Media Comment Type',
				name: 'media_comment_type',
				type: 'options',
				options: [
					{ name: 'Audio', value: 'audio' },
					{ name: 'Video', value: 'video' },
				],
				default: 'audio',
				description: 'The type of media comment (for media recording submissions)',
			},
			{
				displayName: 'User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description: 'Submit on behalf of a specific user (requires appropriate permissions)',
			},
		],
	},
];
