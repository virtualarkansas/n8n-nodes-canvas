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
				description: 'Delete a grading period set and its grading periods',
				action: 'Delete a grading period set',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the grading period sets of an account, each with its grading periods',
				action: 'Get many grading period sets',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a grading period set and the terms that use it',
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
		description:
			'The ID of the account. Grading period sets belong to the root account; Canvas only allows creating, updating and deleting them there.',
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
				description: 'Whether to display totals for the "All Grading Periods" view',
			},
			{
				displayName: 'Enrollment Term IDs',
				name: 'enrollment_term_ids',
				type: 'string',
				default: '',
				placeholder: '12,15',
				description:
					'Comma-separated IDs of the enrollment terms that use this set. A term can use only one set; it is moved from its previous set.',
			},
			{
				displayName: 'Weighted',
				name: 'weighted',
				type: 'boolean',
				default: false,
				description: 'Whether the grading periods of this set are weighted',
			},
		],
	},

	// ----------------------------------
	//         gradingPeriodSet: update
	// ----------------------------------
	{
		displayName: 'Enrollment Term IDs',
		name: 'enrollmentTermIds',
		type: 'string',
		default: '',
		placeholder: '12,15',
		displayOptions: {
			show: {
				resource: ['gradingPeriodSet'],
				operation: ['update'],
			},
		},
		description:
			'Comma-separated IDs of all enrollment terms that use this set. Canvas replaces the terms of the set with this list on every update: leaving it empty detaches every term from the set.',
	},
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
		description: 'Canvas requires at least one of these fields on every update',
		options: [
			{
				displayName: 'Display Totals for All Grading Periods',
				name: 'display_totals_for_all_grading_periods',
				type: 'boolean',
				default: false,
				description: 'Whether to display totals for the "All Grading Periods" view',
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
				description: 'Whether the grading periods of this set are weighted',
			},
		],
	},
];
