import type { INodeProperties } from 'n8n-workflow';

export const folderOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['folder'],
			},
		},
		options: [
			{
				name: 'Copy',
				value: 'copy',
				description: 'Copy a folder to another location',
				action: 'Copy a folder',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new folder',
				action: 'Create a folder',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a folder',
				action: 'Delete a folder',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a folder',
				action: 'Get a folder',
			},
			{
				name: 'Get by Path',
				value: 'getByPath',
				description: 'Get a folder by its path',
				action: 'Get folder by path',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many folders',
				action: 'Get many folders',
			},
			{
				name: 'Get Media Folder',
				value: 'getMediaFolder',
				description: 'Get the folder for uploaded media ("Uploaded Media") that the user of the credential may upload to; Canvas creates it when it does not exist yet. It is the folder of the course or group for users who manage its files, and the one in their own personal files for everybody else.',
				action: 'Get the media folder of a course or group',
			},
			{
				name: 'List Files',
				value: 'listFiles',
				description: 'List files in a folder',
				action: 'List files in a folder',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a folder',
				action: 'Update a folder',
			},
		],
		default: 'getAll',
	},
];

export const folderFields: INodeProperties[] = [
	// ----------------------------------
	//         folder: context type (shared for getAll, create, getByPath)
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['create'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
				description: 'A folder in the files of an account',
			},
			{
				name: 'Course',
				value: 'course',
				description: 'A folder in the files of a course',
			},
			{
				name: 'Folder',
				value: 'folder',
				description: 'A sub-folder of a specific folder',
			},
			{
				name: 'Group',
				value: 'group',
				description: 'A folder in the files of a group',
			},
			{
				name: 'User',
				value: 'user',
				description: 'A folder in the personal files of a user',
			},
		],
		description: 'Where to create the folder. Without a parent folder (see Additional Fields) Canvas puts it into the "unfiled" folder of the course, group, user or account.',
	},
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				name: 'Course',
				value: 'course',
				description: 'Every folder of a course, at any depth',
			},
			{
				name: 'Folder',
				value: 'folder',
				description: 'The direct sub-folders of a folder',
			},
			{
				name: 'Group',
				value: 'group',
				description: 'Every folder of a group, at any depth',
			},
			{
				name: 'User',
				value: 'user',
				description: 'Every folder of the personal files of a user, at any depth',
			},
		],
		description: 'Which folders to list',
	},
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['getByPath'],
			},
		},
		options: [
			{
				name: 'Course',
				value: 'course',
			},
			{
				name: 'Group',
				value: 'group',
			},
			{
				name: 'User',
				value: 'user',
			},
		],
		description: 'Whose files the path refers to',
	},
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'none',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['get'],
			},
		},
		options: [
			{
				name: 'Any (Folder ID Only)',
				value: 'none',
				description: 'Find the folder wherever it is',
			},
			{
				name: 'Course',
				value: 'course',
				description: 'A folder of this course; the folder ID "root" stands for its top folder',
			},
			{
				name: 'Group',
				value: 'group',
				description: 'A folder of this group; the folder ID "root" stands for its top folder',
			},
			{
				name: 'User',
				value: 'user',
				description: 'A folder of the personal files of this user; the folder ID "root" stands for its top folder',
			},
		],
		description: 'Whether to look for the folder by its ID alone or within one course, group or user, where a folder from elsewhere is reported as not found',
	},
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['getMediaFolder'],
			},
		},
		options: [
			{
				name: 'Course',
				value: 'course',
			},
			{
				name: 'Group',
				value: 'group',
			},
		],
		description: 'Whether the media folder belongs to a course or a group',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['create'],
				contextType: ['account'],
			},
		},
		description: 'The ID of the account',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['get', 'getAll', 'create', 'getByPath', 'getMediaFolder'],
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
				resource: ['folder'],
				operation: ['get', 'getAll', 'create', 'getByPath'],
				contextType: ['user'],
			},
		},
		description: 'The ID of the user (use "self" for the user of the credential)',
	},
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['get', 'getAll', 'create', 'getByPath', 'getMediaFolder'],
				contextType: ['group'],
			},
		},
		description: 'The ID of the group',
	},
	{
		displayName: 'Parent Folder ID',
		name: 'parentFolderId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['getAll', 'create'],
				contextType: ['folder'],
			},
		},
		description: 'The ID of the parent folder',
	},

	// ----------------------------------
	//         folder: getByPath
	// ----------------------------------
	{
		displayName: 'Folder Path',
		name: 'folderPath',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['getByPath'],
			},
		},
		description: 'The path of the folder below the root folder, e.g. "assignments/homework" (the root folder itself, "course files", is not part of the path). Leave empty for the root folder. Returns every folder along the path, root first.',
	},

	// ----------------------------------
	//         folder: get, update, delete, listFiles
	// ----------------------------------
	{
		displayName: 'Folder ID',
		name: 'folderId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['update', 'delete', 'listFiles'],
			},
		},
		description: 'The ID of the folder',
	},
	{
		displayName: 'Folder ID',
		name: 'folderId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['get'],
			},
		},
		description: 'The ID of the folder. Within a course, group or user (see Context Type), "root" stands for its top folder.',
	},

	// ----------------------------------
	//         folder: copy
	// ----------------------------------
	{
		displayName: 'Destination Folder ID',
		name: 'destinationFolderId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['copy'],
			},
		},
		description: 'The ID of the folder that receives the copy (in the same or another course, group or user)',
	},
	{
		displayName: 'Source Folder ID',
		name: 'sourceFolderId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['copy'],
			},
		},
		description: 'The ID of the folder to copy, with everything in it',
	},

	// ----------------------------------
	//         folder: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['create'],
			},
		},
		description: 'The name of the new folder',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Hidden',
				name: 'hidden',
				type: 'boolean',
				default: false,
				description: 'Whether the folder is hidden from students',
			},
			{
				displayName: 'Lock At',
				name: 'lock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the folder becomes locked',
			},
			{
				displayName: 'Locked',
				name: 'locked',
				type: 'boolean',
				default: false,
				description: 'Whether the folder is locked',
			},
			{
				displayName: 'Parent Folder ID',
				name: 'parent_folder_id',
				type: 'string',
				default: '',
				description: 'The ID of the parent folder within the chosen course, group, user or account. Cannot be combined with Parent Folder Path or with the Folder context.',
			},
			{
				displayName: 'Parent Folder Path',
				name: 'parent_folder_path',
				type: 'string',
				default: '',
				description: 'The path of the parent folder below the root folder (e.g. "assignments/week 1"). Missing folders are created. Cannot be combined with Parent Folder ID or with the Folder context.',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				description: 'The position of the folder in the list',
			},
			{
				displayName: 'Unlock At',
				name: 'unlock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the folder becomes unlocked',
			},
		],
	},

	// ----------------------------------
	//         folder: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Hidden',
				name: 'hidden',
				type: 'boolean',
				default: false,
				description: 'Whether the folder is hidden from students',
			},
			{
				displayName: 'Lock At',
				name: 'lock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the folder becomes locked',
			},
			{
				displayName: 'Locked',
				name: 'locked',
				type: 'boolean',
				default: false,
				description: 'Whether the folder is locked',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The new name for the folder',
			},
			{
				displayName: 'Parent Folder ID',
				name: 'parent_folder_id',
				type: 'string',
				default: '',
				description: 'The ID of the folder to move this folder into (within the same course, group or user)',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				description: 'The position of the folder in the list',
			},
			{
				displayName: 'Unlock At',
				name: 'unlock_at',
				type: 'dateTime',
				default: '',
				description: 'The date/time when the folder becomes unlocked',
			},
		],
	},

	// ----------------------------------
	//         folder: delete - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['delete'],
			},
		},
		options: [
			{
				displayName: 'Force',
				name: 'force',
				type: 'boolean',
				default: false,
				description: 'Whether to delete the folder even if it is not empty (its files and sub-folders are deleted too)',
			},
		],
	},

	// ----------------------------------
	//         folder: listFiles - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['folder'],
				operation: ['listFiles'],
			},
		},
		options: [
			{
				displayName: 'Content Types',
				name: 'content_types',
				type: 'string',
				default: '',
				description: 'Comma-separated list of content types to include. Full types ("application/pdf") or just the first part ("image") are accepted.',
			},
			{
				displayName: 'Exclude Content Types',
				name: 'exclude_content_types',
				type: 'string',
				default: '',
				description: 'Comma-separated list of content types to leave out. Full types ("application/pdf") or just the first part ("image") are accepted.',
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
];
