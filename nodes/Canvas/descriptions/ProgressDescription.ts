import type { INodeProperties } from 'n8n-workflow';
import { waitFields } from './shared';

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
					'Cancel an asynchronous job. Canvas marks its progress as failed (an optional message tells a cancellation from a real failure); a job that is already running is not interrupted and may still finish.',
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
					'Get the progress of an LTI Assignment and Grade Services job (a score with file uploads). Needs Authentication > LTI Advantage with the credential of the tool that started it; a personal Canvas API token is rejected with 401.',
				action: 'Get LTI progress',
			},
			{
				name: 'Wait for Completion',
				value: 'waitForCompletion',
				description:
					'Check the job again and again until it is completed or has failed, then output its final state. Check "workflow_state" of the result: a failed job is not an error of this operation.',
				action: 'Wait for a progress to complete',
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
				operation: ['get', 'cancel', 'waitForCompletion'],
			},
		},
		description:
			'The ID of the progress object, or the "progress_url" that operations running in the background (migrations, exports, reports ...) return: the ID is taken from its end',
	},

	...waitFields('progress'),

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
		description: 'The ID of the progress object, or the progress URL the LTI service returned: the ID is taken from its end',
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
