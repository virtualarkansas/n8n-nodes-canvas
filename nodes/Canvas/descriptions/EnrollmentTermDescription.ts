import type { INodeProperties } from 'n8n-workflow';

export const enrollmentTermOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['enrollmentTerm'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new enrollment term',
				action: 'Create an enrollment term',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an enrollment term',
				action: 'Delete an enrollment term',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single enrollment term',
				action: 'Get an enrollment term',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many enrollment terms',
				action: 'Get many enrollment terms',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an enrollment term',
				action: 'Update an enrollment term',
			},
		],
		default: 'getAll',
	},
];

export const enrollmentTermFields: INodeProperties[] = [
	// ----------------------------------
	//         enrollmentTerm: all operations
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['enrollmentTerm'],
			},
		},
		description: 'The ID of the root account (terms only exist on root accounts; sub-accounts are refused)',
	},

	// ----------------------------------
	//         enrollmentTerm: get, update, delete
	// ----------------------------------
	{
		displayName: 'Term ID',
		name: 'termId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['enrollmentTerm'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the enrollment term',
	},

	// ----------------------------------
	//         enrollmentTerm: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['enrollmentTerm'],
				operation: ['create'],
			},
		},
		description: 'The name of the enrollment term',
	},

	// ----------------------------------
	//         enrollmentTerm: create - Additional Fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['enrollmentTerm'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'End At',
				name: 'endAt',
				type: 'dateTime',
				default: '',
				description: 'The end date of the term in ISO 8601 format',
			},
			{
				displayName: 'SIS Term ID',
				name: 'sisTermId',
				type: 'string',
				default: '',
				description: 'The unique SIS identifier for the term',
			},
			{
				displayName: 'Start At',
				name: 'startAt',
				type: 'dateTime',
				default: '',
				description: 'The start date of the term in ISO 8601 format',
			},
		],
	},

	// ----------------------------------
	//         enrollmentTerm: create - Overrides
	// ----------------------------------
	{
		displayName: 'Date Overrides',
		name: 'overrides',
		type: 'fixedCollection',
		placeholder: 'Add Override',
		default: {},
		displayOptions: {
			show: {
				resource: ['enrollmentTerm'],
				operation: ['create', 'update'],
			},
		},
		typeOptions: {
			multipleValues: true,
		},
		options: [
			{
				displayName: 'Override',
				name: 'override',
				values: [
					{
						displayName: 'Enrollment Type',
						name: 'enrollmentType',
						type: 'options',
						options: [
							{ name: 'Designer', value: 'DesignerEnrollment' },
							{ name: 'Student', value: 'StudentEnrollment' },
							{ name: 'TA', value: 'TaEnrollment' },
							{ name: 'Teacher', value: 'TeacherEnrollment' },
						],
						default: 'StudentEnrollment',
						description: 'The enrollment type to override',
					},
					{
						displayName: 'Start At',
						name: 'startAt',
						type: 'dateTime',
						default: '',
						description: 'Override start date for this enrollment type',
					},
					{
						displayName: 'End At',
						name: 'endAt',
						type: 'dateTime',
						default: '',
						description: 'Override end date for this enrollment type',
					},
				],
			},
		],
		description: 'Set different start/end dates for specific enrollment types',
	},

	// ----------------------------------
	//         enrollmentTerm: update - Update Fields
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['enrollmentTerm'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'End At',
				name: 'endAt',
				type: 'dateTime',
				default: '',
				description: 'The end date of the term in ISO 8601 format. Leave empty to remove the end date.',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the enrollment term',
			},
			{
				displayName: 'Override SIS Stickiness',
				name: 'overrideSisStickiness',
				type: 'boolean',
				default: true,
				description:
					'Whether to change fields that an SIS import may later overwrite (Canvas default: true). When turned off, fields marked as changed in Canvas ("sticky") are left alone.',
			},
			{
				displayName: 'SIS Term ID',
				name: 'sisTermId',
				type: 'string',
				default: '',
				description: 'The unique SIS identifier for the term. Leave empty to clear it.',
			},
			{
				displayName: 'Start At',
				name: 'startAt',
				type: 'dateTime',
				default: '',
				description: 'The start date of the term in ISO 8601 format. Leave empty to remove the start date.',
			},
		],
	},

	// ----------------------------------
	//         enrollmentTerm: getAll - Filters
	// ----------------------------------
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['enrollmentTerm'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Course Count', value: 'course_count' },
					{ name: 'Overrides', value: 'overrides' },
				],
				default: [],
				description: 'Additional data to include in the response',
			},
			{
				displayName: 'Term Name',
				name: 'termName',
				type: 'string',
				default: '',
				description: 'Only return terms whose name contains this text',
			},
			{
				displayName: 'Workflow State',
				name: 'workflowState',
				type: 'multiOptions',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'All', value: 'all' },
					{ name: 'Deleted', value: 'deleted' },
				],
				default: [],
				description: 'Filter terms by workflow state. Without this filter only active terms are returned.',
			},
		],
	},
];
