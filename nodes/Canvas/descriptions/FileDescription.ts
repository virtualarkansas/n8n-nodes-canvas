import type { INodeProperties } from 'n8n-workflow';

export const fileOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['file'],
			},
		},
		options: [
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a file',
				action: 'Delete a file',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a file',
				action: 'Get a file',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many files',
				action: 'Get many files',
			},
			{
				name: 'Get Quota',
				value: 'getQuota',
				description: 'Get storage quota information',
				action: 'Get storage quota',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a file',
				action: 'Update a file',
			},
			{
				name: 'Upload',
				value: 'upload',
				description: 'Upload a file',
				action: 'Upload a file',
			},
		],
		default: 'getAll',
	},
];

export const fileFields: INodeProperties[] = [
	// ----------------------------------
	//         file: context type (shared for getAll, getQuota, upload)
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['getAll', 'getQuota', 'upload'],
			},
		},
		options: [
			{
				name: 'Course',
				value: 'course',
				description: 'Files in a course',
			},
			{
				name: 'Folder',
				value: 'folder',
				description: 'Files in a specific folder',
			},
			{
				name: 'Group',
				value: 'group',
				description: 'Files in a group',
			},
			{
				name: 'User',
				value: 'user',
				description: 'Files for a user',
			},
		],
		description: 'The context to list files from',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['getAll', 'getQuota', 'upload'],
				contextType: ['course'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['getAll', 'getQuota', 'upload'],
				contextType: ['user'],
			},
		},
		description: 'The ID of the user (use "self" for current user)',
	},
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['getAll', 'getQuota', 'upload'],
				contextType: ['group'],
			},
		},
		description: 'The ID of the group',
	},
	{
		displayName: 'Folder ID',
		name: 'folderId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['getAll', 'upload'],
				contextType: ['folder'],
			},
		},
		description: 'The ID of the folder',
	},

	// ----------------------------------
	//         file: get, update, delete
	// ----------------------------------
	{
		displayName: 'File ID',
		name: 'fileId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the file',
	},

	// ----------------------------------
	//         file: upload - file data
	// ----------------------------------
	{
		displayName: 'Input Data Field Name',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['upload'],
			},
		},
		description: 'The name of the incoming field containing the binary file data to upload',
	},

	// ----------------------------------
	//         file: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Content Types',
				name: 'content_types',
				type: 'string',
				default: '',
				description: 'Comma-separated list of content types to include (e.g., "image/png,application/pdf")',
			},
			{
				displayName: 'Exclude Content Types',
				name: 'exclude_content_types',
				type: 'string',
				default: '',
				description: 'Comma-separated list of content types to exclude',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Usage Rights', value: 'usage_rights' },
					{ name: 'User', value: 'user' },
				],
				default: [],
				description: 'Additional information to include with each file',
			},
			{
				displayName: 'Only Names',
				name: 'only_names',
				type: 'boolean',
				default: false,
				description: 'Whether to return only file names (more efficient)',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
				description: 'The sort order',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Search for files by name',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Content Type', value: 'content_type' },
					{ name: 'Created At', value: 'created_at' },
					{ name: 'Name', value: 'name' },
					{ name: 'Size', value: 'size' },
					{ name: 'Updated At', value: 'updated_at' },
					{ name: 'User', value: 'user' },
				],
				default: 'name',
				description: 'The field to sort files by',
			},
		],
	},

	// ----------------------------------
	//         file: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Blueprint Course Status', value: 'blueprint_course_status' },
					{ name: 'Enhanced Preview URL', value: 'enhanced_preview_url' },
					{ name: 'Usage Rights', value: 'usage_rights' },
					{ name: 'User', value: 'user' },
				],
				default: [],
				description: 'Additional information to include with the file',
			},
			{
				displayName: 'Replacement Chain Context ID',
				name: 'replacement_chain_context_id',
				type: 'string',
				default: '',
				description: 'The ID of the replacement chain context',
			},
			{
				displayName: 'Replacement Chain Context Type',
				name: 'replacement_chain_context_type',
				type: 'options',
				options: [
					{ name: 'Course', value: 'Course' },
					{ name: 'Account', value: 'Account' },
				],
				default: 'Course',
				description: 'The type of the replacement chain context',
			},
		],
	},

	// ----------------------------------
	//         file: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Hidden',
				name: 'hidden',
				type: 'boolean',
				default: false,
				description: 'Whether the file is hidden from students',
			},
			{
				displayName: 'Lock At',
				name: 'lock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the file becomes locked',
			},
			{
				displayName: 'Locked',
				name: 'locked',
				type: 'boolean',
				default: false,
				description: 'Whether the file is locked (cannot be downloaded)',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The new name for the file',
			},
			{
				displayName: 'On Duplicate',
				name: 'on_duplicate',
				type: 'options',
				options: [
					{ name: 'Overwrite', value: 'overwrite' },
					{ name: 'Rename', value: 'rename' },
				],
				default: 'overwrite',
				description: 'What to do if a file with the same name already exists in the destination',
			},
			{
				displayName: 'Parent Folder ID',
				name: 'parent_folder_id',
				type: 'string',
				default: '',
				description: 'The ID of the folder to move the file to',
			},
			{
				displayName: 'Unlock At',
				name: 'unlock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the file becomes unlocked',
			},
			{
				displayName: 'Visibility Level',
				name: 'visibility_level',
				type: 'options',
				options: [
					{ name: 'Context', value: 'context' },
					{ name: 'Inherit', value: 'inherit' },
					{ name: 'Institution', value: 'institution' },
					{ name: 'Public', value: 'public' },
				],
				default: 'inherit',
				description: 'The visibility level of the file',
			},
		],
	},

	// ----------------------------------
	//         file: delete - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['delete'],
			},
		},
		options: [
			{
				displayName: 'Replace',
				name: 'replace',
				type: 'boolean',
				default: false,
				description: 'Whether to irreversibly destroy the file content and previews (cannot be undone)',
			},
		],
	},

	// ----------------------------------
	//         file: upload - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['upload'],
			},
		},
		options: [
			{
				displayName: 'Content Type',
				name: 'content_type',
				type: 'string',
				default: '',
				description: 'The content type of the file (e.g., "application/pdf"). If not specified, it will be determined from the file.',
			},
			{
				displayName: 'File Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Override the file name. If not specified, the original file name will be used.',
			},
			{
				displayName: 'On Duplicate',
				name: 'on_duplicate',
				type: 'options',
				options: [
					{ name: 'Overwrite', value: 'overwrite' },
					{ name: 'Rename', value: 'rename' },
				],
				default: 'overwrite',
				description: 'What to do if a file with the same name already exists',
			},
			{
				displayName: 'Parent Folder ID',
				name: 'parent_folder_id',
				type: 'string',
				default: '',
				description: 'The ID of the folder to upload to (overrides context folder)',
			},
			{
				displayName: 'Parent Folder Path',
				name: 'parent_folder_path',
				type: 'string',
				default: '',
				description: 'The path of the folder to upload to (e.g., "course files/assignments")',
			},
		],
	},
];
