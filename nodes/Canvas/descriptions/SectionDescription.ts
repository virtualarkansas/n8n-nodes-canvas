import type { INodeProperties } from 'n8n-workflow';

export const sectionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['section'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new section',
				action: 'Create a section',
			},
			{
				name: 'Crosslist',
				value: 'crosslist',
				description: 'Crosslist a section to another course',
				action: 'Crosslist a section',
			},
			{
				name: 'De-Crosslist',
				value: 'decrosslist',
				description: 'Remove a section from crosslisting',
				action: 'Remove section from crosslist',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a section',
				action: 'Delete a section',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single section',
				action: 'Get a section',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many sections',
				action: 'Get many sections',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a section',
				action: 'Update a section',
			},
		],
		default: 'getAll',
	},
];

export const sectionFields: INodeProperties[] = [
	// ----------------------------------
	//         section: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['section'],
				operation: ['create', 'getAll'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Section ID',
		name: 'sectionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['section'],
				operation: ['get', 'update', 'delete', 'crosslist', 'decrosslist'],
			},
		},
		description: 'The ID of the section',
	},

	// ----------------------------------
	//         section: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['section'],
				operation: ['create'],
			},
		},
		description: 'The name of the section',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['section'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Enable SIS Reactivation',
				name: 'enable_sis_reactivation',
				type: 'boolean',
				default: false,
				description: 'Whether to reactivate a deleted section with matching SIS ID',
			},
			{
				displayName: 'End At',
				name: 'end_at',
				type: 'dateTime',
				default: '',
				description: 'Section end date in ISO 8601 format',
			},
			{
				displayName: 'Integration ID',
				name: 'integration_id',
				type: 'string',
				default: '',
				description: 'The integration ID for the section',
			},
			{
				displayName: 'Restrict Enrollments to Section Dates',
				name: 'restrict_enrollments_to_section_dates',
				type: 'boolean',
				default: false,
				description: 'Whether students can only access during section dates',
			},
			{
				displayName: 'SIS Section ID',
				name: 'sis_section_id',
				type: 'string',
				default: '',
				description: 'The SIS ID for the section',
			},
			{
				displayName: 'Start At',
				name: 'start_at',
				type: 'dateTime',
				default: '',
				description: 'Section start date in ISO 8601 format',
			},
		],
	},

	// ----------------------------------
	//         section: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['section'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'End At',
				name: 'end_at',
				type: 'dateTime',
				default: '',
				description: 'Section end date in ISO 8601 format',
			},
			{
				displayName: 'Integration ID',
				name: 'integration_id',
				type: 'string',
				default: '',
				description: 'The integration ID for the section',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the section',
			},
			{
				displayName: 'Override SIS Stickiness',
				name: 'override_sis_stickiness',
				type: 'boolean',
				default: false,
				description: 'Whether to override SIS stickiness for the update',
			},
			{
				displayName: 'Restrict Enrollments to Section Dates',
				name: 'restrict_enrollments_to_section_dates',
				type: 'boolean',
				default: false,
				description: 'Whether students can only access during section dates',
			},
			{
				displayName: 'SIS Section ID',
				name: 'sis_section_id',
				type: 'string',
				default: '',
				description: 'The SIS ID for the section',
			},
			{
				displayName: 'Start At',
				name: 'start_at',
				type: 'dateTime',
				default: '',
				description: 'Section start date in ISO 8601 format',
			},
		],
	},

	// ----------------------------------
	//         section: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['section'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar URL', value: 'avatar_url' },
					{ name: 'Enrollments', value: 'enrollments' },
					{ name: 'Passback Status', value: 'passback_status' },
					{ name: 'Permissions', value: 'permissions' },
					{ name: 'Students', value: 'students' },
					{ name: 'Total Students', value: 'total_students' },
				],
				default: [],
				description: 'Additional information to include with each section',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description: 'Filter sections by name (minimum 2 characters)',
			},
		],
	},

	// ----------------------------------
	//         section: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['section'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar URL', value: 'avatar_url' },
					{ name: 'Enrollments', value: 'enrollments' },
					{ name: 'Passback Status', value: 'passback_status' },
					{ name: 'Permissions', value: 'permissions' },
					{ name: 'Students', value: 'students' },
					{ name: 'Total Students', value: 'total_students' },
				],
				default: [],
				description: 'Additional information to include with the section',
			},
		],
	},

	// ----------------------------------
	//         section: crosslist
	// ----------------------------------
	{
		displayName: 'New Course ID',
		name: 'newCourseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['section'],
				operation: ['crosslist'],
			},
		},
		description: 'The ID of the course to crosslist the section to',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['section'],
				operation: ['crosslist'],
			},
		},
		options: [
			{
				displayName: 'Override SIS Stickiness',
				name: 'override_sis_stickiness',
				type: 'boolean',
				default: true,
				description: 'Whether to override SIS stickiness for the crosslist operation',
			},
		],
	},

	// ----------------------------------
	//         section: decrosslist - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['section'],
				operation: ['decrosslist'],
			},
		},
		options: [
			{
				displayName: 'Override SIS Stickiness',
				name: 'override_sis_stickiness',
				type: 'boolean',
				default: true,
				description: 'Whether to override SIS stickiness for the de-crosslist operation',
			},
		],
	},
];
