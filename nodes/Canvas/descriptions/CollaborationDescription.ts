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
				name: 'Delete',
				value: 'delete',
				description: 'Delete a collaboration of a course or group',
				action: 'Delete a collaboration',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the collaborations of a course or group that were created with an external (LTI) tool',
				action: 'Get many collaborations',
			},
			{
				name: 'List Members',
				value: 'listMembers',
				description: 'List the users and groups a collaboration is shared with',
				action: 'List members of a collaboration',
			},
			{
				name: 'List Potential Members',
				value: 'listPotentialMembers',
				description: 'List the users who could be added to a collaboration in a course or group',
				action: 'List potential members for a collaboration',
			},
		],
		default: 'getAll',
	},
];

export const collaborationFields: INodeProperties[] = [
	// ----------------------------------
	//         collaboration: getAll, listPotentialMembers, delete
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
				operation: ['getAll', 'listPotentialMembers', 'delete'],
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
		description: 'Whether the collaboration belongs to a course or to a group',
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
				operation: ['getAll', 'listPotentialMembers', 'delete'],
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
				operation: ['getAll', 'listPotentialMembers', 'delete'],
				context: ['group'],
			},
		},
		description: 'The ID of the group',
	},

	// ----------------------------------
	//         collaboration: listMembers, delete
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
				operation: ['listMembers', 'delete'],
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
