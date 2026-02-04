import type { INodeProperties } from 'n8n-workflow';

export const assignmentExtensionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['assignmentExtension'],
			},
		},
		options: [
			{
				name: 'Set Extensions',
				value: 'setExtensions',
				description: 'Set extensions for student assignment submissions',
				action: 'Set extensions for student submissions',
			},
		],
		default: 'setExtensions',
	},
];

export const assignmentExtensionFields: INodeProperties[] = [
	// ----------------------------------
	//         assignmentExtension: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignmentExtension'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Assignment ID',
		name: 'assignmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['assignmentExtension'],
			},
		},
		description: 'The ID of the assignment',
	},

	// ----------------------------------
	//         assignmentExtension: setExtensions
	// ----------------------------------
	{
		displayName: 'Extensions',
		name: 'extensions',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Extension',
		default: {},
		displayOptions: {
			show: {
				resource: ['assignmentExtension'],
				operation: ['setExtensions'],
			},
		},
		description: 'The extensions to set for students',
		options: [
			{
				name: 'extensionValues',
				displayName: 'Extension',
				values: [
					{
						displayName: 'User ID',
						name: 'user_id',
						type: 'string',
						required: true,
						default: '',
						description: 'The ID of the student receiving the extension',
					},
					{
						displayName: 'Extra Attempts',
						name: 'extra_attempts',
						type: 'number',
						required: true,
						default: 1,
						description: 'The number of additional re-submission attempts allowed',
					},
				],
			},
		],
	},
];
