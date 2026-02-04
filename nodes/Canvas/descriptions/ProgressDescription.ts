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
				description: 'Cancel an asynchronous job',
				action: 'Cancel a progress',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get completion and status information about an async job',
				action: 'Get a progress',
			},
			{
				name: 'Get LTI',
				value: 'getLti',
				description: 'Get progress information for an LTI job in a course context',
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
		description: 'The ID of the progress object',
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
		description: 'The ID of the course',
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
