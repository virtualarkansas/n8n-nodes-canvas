import type { INodeProperties } from 'n8n-workflow';

export const outcomeGroupOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['outcomeGroup'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new outcome group (subgroup)',
				action: 'Create an outcome group',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an outcome group',
				action: 'Delete an outcome group',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single outcome group',
				action: 'Get an outcome group',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many outcome groups',
				action: 'Get many outcome groups',
			},
			{
				name: 'Get Root',
				value: 'getRoot',
				description: 'Get the root outcome group',
				action: 'Get root outcome group',
			},
			{
				name: 'Import',
				value: 'import',
				description: 'Import an outcome group from another context',
				action: 'Import an outcome group',
			},
			{
				name: 'List Outcomes',
				value: 'listOutcomes',
				description: 'List outcomes linked to an outcome group',
				action: 'List outcomes in group',
			},
			{
				name: 'List Subgroups',
				value: 'listSubgroups',
				description: 'List subgroups of an outcome group',
				action: 'List subgroups',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an outcome group',
				action: 'Update an outcome group',
			},
		],
		default: 'getAll',
	},
];

export const outcomeGroupFields: INodeProperties[] = [
	// ----------------------------------
	//         outcomeGroup: context selection
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['outcomeGroup'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
				description: 'Outcome group for an account',
			},
			{
				name: 'Course',
				value: 'course',
				description: 'Outcome group for a course',
			},
			{
				name: 'Global',
				value: 'global',
				description: 'Global outcome group',
			},
		],
		description: 'The context for the outcome group',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcomeGroup'],
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
				resource: ['outcomeGroup'],
				context: ['course'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         outcomeGroup: get, update, delete, listSubgroups, listOutcomes, create, import
	// ----------------------------------
	{
		displayName: 'Outcome Group ID',
		name: 'outcomeGroupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcomeGroup'],
				operation: ['get', 'update', 'delete', 'listSubgroups', 'listOutcomes', 'create', 'import'],
			},
		},
		description: 'The ID of the outcome group (parent group for create/import)',
	},

	// ----------------------------------
	//         outcomeGroup: create
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcomeGroup'],
				operation: ['create'],
			},
		},
		description: 'The title of the new subgroup',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcomeGroup'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description: 'The description of the new subgroup',
			},
			{
				displayName: 'Vendor GUID',
				name: 'vendor_guid',
				type: 'string',
				default: '',
				description: 'A custom GUID for the subgroup',
			},
		],
	},

	// ----------------------------------
	//         outcomeGroup: import
	// ----------------------------------
	{
		displayName: 'Source Outcome Group ID',
		name: 'sourceOutcomeGroupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcomeGroup'],
				operation: ['import'],
			},
		},
		description: 'The ID of the source outcome group to import',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcomeGroup'],
				operation: ['import'],
			},
		},
		options: [
			{
				displayName: 'Async',
				name: 'async',
				type: 'boolean',
				default: false,
				description: 'Whether to run the import asynchronously',
			},
		],
	},

	// ----------------------------------
	//         outcomeGroup: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcomeGroup'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description: 'The description of the outcome group',
			},
			{
				displayName: 'Parent Outcome Group ID',
				name: 'parent_outcome_group_id',
				type: 'string',
				default: '',
				description: 'The ID of the new parent outcome group',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the outcome group',
			},
			{
				displayName: 'Vendor GUID',
				name: 'vendor_guid',
				type: 'string',
				default: '',
				description: 'A custom GUID for the outcome group',
			},
		],
	},

	// ----------------------------------
	//         outcomeGroup: listOutcomes - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcomeGroup'],
				operation: ['listOutcomes'],
			},
		},
		options: [
			{
				displayName: 'Outcome Style',
				name: 'outcome_style',
				type: 'options',
				options: [
					{ name: 'Abbrev', value: 'abbrev' },
					{ name: 'Full', value: 'full' },
				],
				default: 'abbrev',
				description: 'The style of outcome data to return',
			},
		],
	},
];
