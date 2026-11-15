import type { INodeProperties } from 'n8n-workflow';

export const conferenceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['conference'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a web conference in a course or group and invite all its members',
				action: 'Create a conference',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the conferences of a course or group',
				action: 'Get many conferences',
			},
			{
				name: 'Get Many for User',
				value: 'getAllForUser',
				description: 'Get the conferences the current user is invited to, across courses and groups',
				action: 'Get all conferences for user',
			},
		],
		default: 'getAll',
	},
];

export const conferenceFields: INodeProperties[] = [
	// ----------------------------------
	//         conference: getAll, create
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['conference'],
				operation: ['getAll', 'create'],
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
		description: 'Whether the conference belongs to a course or to a group',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conference'],
				operation: ['getAll', 'create'],
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
				resource: ['conference'],
				operation: ['getAll', 'create'],
				context: ['group'],
			},
		},
		description: 'The ID of the group',
	},

	// ----------------------------------
	//         conference: create
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['conference'],
				operation: ['create'],
			},
		},
		description: 'The title of the conference',
	},
	{
		displayName: 'Conference Type',
		name: 'conferenceType',
		type: 'string',
		required: true,
		default: 'BigBlueButton',
		displayOptions: {
			show: {
				resource: ['conference'],
				operation: ['create'],
			},
		},
		description: 'The conferencing tool, as configured on your Canvas instance. Use the "conference_type" value of an existing conference, e.g. "BigBlueButton".',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['conference'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'A description of the conference',
			},
			{
				displayName: 'Duration',
				name: 'duration',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 60,
				description: 'The planned length of the conference in minutes',
			},
		],
	},

	// ----------------------------------
	//         conference: getAllForUser - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['conference'],
				operation: ['getAllForUser'],
			},
		},
		options: [
			{
				displayName: 'State',
				name: 'state',
				type: 'options',
				options: [
					{ name: 'All', value: '' },
					{ name: 'Live', value: 'live' },
				],
				default: 'live',
				description: 'Whether to return all conferences or only those that have started and not yet ended',
			},
		],
	},
];
