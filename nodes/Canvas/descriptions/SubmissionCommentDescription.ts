import type { INodeProperties } from 'n8n-workflow';

export const submissionCommentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['submissionComment'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a comment on a submission',
				action: 'Create a submission comment',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a submission comment',
				action: 'Delete a submission comment',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a submission comment',
				action: 'Update a submission comment',
			},
		],
		default: 'create',
	},
];

export const submissionCommentFields: INodeProperties[] = [
	// ----------------------------------
	//         submissionComment: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submissionComment'],
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
				resource: ['submissionComment'],
			},
		},
		description: 'The ID of the assignment',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submissionComment'],
			},
		},
		description: 'The ID of the user whose submission to comment on',
	},

	// ----------------------------------
	//         submissionComment: create
	// ----------------------------------
	{
		displayName: 'Comment',
		name: 'comment',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submissionComment'],
				operation: ['create'],
			},
		},
		description: 'The text content of the comment',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['submissionComment'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Attempt',
				name: 'attempt',
				type: 'number',
				default: 0,
				description: 'The submission attempt to associate the comment with. If not provided, associates with the current submission.',
			},
			{
				displayName: 'File IDs',
				name: 'file_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of file IDs to attach to the comment. Files must be uploaded first using the submission comment files endpoint.',
			},
			{
				displayName: 'Group Comment',
				name: 'group_comment',
				type: 'boolean',
				default: false,
				description: 'Whether the comment should be sent to all group members (for group assignments)',
			},
			{
				displayName: 'Media Comment ID',
				name: 'media_comment_id',
				type: 'string',
				default: '',
				description: 'The ID of a media comment to attach',
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
				description: 'The type of media comment',
			},
		],
	},

	// ----------------------------------
	//         submissionComment: update, delete
	// ----------------------------------
	{
		displayName: 'Comment ID',
		name: 'commentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submissionComment'],
				operation: ['update', 'delete'],
			},
		},
		description: 'The ID of the comment to update or delete',
	},

	// ----------------------------------
	//         submissionComment: update
	// ----------------------------------
	{
		displayName: 'Comment',
		name: 'comment',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['submissionComment'],
				operation: ['update'],
			},
		},
		description: 'The updated text content of the comment',
	},
];
