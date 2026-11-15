import type { INodeProperties } from 'n8n-workflow';

export const groupCategoryOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['groupCategory'],
			},
		},
		options: [
			{
				name: 'Assign Unassigned Members',
				value: 'assignUnassignedMembers',
				description: 'Distribute the students who are in no group of the category evenly among its groups',
				action: 'Assign unassigned members to groups',
			},
			{
				name: 'Bulk Manage Differentiation Tags',
				value: 'bulkManageDifferentiationTags',
				description: 'Create, rename and delete several differentiation tags of one tag set in a single request, or create a new tag set with its tags. Canvas applies all of it or nothing.',
				action: 'Bulk manage differentiation tags',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a group category (group set), optionally with a number of groups',
				action: 'Create a group category',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a group category and all groups in it',
				action: 'Delete a group category',
			},
			{
				name: 'Export',
				value: 'export',
				description: 'Export the students of the course with the group each one is in, as CSV in the format Import accepts. The node outputs the CSV text in the field "value".',
				action: 'Export a group category',
			},
			{
				name: 'Export Differentiation Tags',
				value: 'exportDifferentiationTags',
				description: 'Export the students of a course with their differentiation tags, as CSV in the format Import Differentiation Tags accepts. The rows of students without a tag are shorter than the header row. The node outputs the CSV text in the field "value".',
				action: 'Export differentiation tags',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single group category',
				action: 'Get a group category',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many group categories',
				action: 'Get many group categories',
			},
			{
				name: 'Import',
				value: 'import',
				description: 'Create groups in a group category and put students into them from a CSV file. Canvas works in the background and the node outputs a progress record (see the Progress resource).',
				action: 'Import groups into a category',
			},
			{
				name: 'Import Differentiation Tags',
				value: 'importDifferentiationTags',
				description: 'Create differentiation tags in a course and tag students from a CSV file. Canvas works in the background and the node outputs a progress record (see the Progress resource).',
				action: 'Import differentiation tags',
			},
			{
				name: 'List Groups',
				value: 'listGroups',
				description: 'List groups in a group category',
				action: 'List groups in a category',
			},
			{
				name: 'List Users',
				value: 'listUsers',
				description: 'List the users who can be in the groups of the category (the students of the course), or only those who are in none of its groups yet',
				action: 'List users in a category',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a group category. Canvas clears Self Signup, Auto Leader and Group Limit unless they are sent again.',
				action: 'Update a group category',
			},
		],
		default: 'getAll',
	},
];

const autoLeader: INodeProperties = {
	displayName: 'Auto Leader',
	name: 'auto_leader',
	type: 'options',
	options: [
		{
			name: 'First',
			value: 'first',
			description: 'The first student to join a group becomes its leader',
		},
		{
			name: 'Random',
			value: 'random',
			description: 'A random member becomes the leader',
		},
	],
	default: 'first',
	description: 'How Canvas picks a leader for each group of the category',
};

const groupLimit: INodeProperties = {
	displayName: 'Group Limit',
	name: 'group_limit',
	type: 'number',
	typeOptions: {
		minValue: 2,
	},
	default: 2,
	description: 'Maximum number of members per group (at least 2). Leave the field out for no limit.',
};

const selfSignup: INodeProperties = {
	displayName: 'Self Signup',
	name: 'self_signup',
	type: 'options',
	options: [
		{
			name: 'Disabled',
			value: '',
			description: 'Students cannot join groups themselves',
		},
		{
			name: 'Enabled',
			value: 'enabled',
			description: 'Students can join any group of the category',
		},
		{
			name: 'Restricted',
			value: 'restricted',
			description: 'Students can only join groups whose members are in their own section',
		},
	],
	default: 'enabled',
	description: 'Whether students can join groups themselves. Only for course group categories.',
};

const sisGroupCategoryId: INodeProperties = {
	displayName: 'SIS Group Category ID',
	name: 'sis_group_category_id',
	type: 'string',
	default: '',
	description: 'The SIS ID of the group category (needs the right to manage SIS data)',
};

/** What the import files hold (the same for a binary file and for pasted text). */
const groupCsvColumns =
	'with a header row and one row per student. The student: canvas_user_id, user_id (SIS ID) or login_id. The group: canvas_group_id, group_id (SIS ID) or group_name; a name Canvas does not know in the category creates the group. A student who is in another group of the category is moved. Canvas skips rows it cannot use without an error: students who are not active students of the course, and every further row of a student it has already handled.';

const tagCsvColumns =
	'with a header row and one row per student. The student: canvas_user_id, user_id (SIS ID) or login_id. The tag: canvas_tag_id, tag_id (SIS ID) or tag_name. The tag set: canvas_tag_set_id, tag_set_id (SIS ID) or tag_set_name. Names Canvas does not know in the course create the tag and its set. Canvas skips rows it cannot use without an error: students who are not active students of the course, and every further row of a student it has already handled (to give a student a second tag, import a second file).';

export const groupCategoryFields: INodeProperties[] = [
	// ----------------------------------
	//         groupCategory: shared
	// ----------------------------------
	{
		displayName: 'Group Category ID',
		name: 'groupCategoryId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: [
					'get',
					'update',
					'delete',
					'listGroups',
					'listUsers',
					'assignUnassignedMembers',
					'export',
					'import',
				],
			},
		},
		description: 'The ID of the group category (or "sis_group_category_id:..." for a SIS ID)',
	},

	// ----------------------------------
	//         groupCategory: differentiation tags
	// ----------------------------------
	{
		displayName:
			'Differentiation tags must be allowed in the settings of the account the course belongs to ("Allow Differentiation Tags"); otherwise Canvas refuses with "unauthorized"',
		name: 'differentiationTagsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['exportDifferentiationTags', 'importDifferentiationTags'],
			},
		},
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['bulkManageDifferentiationTags', 'exportDifferentiationTags', 'importDifferentiationTags'],
			},
		},
		description: 'The ID of the course the differentiation tags belong to',
	},

	// ----------------------------------
	//         groupCategory: import, importDifferentiationTags
	// ----------------------------------
	{
		displayName: 'File Source',
		name: 'fileSource',
		type: 'options',
		options: [
			{
				name: 'Binary File',
				value: 'binaryData',
				description: 'A CSV file from a previous node (Convert to File, Read/Write Files, HTTP Request ...)',
			},
			{
				name: 'Text',
				value: 'text',
				description: 'The CSV text itself, typed in or from an expression',
			},
		],
		default: 'binaryData',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['import', 'importDifferentiationTags'],
			},
		},
		description: 'Where the CSV file comes from',
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['import'],
				fileSource: ['binaryData'],
			},
		},
		hint: 'The name of the input binary field containing the CSV file to be imported',
		description: `A UTF-8 CSV file ${groupCsvColumns}`,
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['importDifferentiationTags'],
				fileSource: ['binaryData'],
			},
		},
		hint: 'The name of the input binary field containing the CSV file to be imported',
		description: `A UTF-8 CSV file ${tagCsvColumns}`,
	},
	{
		displayName: 'File Content',
		name: 'fileContent',
		type: 'string',
		typeOptions: {
			rows: 6,
		},
		required: true,
		default: '',
		placeholder: 'canvas_user_id,group_name',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['import'],
				fileSource: ['text'],
			},
		},
		description: `CSV text ${groupCsvColumns}`,
	},
	{
		displayName: 'File Content',
		name: 'fileContent',
		type: 'string',
		typeOptions: {
			rows: 6,
		},
		required: true,
		default: '',
		placeholder: 'canvas_user_id,tag_name,tag_set_name',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['importDifferentiationTags'],
				fileSource: ['text'],
			},
		},
		description: `CSV text ${tagCsvColumns}`,
	},

	// ----------------------------------
	//         groupCategory: bulkManageDifferentiationTags
	// ----------------------------------
	{
		displayName: 'Tag Set ID',
		name: 'groupCategoryId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['bulkManageDifferentiationTags'],
			},
		},
		description:
			'The ID of an existing set of differentiation tags (a group category with Non Collaborative on) of the course. Leave empty to create a new tag set with the name below.',
	},
	{
		displayName: 'Tag Set Name',
		name: 'tagSetName',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['bulkManageDifferentiationTags'],
			},
		},
		description: 'The name of the new tag set, or a new name for the existing one. Required without a Tag Set ID.',
	},
	{
		displayName: 'Tags to Create',
		name: 'tagsToCreate',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Tag',
		default: {},
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['bulkManageDifferentiationTags'],
			},
		},
		options: [
			{
				displayName: 'Tag',
				name: 'tags',
				values: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						description: 'The name of the new differentiation tag',
					},
				],
			},
		],
		description: 'Differentiation tags to add to the tag set',
	},
	{
		displayName: 'Tags to Rename',
		name: 'tagsToRename',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Tag',
		default: {},
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['bulkManageDifferentiationTags'],
			},
		},
		options: [
			{
				displayName: 'Tag',
				name: 'tags',
				values: [
					{
						displayName: 'Tag ID',
						name: 'id',
						type: 'string',
						default: '',
						description: 'The ID of a differentiation tag of the tag set (the ID of the group)',
					},
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						description: 'The new name of the tag',
					},
				],
			},
		],
		description: 'Differentiation tags of the tag set to rename',
	},
	{
		displayName: 'Tag IDs to Delete',
		name: 'tagIdsToDelete',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['bulkManageDifferentiationTags'],
			},
		},
		description:
			'Comma-separated IDs of differentiation tags of the tag set to delete. Students lose the tag, and with it any assignment dates that were set for it.',
	},

	// ----------------------------------
	//         groupCategory: getAll, create
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['getAll', 'create'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
			},
			{
				name: 'Course',
				value: 'course',
			},
		],
		description: 'Whether the group category belongs to a course or to an account',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['getAll', 'create'],
				context: ['account'],
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
				resource: ['groupCategory'],
				operation: ['getAll', 'create'],
				context: ['course'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         groupCategory: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['create'],
			},
		},
		description: 'The name of the group category. Must be unique within the course or account.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['create'],
			},
		},
		options: [
			autoLeader,
			{
				displayName: 'Create Group Count',
				name: 'create_group_count',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'Number of groups to create in the category (courses only). Without Self Signup Canvas also distributes the students of the course among them.',
			},
			groupLimit,
			{
				displayName: 'Non Collaborative',
				name: 'non_collaborative',
				type: 'boolean',
				default: false,
				description: 'Whether to create a set of differentiation tags instead of ordinary groups (courses only; needs the right to add differentiation tags)',
			},
			selfSignup,
			sisGroupCategoryId,
		],
	},

	// ----------------------------------
	//         groupCategory: update
	// ----------------------------------
	{
		displayName:
			'Canvas replaces the settings of the category: Self Signup, Auto Leader and Group Limit are cleared unless you add them here again with their current values',
		name: 'updateNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['update'],
			},
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['update'],
			},
		},
		options: [
			autoLeader,
			{
				displayName: 'Create Group Count',
				name: 'create_group_count',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'Number of additional groups to create in the category (courses only)',
			},
			groupLimit,
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the group category',
			},
			selfSignup,
			sisGroupCategoryId,
		],
	},

	// ----------------------------------
	//         groupCategory: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Collaboration State',
				name: 'collaboration_state',
				type: 'options',
				options: [
					{
						name: 'All',
						value: 'all',
						description: 'Group categories and sets of differentiation tags',
					},
					{
						name: 'Collaborative',
						value: 'collaborative',
						description: 'Ordinary group categories only (what Canvas returns by default)',
					},
					{
						name: 'Non-Collaborative',
						value: 'non_collaborative',
						description: 'Sets of differentiation tags only',
					},
				],
				default: 'collaborative',
				description: 'Whether to return ordinary group categories, sets of differentiation tags, or both',
			},
		],
	},

	// ----------------------------------
	//         groupCategory: listUsers - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['listUsers'],
			},
		},
		options: [
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Only return users whose name or login matches (at least 3 characters)',
			},
			{
				displayName: 'Unassigned',
				name: 'unassigned',
				type: 'boolean',
				default: false,
				description: 'Whether to return only the users who are in no group of the category. Otherwise Canvas returns every student of the course, in a group or not.',
			},
		],
	},

	// ----------------------------------
	//         groupCategory: assignUnassignedMembers - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['groupCategory'],
				operation: ['assignUnassignedMembers'],
			},
		},
		options: [
			{
				displayName: 'Sync',
				name: 'sync',
				type: 'boolean',
				default: false,
				description: 'Whether to wait for the result. Off: Canvas works in the background and the node outputs a progress record. On: the node outputs one item per group with its new members.',
			},
		],
	},
];
