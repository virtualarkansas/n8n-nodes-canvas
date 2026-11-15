import type { INodeProperties } from 'n8n-workflow';

export const courseAuditLogOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['courseAuditLog'],
			},
		},
		options: [
			{
				name: 'Get by Account',
				value: 'getByAccount',
				description: 'List course events (created, updated, published, concluded, copied, ...) for every course in an account',
				action: 'Get course events for an account',
			},
			{
				name: 'Get by Course',
				value: 'getByCourse',
				description: 'List the events (created, updated, published, concluded, copied, ...) of one course',
				action: 'Get course events for a course',
			},
		],
		default: 'getByCourse',
	},
];

export const courseAuditLogFields: INodeProperties[] = [
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['courseAuditLog'],
				operation: ['getByAccount'],
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
				resource: ['courseAuditLog'],
				operation: ['getByCourse'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['courseAuditLog'],
			},
		},
		options: [
			{
				displayName: 'End Time',
				name: 'end_time',
				type: 'dateTime',
				default: '',
				description: 'Only return events that happened before this time',
			},
			{
				displayName: 'Start Time',
				name: 'start_time',
				type: 'dateTime',
				default: '',
				description: 'Only return events that happened at or after this time',
			},
		],
	},
];
