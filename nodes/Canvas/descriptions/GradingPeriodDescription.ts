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
				description: 'Create and update the grading periods of a grading period set in one request',
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
				description: 'Get a single grading period of a course',
				action: 'Get a grading period',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the grading periods of a course or an account',
				action: 'Get many grading periods',
			},
			{
				name: 'Update',
				value: 'update',
				description:
					'Update a legacy grading period that belongs to a course. Periods of a grading period set are changed with Batch Update.',
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
				operation: ['getAll'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
				description: 'The grading periods of every grading period set of the account',
			},
			{
				name: 'Course',
				value: 'course',
				description: 'The grading periods that apply to a course (those of the set its term uses)',
			},
		],
		description: 'Where to list grading periods from',
	},
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'account',
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
				operation: ['delete'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
				description: 'A grading period of a grading period set',
			},
			{
				name: 'Course',
				value: 'course',
				description:
					'A legacy grading period that belongs to the course itself. Periods a course inherits from a grading period set cannot be deleted here.',
			},
		],
		description: 'Where the grading period to delete lives',
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
		displayName:
			'Canvas only updates grading periods that belong to the course itself (legacy grading periods) through this operation and answers "not found" for a period of a grading period set. Use Batch Update for those.',
		name: 'updateNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingPeriod'],
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
				resource: ['gradingPeriod'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				description:
					'The end date of the grading period. A course-level period always closes on its end date.',
			},
			{
				displayName: 'Start Date',
				name: 'start_date',
				type: 'dateTime',
				default: '',
				description: 'The start date of the grading period',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the grading period',
			},
			{
				displayName: 'Weight',
				name: 'weight',
				type: 'number',
				default: 0,
				description: 'The weight of the grading period in percent, used when the set is weighted',
			},
		],
	},

	// ----------------------------------
	//         gradingPeriod: batchUpdate
	// ----------------------------------
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
			},
		},
		description:
			'The ID of the grading period set the periods belong to (see Grading Period Set > Get Many)',
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
						default: '',
						description:
							'When grades of the period can no longer be changed. Must not be before the end date; a new period without a close date closes on its end date.',
					},
					{
						displayName: 'End Date',
						name: 'end_date',
						type: 'dateTime',
						default: '',
						description: 'The end date of the grading period. Required for a new period.',
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						default: '',
						description:
							'The ID of an existing grading period to update; fields left empty keep their value. Leave empty to create a new period.',
					},
					{
						displayName: 'Start Date',
						name: 'start_date',
						type: 'dateTime',
						default: '',
						description:
							'The start date of the grading period. Required for a new period. Periods of one set must not overlap.',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'The title of the grading period. Required for a new period.',
					},
					{
						displayName: 'Weight',
						name: 'weight',
						type: 'string',
						default: '',
						placeholder: '40',
						description:
							'The weight of the grading period in percent, used when the set is weighted. Leave empty to keep the current weight.',
					},
				],
			},
		],
		description:
			'The grading periods to create or update. Periods of the set that are not listed stay as they are. When several periods are sent, Canvas only checks them against each other for overlaps, not against the unlisted periods of the set: list every period of the set when changing dates.',
	},
];
