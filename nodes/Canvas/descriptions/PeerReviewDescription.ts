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
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['peerReview'],
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
