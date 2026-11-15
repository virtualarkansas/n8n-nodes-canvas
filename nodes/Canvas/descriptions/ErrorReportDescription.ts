import type { INodeProperties } from 'n8n-workflow';

export const errorReportOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['errorReport'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description:
					'Report a problem to the Canvas administrators, like "Help → Report a Problem" does. Canvas charges 200 units of the rate limit quota per report.',
				action: 'Create an error report',
			},
		],
		default: 'create',
	},
];

export const errorReportFields: INodeProperties[] = [
	{
		displayName: 'Subject',
		name: 'subject',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['errorReport'],
				operation: ['create'],
			},
		},
		description: 'A summary of the problem, like the subject line of an email',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['errorReport'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Comments',
				name: 'comments',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'The long version: what happened and what was expected',
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description:
					'Email address of the person reporting the problem. Without it Canvas uses the address of the current user.',
			},
			{
				displayName: 'Environment (JSON)',
				name: 'httpEnv',
				type: 'json',
				default: '{}',
				description:
					'Information about the environment the problem occurred in, as a JSON object (e.g. {"app": "enrollment sync", "version": "1.4"}). Without it Canvas records details of the request itself.',
			},
			{
				displayName: 'Severity',
				name: 'userPerceivedSeverity',
				type: 'options',
				options: [
					{ name: 'Blocks What I Need to Do', value: 'blocks_what_i_need_to_do' },
					{ name: 'Extreme Critical Emergency', value: 'extreme_critical_emergency' },
					{ name: 'Just a Comment', value: 'just_a_comment' },
					{ name: 'Not Urgent', value: 'not_urgent' },
					{ name: 'Workaround Possible', value: 'workaround_possible' },
				],
				default: 'just_a_comment',
				description: 'How bad the person reporting the problem thinks it is',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				description: 'The address of the page the problem occurred on',
			},
		],
	},
];
