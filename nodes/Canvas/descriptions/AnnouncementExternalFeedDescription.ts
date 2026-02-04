import type { INodeProperties } from 'n8n-workflow';

export const announcementExternalFeedOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['announcementExternalFeed'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new external feed',
				action: 'Create an external feed',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an external feed',
				action: 'Delete an external feed',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many external feeds',
				action: 'Get many external feeds',
			},
		],
		default: 'getAll',
	},
];

export const announcementExternalFeedFields: INodeProperties[] = [
	// ----------------------------------
	//         announcementExternalFeed: shared
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		options: [
			{ name: 'Course', value: 'course' },
			{ name: 'Group', value: 'group' },
		],
		displayOptions: {
			show: {
				resource: ['announcementExternalFeed'],
				operation: ['create', 'delete', 'getAll'],
			},
		},
		description: 'Whether this is a course or group external feed',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['announcementExternalFeed'],
				operation: ['create', 'delete', 'getAll'],
				contextType: ['course'],
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
				resource: ['announcementExternalFeed'],
				operation: ['create', 'delete', 'getAll'],
				contextType: ['group'],
			},
		},
		description: 'The ID of the group',
	},

	// ----------------------------------
	//         announcementExternalFeed: delete
	// ----------------------------------
	{
		displayName: 'External Feed ID',
		name: 'externalFeedId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['announcementExternalFeed'],
				operation: ['delete'],
			},
		},
		description: 'The ID of the external feed to delete',
	},

	// ----------------------------------
	//         announcementExternalFeed: create
	// ----------------------------------
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['announcementExternalFeed'],
				operation: ['create'],
			},
		},
		description: 'The URL to the external RSS or Atom feed',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['announcementExternalFeed'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Header Match',
				name: 'header_match',
				type: 'string',
				default: '',
				description: 'Only import entries that contain this text in their title',
			},
			{
				displayName: 'Verbosity',
				name: 'verbosity',
				type: 'options',
				options: [
					{ name: 'Full', value: 'full' },
					{ name: 'Link Only', value: 'link_only' },
					{ name: 'Truncate', value: 'truncate' },
				],
				default: 'full',
				description: 'How much content to import from the feed entries',
			},
		],
	},
];
