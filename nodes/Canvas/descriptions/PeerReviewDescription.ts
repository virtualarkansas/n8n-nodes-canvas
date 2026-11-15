import type { INodeProperties } from 'n8n-workflow';

export const peerReviewOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['peerReview'],
			},
		},
		options: [
			{
				name: 'Allocate',
				value: 'allocate',
				description: 'Have Canvas assign the user of the credential (a student) the submissions they still have to review. Requires the course feature "Peer Review Allocation and Grading", which only a site administrator can turn on.',
				action: 'Allocate peer reviews to the current user',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Assign a student to review the submission of another student',
				action: 'Create a peer review',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Remove a reviewer from a submission',
				action: 'Delete a peer review',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many peer reviews for an assignment',
				action: 'Get many peer reviews',
			},
		],
		default: 'getAll',
	},
];

export const peerReviewFields: INodeProperties[] = [
	// ----------------------------------
	//         peerReview: shared
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['peerReview'],
				operation: ['create', 'delete', 'getAll'],
			},
		},
		options: [
			{ name: 'Course', value: 'course' },
			{
				name: 'Section',
				value: 'section',
				description: 'Reach the assignment through one of the sections of its course. Canvas does not limit the peer reviews to the students of that section.',
			},
		],
		description: 'Whether to address the assignment through its course or through one of the sections of that course',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['peerReview'],
				operation: ['create', 'delete', 'getAll'],
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
				resource: ['peerReview'],
				operation: ['create', 'delete', 'getAll'],
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
				resource: ['peerReview'],
				operation: ['allocate'],
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
				resource: ['peerReview'],
			},
		},
		description: 'The ID of the assignment',
	},

	// ----------------------------------
	//         peerReview: create, delete
	// ----------------------------------
	{
		displayName: 'Submission ID',
		name: 'submissionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['peerReview'],
				operation: ['create', 'delete'],
			},
		},
		description: 'The ID of the submission to be reviewed (the "ID" of the submission, not the ID of the student)',
	},
	{
		displayName: 'Reviewer User ID',
		name: 'reviewerUserId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['peerReview'],
				operation: ['create', 'delete'],
			},
		},
		description: 'The user ID of the reviewing student. A student cannot review their own submission.',
	},

	// ----------------------------------
	//         peerReview: allocate - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['peerReview'],
				operation: ['allocate'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Submission Comments', value: 'submission_comments' },
					{ name: 'User', value: 'user' },
				],
				default: [],
				description: 'Associations to include with each peer review',
			},
		],
	},

	// ----------------------------------
	//         peerReview: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['peerReview'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Submission Comments', value: 'submission_comments' },
					{ name: 'User', value: 'user' },
				],
				default: [],
				description: 'Associations to include with the peer review',
			},
			{
				displayName: 'Submission ID',
				name: 'submission_id',
				type: 'string',
				default: '',
				description: 'Only return the peer reviews of this submission (the "ID" of the submission, not the ID of the student)',
			},
		],
	},
];
