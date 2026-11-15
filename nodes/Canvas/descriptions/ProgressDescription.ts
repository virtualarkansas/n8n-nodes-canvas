import type { INodeProperties } from 'n8n-workflow';

export const progressOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['progress'],
			},
		},
		options: [
			{
				name: 'Cancel',
				value: 'cancel',
				description:
					'Cancel an asynchronous job. Canvas marks it as failed; an optional message tells a cancellation from a real failure.',
				action: 'Cancel a progress',
			},
			{
				name: 'Get',
				value: 'get',
				description:
					'Get completion and status of an asynchronous job (content migration or export, SIS import, bulk update, ...)',
				action: 'Get a progress',
			},
			{
				name: 'Get LTI',
				value: 'getLti',
				description:
					'Get the progress of an LTI Assignment and Grade Services job (a score with file uploads). Needs an LTI Advantage access token of the tool that started it; a personal Canvas API token is rejected with 401.',
				action: 'Get LTI progress',
			},
		],
		default: 'get',
	},
];

export const progressFields: INodeProperties[] = [
	// ----------------------------------
	//         progress: get
	// ----------------------------------
	{
		displayName: 'Progress ID',
		name: 'progressId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['progress'],
				operation: ['get', 'cancel'],
			},
		},
		description:
			'The ID of the progress object. Canvas returns it (or a "progress_url" ending in it) from operations that run in the background.',
	},

	// ----------------------------------
	//         progress: getLti
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['progress'],
				operation: ['getLti'],
			},
		},
		description: 'The numeric ID of the course the tool is installed in',
	},
	{
		displayName: 'Progress ID',
		name: 'progressId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['progress'],
				operation: ['getLti'],
			},
		},
		description: 'The ID of the progress object',
	},

	// ----------------------------------
	//         progress: cancel options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['progress'],
				operation: ['cancel'],
			},
		},
		options: [
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				default: '',
				description:
					'Custom message to set on the Progress record to distinguish cancellation from failure',
			},
		],
	},
];
