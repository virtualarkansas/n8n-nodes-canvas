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
				description: 'Add a comment to a submission. Returns the submission with all its comments (the new one is the last).',
				action: 'Create a submission comment',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a submission comment',
				action: 'Delete a submission comment',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the comments on a submission',
				action: 'Get many submission comments',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a submission comment',
				action: 'Update a submission comment',
			},
			{
				name: 'Upload File',
				value: 'uploadFile',
				description: 'Upload a file to attach to a comment (handles all upload steps). Attach it with Create, using the ID of the uploaded file.',
				action: 'Upload a file for a submission comment',
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
		description: 'The ID of the student the submission belongs to',
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
				description: 'The submission attempt the comment refers to. Without it the comment belongs to the latest attempt.',
			},
			{
				displayName: 'File IDs',
				name: 'file_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of file IDs to attach to the comment. The files must belong to the user of the credential or have been uploaded as comment attachments of this assignment.',
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
				description: 'The ID of a media recording to attach (a media object ID such as "m-1234")',
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
				description: 'The type of the media recording (only sent together with a Media Comment ID)',
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

	// ----------------------------------
	//         submissionComment: uploadFile
	// ----------------------------------
	{
		displayName: 'Upload Source',
		name: 'uploadSource',
		type: 'options',
		required: true,
		default: 'binaryData',
		displayOptions: {
			show: {
				resource: ['submissionComment'],
				operation: ['uploadFile'],
			},
		},
		options: [
			{
				name: 'Binary Data',
				value: 'binaryData',
				description: 'Upload from binary data in the workflow',
			},
			{
				name: 'URL',
				value: 'url',
				description: 'Provide a public URL for Canvas to fetch',
			},
		],
		description: 'Where the file data comes from',
	},
	{
		displayName: 'Input Data Field Name',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: {
			show: {
				resource: ['submissionComment'],
				operation: ['uploadFile'],
				uploadSource: ['binaryData'],
			},
		},
		description: 'The name of the incoming field containing the binary file data to upload',
	},
	{
		displayName: 'File URL',
		name: 'fileUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/file.pdf',
		displayOptions: {
			show: {
				resource: ['submissionComment'],
				operation: ['uploadFile'],
				uploadSource: ['url'],
			},
		},
		description: 'A publicly accessible HTTP or HTTPS URL for Canvas to fetch the file from',
	},
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: {
				resource: ['submissionComment'],
				operation: ['uploadFile'],
				uploadSource: ['url'],
			},
		},
		description: 'Whether to poll until Canvas finishes fetching the URL. If false, returns the progress object immediately.',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['submissionComment'],
				operation: ['uploadFile'],
			},
		},
		options: [
			{
				displayName: 'Content Type',
				name: 'content_type',
				type: 'string',
				default: '',
				description: 'The content type of the file. Without it the type of the binary data is used, or Canvas goes by the file name.',
			},
			{
				displayName: 'File Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the file in Canvas. Without it the file name of the binary data, or the last part of the URL, is used.',
			},
		],
	},
];
