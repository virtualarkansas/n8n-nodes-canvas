import type { INodeProperties } from 'n8n-workflow';

export const historyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['history'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get recent browsing history for a user',
				action: 'Get many history entries',
			},
		],
		default: 'getAll',
	},
];

export const historyFields: INodeProperties[] = [
	// ----------------------------------
	//         history: getAll
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: 'self',
		displayOptions: {
			show: {
				resource: ['history'],
				operation: ['getAll'],
			},
		},
		description:
			'The ID of the user whose history to retrieve. Use "self" for the current user.',
	},
];
