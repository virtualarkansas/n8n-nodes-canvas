import type { INodeProperties } from 'n8n-workflow';

export const gradingPeriodSetOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['gradingPeriodSet'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a grading period set',
				action: 'Create a grading period set',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a grading period set',
				action: 'Delete a grading period set',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many grading period sets',
				action: 'Get many grading period sets',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a grading period set',
				action: 'Update a grading period set',
			},
		],
		default: 'getAll',
	},
];

export const gradingPeriodSetFields: INodeProperties[] = [
	// ----------------------------------
	//         gradingPeriodSet: all operations
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingPeriodSet'],
			},
		},
		description: 'The ID of the account',
	},

	// ----------------------------------
	//         gradingPeriodSet: update, delete
	// ----------------------------------
	{
		displayName: 'Grading Period Set ID',
		name: 'gradingPeriodSetId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingPeriodSet'],
				operation: ['update', 'delete'],
			},
		},
		description: 'The ID of the grading period set',
	},

	// ----------------------------------
	//         gradingPeriodSet: create
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradingPeriodSet'],
				operation: ['create'],
			},
		},
		description: 'The title of the grading period set',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['gradingPeriodSet'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Display Totals for All Grading Periods',
				name: 'display_totals_for_all_grading_periods',
				type: 'boolean',
				default: false,
				description: 'Whether to display totals for all grading periods',
			},
			{
				displayName: 'Enrollment Term IDs',
				name: 'enrollment_term_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of enrollment term IDs to associate with this set',
			},
			{
				displayName: 'Weighted',
				name: 'weighted',
				type: 'boolean',
				default: false,
				description: 'Whether grading periods in this set are weighted',
			},
		],
	},

	// ----------------------------------
	//         gradingPeriodSet: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['gradingPeriodSet'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Display Totals for All Grading Periods',
				name: 'display_totals_for_all_grading_periods',
				type: 'boolean',
				default: false,
				description: 'Whether to display totals for all grading periods',
			},
			{
				displayName: 'Enrollment Term IDs',
				name: 'enrollment_term_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of enrollment term IDs to associate with this set',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the grading period set',
			},
			{
				displayName: 'Weighted',
				name: 'weighted',
				type: 'boolean',
				default: false,
				description: 'Whether grading periods in this set are weighted',
			},
		],
	},
];
