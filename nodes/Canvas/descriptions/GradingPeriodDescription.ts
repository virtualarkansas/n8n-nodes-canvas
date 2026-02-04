import type { INodeProperties } from 'n8n-workflow';

export const gradingPeriodOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
			},
		},
		options: [
			{
				name: 'Batch Update',
				value: 'batchUpdate',
				description: 'Create or update multiple grading periods',
				action: 'Batch update grading periods',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a grading period',
				action: 'Delete a grading period',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single grading period',
				action: 'Get a grading period',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many grading periods',
				action: 'Get many grading periods',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a grading period',
				action: 'Update a grading period',
			},
		],
		default: 'getAll',
	},
];

export const gradingPeriodFields: INodeProperties[] = [
	// ----------------------------------
	//         gradingPeriod: context selection
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['getAll', 'delete'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
				description: 'List grading periods for an account',
			},
			{
				name: 'Course',
				value: 'course',
				description: 'List grading periods for a course',
			},
		],
		description: 'The context to list grading periods from',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['getAll', 'delete'],
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
				resource: ['gradingPeriod'],
				operation: ['getAll', 'delete'],
				context: ['course'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         gradingPeriod: get, update (course context only)
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['get', 'update'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Grading Period ID',
		name: 'gradingPeriodId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the grading period',
	},

	// ----------------------------------
	//         gradingPeriod: update
	// ----------------------------------
	{
		displayName: 'Start Date',
		name: 'startDate',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['update'],
			},
		},
		description: 'The start date of the grading period',
	},
	{
		displayName: 'End Date',
		name: 'endDate',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['update'],
			},
		},
		description: 'The end date of the grading period',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Weight',
				name: 'weight',
				type: 'number',
				default: 0,
				description: 'The weight of the grading period for weighted grading',
			},
		],
	},

	// ----------------------------------
	//         gradingPeriod: batchUpdate
	// ----------------------------------
	{
		displayName: 'Batch Update Context',
		name: 'batchContext',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['batchUpdate'],
			},
		},
		options: [
			{
				name: 'Course',
				value: 'course',
				description: 'Batch update grading periods for a course',
			},
			{
				name: 'Grading Period Set',
				value: 'gradingPeriodSet',
				description: 'Batch update grading periods for a grading period set',
			},
		],
		description: 'The context for batch updating grading periods',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['batchUpdate'],
				batchContext: ['course'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Grading Period Set ID',
		name: 'gradingPeriodSetId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['batchUpdate'],
				batchContext: ['gradingPeriodSet'],
			},
		},
		description: 'The ID of the grading period set',
	},
	{
		displayName: 'Set ID',
		name: 'setId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['batchUpdate'],
			},
		},
		description: 'The ID of the set to associate grading periods with',
	},
	{
		displayName: 'Grading Periods',
		name: 'gradingPeriods',
		type: 'fixedCollection',
		placeholder: 'Add Grading Period',
		required: true,
		default: {},
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['batchUpdate'],
			},
		},
		typeOptions: {
			multipleValues: true,
		},
		options: [
			{
				displayName: 'Grading Period',
				name: 'gradingPeriod',
				values: [
					{
						displayName: 'Close Date',
						name: 'close_date',
						type: 'dateTime',
						required: true,
						default: '',
						description: 'The close date of the grading period',
					},
					{
						displayName: 'End Date',
						name: 'end_date',
						type: 'dateTime',
						required: true,
						default: '',
						description: 'The end date of the grading period',
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						default: '',
						description: 'The ID of an existing grading period to update (leave empty to create new)',
					},
					{
						displayName: 'Start Date',
						name: 'start_date',
						type: 'dateTime',
						required: true,
						default: '',
						description: 'The start date of the grading period',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						required: true,
						default: '',
						description: 'The title of the grading period',
					},
					{
						displayName: 'Weight',
						name: 'weight',
						type: 'number',
						default: 0,
						description: 'The weight of the grading period for weighted grading',
					},
				],
			},
		],
		description: 'The grading periods to create or update',
	},
];
