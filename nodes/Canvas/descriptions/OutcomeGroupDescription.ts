import type { INodeProperties } from 'n8n-workflow';

/** Operations Canvas only has for accounts and courses, not for global outcome groups. */
const CONTEXT_ONLY_OPERATIONS = ['getAll', 'getAllLinks', 'unlinkOutcome'];
const ANY_CONTEXT_OPERATIONS = [
	'create',
	'delete',
	'get',
	'getRoot',
	'import',
	'linkOutcome',
	'listOutcomes',
	'listSubgroups',
	'update',
];

const outcomeStyleOption: INodeProperties = {
	displayName: 'Outcome Style',
	name: 'outcome_style',
	type: 'options',
	options: [
		{
			name: 'Abbreviated',
			value: 'abbrev',
			description: 'ID, title, context and URL of each outcome',
		},
		{
			name: 'Full',
			value: 'full',
			description: 'Also the description, ratings and calculation settings of each outcome',
		},
	],
	default: 'full',
	description: 'How much of each outcome to return (Canvas abbreviates by default)',
};

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
				description: 'Create a new subgroup in an outcome group',
				action: 'Create an outcome group',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an outcome group with its subgroups and outcome links',
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
				description: 'Get many outcome groups of an account or course',
				action: 'Get many outcome groups',
			},
			{
				name: 'Get Many Outcome Links',
				value: 'getAllLinks',
				description: 'Get all outcomes of an account or course with the groups they are linked into',
				action: 'Get many outcome links',
			},
			{
				name: 'Get Root',
				value: 'getRoot',
				description: 'Get the top-level outcome group of a context',
				action: 'Get root outcome group',
			},
			{
				name: 'Import',
				value: 'import',
				description: 'Copy an outcome group (with its subgroups and outcomes) into another group',
				action: 'Import an outcome group',
			},
			{
				name: 'Link Outcome',
				value: 'linkOutcome',
				description: 'Link an existing outcome into an outcome group, or move it there from another group',
				action: 'Link an outcome into an outcome group',
			},
			{
				name: 'List Outcomes',
				value: 'listOutcomes',
				description: 'List the outcomes linked directly into an outcome group',
				action: 'List outcomes in a group',
			},
			{
				name: 'List Subgroups',
				value: 'listSubgroups',
				description: 'List the immediate subgroups of an outcome group',
				action: 'List subgroups of an outcome group',
			},
			{
				name: 'Unlink Outcome',
				value: 'unlinkOutcome',
				description:
					'Remove an outcome from an outcome group. The outcome itself is deleted with its last link.',
				action: 'Unlink an outcome from an outcome group',
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
				operation: ANY_CONTEXT_OPERATIONS,
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
				description: 'Outcome groups shared by the whole Canvas instance (site administrators only)',
			},
		],
		description: 'The context for the outcome group',
	},
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['outcomeGroup'],
				operation: CONTEXT_ONLY_OPERATIONS,
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
		description:
			'The account or course of the outcome group. Global outcome groups cannot be listed as a whole (walk them with Get Root, List Subgroups and List Outcomes), and Canvas fails with an error after it has unlinked an outcome from a global group.',
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
	//         outcomeGroup: operations on one group
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
				operation: [
					'get',
					'update',
					'delete',
					'listSubgroups',
					'listOutcomes',
					'create',
					'import',
					'linkOutcome',
					'unlinkOutcome',
				],
			},
		},
		description:
			'The ID of the outcome group (the parent group for Create, the target group for Import and Link Outcome)',
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
		description:
			'The ID of the outcome group to copy. It must be a global group, a group of the same context or a group of an account above it, and not a root group.',
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
				description:
					'Whether to copy in a background job. Canvas then returns a Progress object instead of the new group.',
			},
		],
	},

	// ----------------------------------
	//         outcomeGroup: linkOutcome, unlinkOutcome
	// ----------------------------------
	{
		displayName: 'Outcome ID',
		name: 'outcomeId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcomeGroup'],
				operation: ['linkOutcome', 'unlinkOutcome'],
			},
		},
		description:
			'The ID of the outcome. To link, it must belong to this context, to an account above it or be a global outcome.',
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
				operation: ['linkOutcome'],
			},
		},
		options: [
			{
				displayName: 'Move From Outcome Group ID',
				name: 'move_from',
				type: 'string',
				default: '',
				description:
					'The ID of the group of the same context the outcome is linked into now. The link is moved to the target group instead of adding a second one.',
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
				description:
					'The ID of the new parent outcome group. It must belong to the same context and must not be a subgroup of this group.',
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
		options: [outcomeStyleOption],
	},

	// ----------------------------------
	//         outcomeGroup: getAllLinks - options
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
				operation: ['getAllLinks'],
			},
		},
		options: [
			{
				displayName: 'Outcome Group Style',
				name: 'outcome_group_style',
				type: 'options',
				options: [
					{
						name: 'Abbreviated',
						value: 'abbrev',
						description: 'ID, title, vendor GUID and URLs of each group',
					},
					{
						name: 'Full',
						value: 'full',
						description: 'Also the description and parent group of each group',
					},
				],
				default: 'full',
				description: 'How much of the outcome group of each link to return (Canvas abbreviates by default)',
			},
			outcomeStyleOption,
		],
	},
];
