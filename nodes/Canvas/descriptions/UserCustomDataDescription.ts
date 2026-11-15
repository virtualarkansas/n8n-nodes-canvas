import type { INodeProperties } from 'n8n-workflow';

export const userCustomDataOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['userCustomData'],
			},
		},
		options: [
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete custom data of a user and return what was deleted',
				action: 'Delete custom data of a user',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Load custom data stored for a user',
				action: 'Get custom data of a user',
			},
			{
				name: 'Set',
				value: 'set',
				description: 'Store arbitrary JSON data for a user',
				action: 'Set custom data of a user',
			},
		],
		default: 'get',
	},
];

export const userCustomDataFields: INodeProperties[] = [
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['userCustomData'],
			},
		},
		description:
			'The ID of the user. "self" selects the current user; SIS IDs work in the form "sis_user_id:ABC". Reading or changing the data of another user needs permission to manage users.',
	},
	{
		displayName: 'Namespace',
		name: 'namespace',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'com.my-organization.canvas-app',
		displayOptions: {
			show: {
				resource: ['userCustomData'],
			},
		},
		description:
			'The namespace the data is stored under. Keeps the data of different applications apart; use something other applications are unlikely to use, such as a reversed domain name.',
	},
	{
		displayName: 'Data (JSON)',
		name: 'data',
		type: 'json',
		required: true,
		default: '',
		placeholder: '{ "favorites": { "dessert": "pistachio ice cream" } }',
		displayOptions: {
			show: {
				resource: ['userCustomData'],
				operation: ['set'],
			},
		},
		description:
			'The data to store, as JSON: an object, a list, a number, true/false or text in double quotes. The keys of nested objects become scopes that can be read on their own. A value from an expression must be given as JSON text (wrap it in JSON.stringify). Canvas drops null entries from lists.',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['userCustomData'],
			},
		},
		options: [
			{
				displayName: 'Scope',
				name: 'scope',
				type: 'string',
				default: '',
				placeholder: 'favorites/dessert',
				description:
					'Path to a part of the data: the keys of nested objects, separated by slashes. Without a scope the operation applies to everything in the namespace: Get returns it all, Set replaces it all, Delete deletes it all.',
			},
		],
	},
];
