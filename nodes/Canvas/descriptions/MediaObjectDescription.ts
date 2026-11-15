import type { INodeProperties } from 'n8n-workflow';

export const mediaObjectOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['mediaObject'],
			},
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many media objects',
				action: 'Get many media objects',
			},
			{
				name: 'List Tracks',
				value: 'listTracks',
				description: 'List the caption/subtitle tracks the user of the credential added to a media object',
				action: 'List media tracks',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Change the title of a media object (only its owner can)',
				action: 'Update a media object',
			},
			{
				name: 'Update Tracks',
				value: 'updateTracks',
				description: 'Replace the caption/subtitle tracks of a media object: tracks that are not listed are deleted',
				action: 'Update media tracks',
			},
		],
		default: 'getAll',
	},
];

export const mediaObjectFields: INodeProperties[] = [
	// ----------------------------------
	//         mediaObject: getAll - context type
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'user',
		displayOptions: {
			show: {
				resource: ['mediaObject'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				name: 'Course',
				value: 'course',
				description: 'Media objects in a course',
			},
			{
				name: 'Group',
				value: 'group',
				description: 'Media objects in a group',
			},
			{
				name: 'User',
				value: 'user',
				description: 'Media objects the user of the credential uploaded to their own files',
			},
		],
		description: 'The context to list media objects from',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['mediaObject'],
				operation: ['getAll'],
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
				resource: ['mediaObject'],
				operation: ['getAll'],
				contextType: ['group'],
			},
		},
		description: 'The ID of the group',
	},

	// ----------------------------------
	//         mediaObject: update
	// ----------------------------------
	{
		displayName: 'Media Object ID',
		name: 'mediaObjectId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['mediaObject'],
				operation: ['update', 'listTracks', 'updateTracks'],
			},
		},
		description: 'The media ID of the media object (the "media_id" of the object, e.g. "m-2pbqZk3RCGMNFs"), not its numeric ID',
	},

	// ----------------------------------
	//         mediaObject: listTracks, updateTracks
	// ----------------------------------
	{
		displayName: 'Tracks',
		name: 'tracks',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Track',
		default: {},
		displayOptions: {
			show: {
				resource: ['mediaObject'],
				operation: ['updateTracks'],
			},
		},
		description: 'The complete set of tracks the media object should have afterwards. Existing tracks in languages that are not listed are deleted.',
		options: [
			{
				name: 'trackValues',
				displayName: 'Track',
				values: [
					{
						displayName: 'Locale',
						name: 'locale',
						type: 'string',
						required: true,
						default: 'en',
						description: 'Language code of the track, e.g. "en", "es" or "fr-CA"',
					},
					{
						displayName: 'Content',
						name: 'content',
						type: 'string',
						typeOptions: {
							rows: 6,
						},
						default: '',
						description: 'The captions in SRT or WebVTT format. Leave empty to keep the existing track of this language unchanged.',
					},
					{
						displayName: 'Kind',
						name: 'kind',
						type: 'options',
						options: [
							{ name: 'Captions', value: 'captions' },
							{ name: 'Chapters', value: 'chapters' },
							{ name: 'Descriptions', value: 'descriptions' },
							{ name: 'Metadata', value: 'metadata' },
							{ name: 'Subtitles', value: 'subtitles' },
						],
						default: 'subtitles',
						description: 'What the track contains',
					},
				],
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['mediaObject'],
				operation: ['listTracks', 'updateTracks'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Content', value: 'content' },
					{ name: 'Created At', value: 'created_at' },
					{ name: 'Updated At', value: 'updated_at' },
					{ name: 'WebVTT Content', value: 'webvtt_content' },
				],
				default: [],
				description: 'Additional fields to return with each track (by default only ID, locale, kind, media object and user)',
			},
		],
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['mediaObject'],
				operation: ['update'],
			},
		},
		description: 'The new title for the media object (shown instead of the original title)',
	},

	// ----------------------------------
	//         mediaObject: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['mediaObject'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Exclude',
				name: 'exclude',
				type: 'multiOptions',
				options: [
					{ name: 'Sources', value: 'sources' },
					{ name: 'Tracks', value: 'tracks' },
				],
				default: [],
				description: 'Leave the media sources and/or caption tracks out of the result. Without them Canvas does not have to ask the media server, which is much faster.',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
				description: 'The sort order',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Created At', value: 'created_at' },
					{ name: 'Title', value: 'title' },
				],
				default: 'title',
				description: 'The field to sort media objects by',
			},
		],
	},
];
