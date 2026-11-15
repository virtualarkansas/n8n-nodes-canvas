import type { INodeProperties } from 'n8n-workflow';

export const outcomeImportOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['outcomeImport'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Import outcomes from a CSV file',
				action: 'Create an outcome import',
			},
			{
				name: 'Get Created Group IDs',
				value: 'getCreatedGroupIds',
				description: 'Get IDs of outcome groups created after a successful import',
				action: 'Get created group ids',
			},
			{
				name: 'Get Status',
				value: 'getStatus',
				description: 'Get the status of an outcome import',
				action: 'Get outcome import status',
			},
		],
		default: 'getStatus',
	},
];

export const outcomeImportFields: INodeProperties[] = [
	// ----------------------------------
	//         outcomeImport: context selection
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['outcomeImport'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
				description: 'Outcome import for an account',
			},
			{
				name: 'Course',
				value: 'course',
				description: 'Outcome import for a course',
			},
		],
		description: 'The context for the outcome import',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcomeImport'],
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
				resource: ['outcomeImport'],
				context: ['course'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         outcomeImport: getStatus, getCreatedGroupIds
	// ----------------------------------
	{
		displayName: 'Import ID',
		name: 'importId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcomeImport'],
				operation: ['getStatus', 'getCreatedGroupIds'],
			},
		},
		description: 'The ID of the import, or "latest" for the most recent import of the context',
	},

	// ----------------------------------
	//         outcomeImport: create
	// ----------------------------------
	{
		displayName: 'CSV Data',
		name: 'csvData',
		type: 'string',
		typeOptions: {
			rows: 10,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['outcomeImport'],
				operation: ['create'],
			},
		},
		description:
			'The outcomes and outcome groups to import, as CSV text in the Canvas outcomes format (header row vendor_guid, object_type, title, ...)',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['outcomeImport'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Learning Outcome Group ID',
				name: 'learning_outcome_group_id',
				type: 'string',
				default: '',
				description:
					'The ID of the outcome group of the context to import into. Without it the outcomes go into the root outcome group.',
			},
		],
	},
];
