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
				name: 'Copy',
				value: 'copy',
				description: 'Copy a file into another folder (of the same or another course, group or user)',
				action: 'Copy a file',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a file',
				action: 'Delete a file',
			},
			{
				name: 'Download',
				value: 'download',
				description:
					'Get a file together with its content: the file is attached to the output item as binary data, ready for the next node (Extract From File, Write Files, an upload to another system ...)',
				action: 'Download a file',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a file',
				action: 'Get a file',
			},
			{
				name: 'Get by Migration ID',
				value: 'getByMigrationId',
				description: 'Find the file of a course that a course copy or import created from a file reference (migration ID)',
				action: 'Get a file by migration ID',
			},
			{
				name: 'Get Icon Metadata',
				value: 'getIconMetadata',
				description: 'Get the settings an Icon Maker icon was built with, as stored inside the icon file',
				action: 'Get the metadata of an icon maker icon',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many files',
				action: 'Get many files',
			},
			{
				name: 'Get Public URL',
				value: 'getPublicUrl',
				description: 'Get a temporary URL that downloads the file without a Canvas login',
				action: 'Get the public URL of a file',
			},
			{
				name: 'Get Quota',
				value: 'getQuota',
				description: 'Get storage quota information',
				action: 'Get storage quota',
			},
			{
				name: 'Initiate Upload (Step 1 Only)',
				value: 'initiateUpload',
				description: 'Initiate a file upload - returns upload_url and upload_params for manual completion',
				action: 'Initiate a file upload',
			},
			{
				name: 'List Licenses',
				value: 'listLicenses',
				description: 'List the licenses that can be given to files with Set Usage Rights',
				action: 'List content licenses',
			},
			{
				name: 'Remove Usage Rights',
				value: 'removeUsageRights',
				description: 'Remove copyright and license information from files',
				action: 'Remove usage rights from files',
			},
			{
				name: 'Reset Verifier',
				value: 'resetVerifier',
				description: 'Invalidate every link to the file that carries its "verifier" code by giving the file a new one. Users may do this for their own files; for the files of a course or group it takes the rights to manage files and to act as other users. Deprecated by Instructure together with verifier links.',
				action: 'Reset the link verifier of a file',
			},
			{
				name: 'Set Usage Rights',
				value: 'setUsageRights',
				description: 'Set copyright and license information for files, optionally publishing them',
				action: 'Set usage rights for files',
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
				description: 'Upload a file (handles all three steps automatically)',
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
				operation: ['getAll', 'upload', 'initiateUpload'],
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
		description: 'Where the files live: a course, a group, the personal files of a user, or one specific folder of any of them',
	},
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['getQuota', 'listLicenses', 'setUsageRights', 'removeUsageRights'],
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
		description: 'Whether the files belong to a course, a group or a user',
	},
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'none',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['get'],
			},
		},
		options: [
			{
				name: 'Any (File ID Only)',
				value: 'none',
				description: 'Find the file wherever it is',
			},
			{
				name: 'Course',
				value: 'course',
				description: 'Only find the file when it belongs to this course',
			},
			{
				name: 'Group',
				value: 'group',
				description: 'Only find the file when it belongs to this group',
			},
			{
				name: 'User',
				value: 'user',
				description: 'Only find the file when it is among the personal files of this user',
			},
		],
		description: 'Whether to look for the file by its ID alone or within one course, group or user, where a file from elsewhere is reported as not found',
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
				operation: [
					'get',
					'getAll',
					'getQuota',
					'upload',
					'initiateUpload',
					'listLicenses',
					'setUsageRights',
					'removeUsageRights',
				],
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
				operation: [
					'get',
					'getAll',
					'getQuota',
					'upload',
					'initiateUpload',
					'listLicenses',
					'setUsageRights',
					'removeUsageRights',
				],
				contextType: ['user'],
			},
		},
		description: 'The ID of the user (use "self" for the user of the credential). Canvas only accepts uploads into the files of the user of the credential.',
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
				operation: [
					'get',
					'getAll',
					'getQuota',
					'upload',
					'initiateUpload',
					'listLicenses',
					'setUsageRights',
					'removeUsageRights',
				],
				contextType: ['group'],
			},
		},
		description: 'The ID of the group',
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
				operation: ['getByMigrationId'],
			},
		},
		description: 'The ID of the course the file was copied or imported into',
	},
	{
		displayName: 'Migration ID',
		name: 'migrationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['getByMigrationId'],
			},
		},
		description: 'The file reference used by course copies and imports, e.g. "g83febd708806a010f5a41482de7d06d6" (as found in Content Migration > Get Asset ID Mapping, or in the manifest of a course export)',
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
				operation: ['getAll', 'upload', 'initiateUpload'],
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
				operation: ['get', 'download', 'update', 'delete', 'copy', 'getPublicUrl', 'getIconMetadata', 'resetVerifier'],
			},
		},
		description: 'The ID of the file',
	},

	// ----------------------------------
	//         file: download
	// ----------------------------------
	{
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['download'],
			},
		},
		hint: 'The name of the output binary field to put the file in',
	},

	// ----------------------------------
	//         file: copy
	// ----------------------------------
	{
		displayName: 'Destination Folder ID',
		name: 'destinationFolderId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['copy'],
			},
		},
		description: 'The ID of the folder to copy the file into',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['copy'],
			},
		},
		options: [
			{
				displayName: 'On Duplicate',
				name: 'on_duplicate',
				type: 'options',
				options: [
					{ name: 'Overwrite', value: 'overwrite' },
					{ name: 'Rename', value: 'rename' },
				],
				default: 'rename',
				description: 'What to do if a file with the same name already exists in the destination folder. Without this option Canvas refuses the copy in that case.',
			},
		],
	},

	// ----------------------------------
	//         file: getPublicUrl
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
				operation: ['getPublicUrl'],
			},
		},
		options: [
			{
				displayName: 'Submission ID',
				name: 'submission_id',
				type: 'string',
				default: '',
				description: 'The ID of the submission the file was handed in with. Gives graders access to files that belong to a student.',
			},
		],
	},

	// ----------------------------------
	//         file: usage rights
	// ----------------------------------
	{
		displayName: 'File IDs',
		name: 'fileIds',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['setUsageRights', 'removeUsageRights'],
			},
		},
		description: 'Comma-separated list of file IDs. At least one file or folder is required.',
	},
	{
		displayName: 'Folder IDs',
		name: 'folderIds',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['setUsageRights', 'removeUsageRights'],
			},
		},
		description: 'Comma-separated list of folder IDs: applies to every file in these folders and their sub-folders (files added later are not affected)',
	},
	{
		displayName: 'Use Justification',
		name: 'useJustification',
		type: 'options',
		required: true,
		default: 'own_copyright',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['setUsageRights'],
			},
		},
		options: [
			{ name: 'Creative Commons', value: 'creative_commons' },
			{ name: 'Fair Use', value: 'fair_use' },
			{ name: 'Own Copyright', value: 'own_copyright' },
			{ name: 'Public Domain', value: 'public_domain' },
			{ name: 'Used by Permission', value: 'used_by_permission' },
		],
		description: 'The intellectual property justification for using the files in Canvas',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['setUsageRights'],
			},
		},
		options: [
			{
				displayName: 'Legal Copyright',
				name: 'legal_copyright',
				type: 'string',
				default: '',
				description: 'The legal copyright line for the files, e.g. "(C) 2030 Example University"',
			},
			{
				displayName: 'License',
				name: 'license',
				type: 'string',
				default: '',
				description: 'The ID of the license that applies to the files, e.g. "cc_by_sa" (see List Licenses). Canvas picks a default that fits the justification when this is left out.',
			},
			{
				displayName: 'Publish',
				name: 'publish',
				type: 'boolean',
				default: true,
				description: 'Whether to publish the files once their usage rights are set',
			},
		],
	},

	// ----------------------------------
	//         file: initiateUpload - notice
	// ----------------------------------
	{
		displayName: 'This only performs Step 1 of the Canvas three-step file upload process: it tells Canvas about the file and returns upload_url and upload_params. Sending the file content to that URL is up to you. For a complete upload, use the "Upload" operation instead. <a href="https://canvas.instructure.com/doc/api/file.file_uploads.html" target="_blank">Canvas File Upload Documentation</a>',
		name: 'initiateUploadNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['initiateUpload'],
			},
		},
	},

	// ----------------------------------
	//         file: upload - source selection
	// ----------------------------------
	{
		displayName: 'Upload Source',
		name: 'uploadSource',
		type: 'options',
		required: true,
		default: 'binaryData',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['upload'],
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

	// ----------------------------------
	//         file: upload - binary data field
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
				uploadSource: ['binaryData'],
			},
		},
		description: 'The name of the incoming field containing the binary file data to upload',
	},

	// ----------------------------------
	//         file: upload - URL source fields
	// ----------------------------------
	{
		displayName: 'File URL',
		name: 'fileUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/file.pdf',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['upload'],
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
				resource: ['file'],
				operation: ['upload'],
				uploadSource: ['url'],
			},
		},
		description: 'Whether to poll until Canvas finishes fetching the URL. If false, returns the progress object immediately.',
	},

	// ----------------------------------
	//         file: initiateUpload - binary data field
	// ----------------------------------
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['file'],
				operation: ['initiateUpload'],
			},
		},
		description: 'The name the file will have in Canvas',
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
				description: 'Whether to return only the ID and names of each file (faster for large lists)',
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
				displayName: 'Replacement Chain Course ID',
				name: 'replacement_chain_context_id',
				type: 'string',
				default: '',
				description: 'ID of the course the file belongs to. When the file was deleted because an upload with the same name replaced it, Canvas then returns the file that replaced it instead of "not found".',
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
				description: 'What to do if renaming or moving the file collides with a file of the same name. Without this option Canvas refuses the change in that case.',
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
				description: 'Who may see the file: everyone (public), logged-in users of the institution, members of the course (context), or whatever the course itself allows (inherit)',
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
				description: 'Whether to also replace the stored content and previews with a "file removed" placeholder, e.g. for privacy violations. Cannot be undone and needs the permission to act as other users.',
			},
		],
	},

	// ----------------------------------
	//         file: upload / initiateUpload - options
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
				description: 'What to do if a file with the same name already exists in the folder: replace it (the Canvas default) or store the new file under a numbered name',
			},
			{
				displayName: 'Parent Folder ID',
				name: 'parent_folder_id',
				type: 'string',
				default: '',
				description: 'The ID of the folder to upload to, within the chosen course, group or user. Cannot be combined with Parent Folder Path or with the Folder context.',
			},
			{
				displayName: 'Parent Folder Path',
				name: 'parent_folder_path',
				type: 'string',
				default: '',
				description: 'The path of the folder to upload to, relative to the root folder of the context (e.g. "assignments/week 1"). Missing folders are created. Cannot be combined with Parent Folder ID.',
			},
		],
	},

	// ----------------------------------
	//         file: initiateUpload - options
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
				operation: ['initiateUpload'],
			},
		},
		options: [
			{
				displayName: 'Content Type',
				name: 'content_type',
				type: 'string',
				default: '',
				description: 'The content type of the file (e.g., "application/pdf"). If not specified, Canvas guesses it from the file name.',
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
				description: 'What to do if a file with the same name already exists in the folder: replace it (the Canvas default) or store the new file under a numbered name',
			},
			{
				displayName: 'Parent Folder ID',
				name: 'parent_folder_id',
				type: 'string',
				default: '',
				description: 'The ID of the folder to upload to, within the chosen course, group or user. Cannot be combined with Parent Folder Path or with the Folder context.',
			},
			{
				displayName: 'Parent Folder Path',
				name: 'parent_folder_path',
				type: 'string',
				default: '',
				description: 'The path of the folder to upload to, relative to the root folder of the context (e.g. "assignments/week 1"). Missing folders are created. Cannot be combined with Parent Folder ID.',
			},
			{
				displayName: 'Size',
				name: 'size',
				type: 'number',
				default: 0,
				description: 'The size of the file in bytes. Lets Canvas refuse the upload right away when it would exceed the quota.',
			},
		],
	},
];
