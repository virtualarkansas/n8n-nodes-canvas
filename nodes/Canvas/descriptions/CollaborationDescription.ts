import type { INodeProperties } from 'n8n-workflow';

export const collaborationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['collaboration'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many collaborations',
				action: 'Get many collaborations',
			},
			{
				name: 'List Members',
				value: 'listMembers',
				description: 'List members of a collaboration',
				action: 'List members of a collaboration',
			},
			{
				name: 'List Potential Members',
				value: 'listPotentialMembers',
				description: 'List potential members for a collaboration',
				action: 'List potential members for a collaboration',
			},
		],
		default: 'getAll',
	},
];

export const collaborationFields: INodeProperties[] = [
	// ----------------------------------
	//         collaboration: getAll, listPotentialMembers
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['collaboration'],
				operation: ['getAll', 'listPotentialMembers'],
			},
		},
		options: [
			{
				name: 'Course',
				value: 'course',
			},
			{
				name: 'Group',
				value: 'group',
			},
		],
		description: 'The context to list collaborations from',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['collaboration'],
				operation: ['getAll', 'listPotentialMembers'],
				context: ['course'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['collaboration'],
				operation: ['getAll', 'listPotentialMembers'],
				context: ['group'],
			},
		},
		description: 'The ID of the group',
	},

	// ----------------------------------
	//         collaboration: listMembers
	// ----------------------------------
	{
		displayName: 'Collaboration ID',
		name: 'collaborationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['collaboration'],
				operation: ['listMembers'],
			},
		},
		description: 'The ID of the collaboration',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['collaboration'],
				operation: ['listMembers'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar Image URL', value: 'avatar_image_url' },
					{ name: 'Collaborator LTI ID', value: 'collaborator_lti_id' },
				],
				default: [],
				description: 'Additional information to include with each member',
			},
		],
	},
];
