import type { INodeProperties } from 'n8n-workflow';

export const latePolicyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['latePolicy'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a late policy for a course',
				action: 'Create a late policy',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the late policy for a course',
				action: 'Get a late policy',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update the late policy for a course',
				action: 'Update a late policy',
			},
		],
		default: 'get',
	},
];

export const latePolicyFields: INodeProperties[] = [
	// ----------------------------------
	//         latePolicy: all operations
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['latePolicy'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         latePolicy: create
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['latePolicy'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Late Submission Deduction',
				name: 'late_submission_deduction',
				type: 'number',
				default: 0,
				description: 'The percentage to deduct per late submission interval',
			},
			{
				displayName: 'Late Submission Deduction Enabled',
				name: 'late_submission_deduction_enabled',
				type: 'boolean',
				default: false,
				description: 'Whether late submission deductions are enabled',
			},
			{
				displayName: 'Late Submission Interval',
				name: 'late_submission_interval',
				type: 'options',
				options: [
					{ name: 'Day', value: 'day' },
					{ name: 'Hour', value: 'hour' },
				],
				default: 'day',
				description: 'The interval for late submission deductions',
			},
			{
				displayName: 'Late Submission Minimum Percent',
				name: 'late_submission_minimum_percent',
				type: 'number',
				default: 0,
				description: 'The minimum percentage a late submission can receive',
			},
			{
				displayName: 'Late Submission Minimum Percent Enabled',
				name: 'late_submission_minimum_percent_enabled',
				type: 'boolean',
				default: false,
				description: 'Whether the minimum percent for late submissions is enabled',
			},
			{
				displayName: 'Missing Submission Deduction',
				name: 'missing_submission_deduction',
				type: 'number',
				default: 0,
				description: 'The percentage to deduct for missing submissions (0-100)',
			},
			{
				displayName: 'Missing Submission Deduction Enabled',
				name: 'missing_submission_deduction_enabled',
				type: 'boolean',
				default: false,
				description: 'Whether missing submission deductions are enabled',
			},
		],
	},

	// ----------------------------------
	//         latePolicy: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['latePolicy'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Late Submission Deduction',
				name: 'late_submission_deduction',
				type: 'number',
				default: 0,
				description: 'The percentage to deduct per late submission interval',
			},
			{
				displayName: 'Late Submission Deduction Enabled',
				name: 'late_submission_deduction_enabled',
				type: 'boolean',
				default: false,
				description: 'Whether late submission deductions are enabled',
			},
			{
				displayName: 'Late Submission Interval',
				name: 'late_submission_interval',
				type: 'options',
				options: [
					{ name: 'Day', value: 'day' },
					{ name: 'Hour', value: 'hour' },
				],
				default: 'day',
				description: 'The interval for late submission deductions',
			},
			{
				displayName: 'Late Submission Minimum Percent',
				name: 'late_submission_minimum_percent',
				type: 'number',
				default: 0,
				description: 'The minimum percentage a late submission can receive',
			},
			{
				displayName: 'Late Submission Minimum Percent Enabled',
				name: 'late_submission_minimum_percent_enabled',
				type: 'boolean',
				default: false,
				description: 'Whether the minimum percent for late submissions is enabled',
			},
			{
				displayName: 'Missing Submission Deduction',
				name: 'missing_submission_deduction',
				type: 'number',
				default: 0,
				description: 'The percentage to deduct for missing submissions (0-100)',
			},
			{
				displayName: 'Missing Submission Deduction Enabled',
				name: 'missing_submission_deduction_enabled',
				type: 'boolean',
				default: false,
				description: 'Whether missing submission deductions are enabled',
			},
		],
	},
];
