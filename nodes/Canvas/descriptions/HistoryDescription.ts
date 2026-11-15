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
				description:
					'Get the pages a user viewed in the Canvas web interface during the last three weeks, newest first (API requests and file downloads are not part of the history). Canvas builds the list by paging through all page views of the user and leaving out what is not history, so pages can be empty: turn on Pagination > Return All for users who also use the API a lot.',
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
			'The ID of the user whose history to retrieve. Use "self" for the token\'s user; other users need permission to read their data.',
	},
];
