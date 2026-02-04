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
				description: 'Create a peer review assignment',
				action: 'Create a peer review',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a peer review assignment',
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
		description: 'The ID of the submission to assign for peer review',
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
		description: 'The ID of the user to assign as the reviewer',
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
				description: 'Filter peer reviews for a specific submission',
			},
		],
	},
];
