import type { INodeProperties } from 'n8n-workflow';

export const calendarEventOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['calendarEvent'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a calendar event',
				action: 'Create a calendar event',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a calendar event',
				action: 'Delete a calendar event',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single calendar event',
				action: 'Get a calendar event',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many calendar events',
				action: 'Get many calendar events',
			},
			{
				name: 'Reserve Time Slot',
				value: 'reserveTimeSlot',
				description: 'Reserve a time slot in an appointment group',
				action: 'Reserve a time slot',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a calendar event',
				action: 'Update a calendar event',
			},
		],
		default: 'getAll',
	},
];

export const calendarEventFields: INodeProperties[] = [
	// ----------------------------------
	//         calendarEvent: shared
	// ----------------------------------
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['calendarEvent'],
				operation: ['get', 'update', 'delete', 'reserveTimeSlot'],
			},
		},
		description: 'The ID of the calendar event',
	},

	// ----------------------------------
	//         calendarEvent: create
	// ----------------------------------
	{
		displayName: 'Context Code',
		name: 'contextCode',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['calendarEvent'],
				operation: ['create'],
			},
		},
		description: 'Context code of the course, group, user, or account (e.g., "course_123", "user_456")',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['calendarEvent'],
				operation: ['create'],
			},
		},
		description: 'The title of the calendar event',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['calendarEvent'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'All Day',
				name: 'all_day',
				type: 'boolean',
				default: false,
				description: 'Whether the event spans the entire day',
			},
			{
				displayName: 'Blackout Date',
				name: 'blackout_date',
				type: 'boolean',
				default: false,
				description: 'Whether this is a blackout date (holiday or special day)',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The description of the event (supports HTML)',
			},
			{
				displayName: 'Duplicate Append Iterator',
				name: 'duplicate_append_iterator',
				type: 'boolean',
				default: false,
				description: 'Whether to add a number to the title of each duplicate',
			},
			{
				displayName: 'Duplicate Count',
				name: 'duplicate_count',
				type: 'number',
				default: 1,
				description: 'Number of duplicates to create (max 200)',
			},
			{
				displayName: 'Duplicate Frequency',
				name: 'duplicate_frequency',
				type: 'options',
				options: [
					{ name: 'Daily', value: 'daily' },
					{ name: 'Monthly', value: 'monthly' },
					{ name: 'Weekly', value: 'weekly' },
				],
				default: 'weekly',
				description: 'Frequency for duplicating the event',
			},
			{
				displayName: 'Duplicate Interval',
				name: 'duplicate_interval',
				type: 'number',
				default: 1,
				description: 'Interval between duplicates',
			},
			{
				displayName: 'End At',
				name: 'end_at',
				type: 'dateTime',
				default: '',
				description: 'End date/time in ISO 8601 format',
			},
			{
				displayName: 'Location Address',
				name: 'location_address',
				type: 'string',
				default: '',
				description: 'The physical address of the event location',
			},
			{
				displayName: 'Location Name',
				name: 'location_name',
				type: 'string',
				default: '',
				description: 'The name of the event location',
			},
			{
				displayName: 'RRule',
				name: 'rrule',
				type: 'string',
				default: '',
				description: 'Recurrence rule in iCalendar RRULE format',
			},
			{
				displayName: 'Start At',
				name: 'start_at',
				type: 'dateTime',
				default: '',
				description: 'Start date/time in ISO 8601 format',
			},
			{
				displayName: 'Time Zone',
				name: 'time_zone_edited',
				type: 'string',
				default: '',
				description: 'Time zone in IANA or Rails format (e.g., "America/New_York")',
			},
		],
	},

	// ----------------------------------
	//         calendarEvent: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['calendarEvent'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'All Day',
				name: 'all_day',
				type: 'boolean',
				default: false,
				description: 'Whether the event spans the entire day',
			},
			{
				displayName: 'Blackout Date',
				name: 'blackout_date',
				type: 'boolean',
				default: false,
				description: 'Whether this is a blackout date (holiday or special day)',
			},
			{
				displayName: 'Context Code',
				name: 'context_code',
				type: 'string',
				default: '',
				description: 'Context code of the course, group, user, or account',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The description of the event (supports HTML)',
			},
			{
				displayName: 'End At',
				name: 'end_at',
				type: 'dateTime',
				default: '',
				description: 'End date/time in ISO 8601 format',
			},
			{
				displayName: 'Location Address',
				name: 'location_address',
				type: 'string',
				default: '',
				description: 'The physical address of the event location',
			},
			{
				displayName: 'Location Name',
				name: 'location_name',
				type: 'string',
				default: '',
				description: 'The name of the event location',
			},
			{
				displayName: 'Start At',
				name: 'start_at',
				type: 'dateTime',
				default: '',
				description: 'Start date/time in ISO 8601 format',
			},
			{
				displayName: 'Time Zone',
				name: 'time_zone_edited',
				type: 'string',
				default: '',
				description: 'Time zone in IANA or Rails format (e.g., "America/New_York")',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the calendar event',
			},
			{
				displayName: 'Which',
				name: 'which',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Following', value: 'following' },
					{ name: 'One', value: 'one' },
				],
				default: 'one',
				description: 'Which events in a series to update',
			},
		],
	},

	// ----------------------------------
	//         calendarEvent: delete
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['calendarEvent'],
				operation: ['delete'],
			},
		},
		options: [
			{
				displayName: 'Cancel Reason',
				name: 'cancel_reason',
				type: 'string',
				default: '',
				description: 'Reason for canceling/deleting the event',
			},
			{
				displayName: 'Which',
				name: 'which',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Following', value: 'following' },
					{ name: 'One', value: 'one' },
				],
				default: 'one',
				description: 'Which events in a series to delete',
			},
		],
	},

	// ----------------------------------
	//         calendarEvent: getAll
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['calendarEvent'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'All Events',
				name: 'all_events',
				type: 'boolean',
				default: false,
				description: 'Whether to retrieve all events, ignoring date filters',
			},
			{
				displayName: 'Blackout Date',
				name: 'blackout_date',
				type: 'boolean',
				default: false,
				description: 'Whether to filter for blackout dates only',
			},
			{
				displayName: 'Context Codes',
				name: 'context_codes',
				type: 'string',
				default: '',
				description: 'Comma-separated context codes to filter by (e.g., "course_123,user_456"). Limited to 10.',
			},
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				description: 'End date for filtering events',
			},
			{
				displayName: 'Excludes',
				name: 'excludes',
				type: 'multiOptions',
				options: [
					{ name: 'Assignment', value: 'assignment' },
					{ name: 'Child Events', value: 'child_events' },
					{ name: 'Description', value: 'description' },
				],
				default: [],
				description: 'Data to exclude from the response',
			},
			{
				displayName: 'Important Dates',
				name: 'important_dates',
				type: 'boolean',
				default: false,
				description: 'Whether to filter for important dates only',
			},
			{
				displayName: 'Include',
				name: 'includes',
				type: 'multiOptions',
				options: [
					{ name: 'Series Natural Language', value: 'series_natural_language' },
					{ name: 'Web Conference', value: 'web_conference' },
				],
				default: [],
				description: 'Additional data to include in the response',
			},
			{
				displayName: 'Start Date',
				name: 'start_date',
				type: 'dateTime',
				default: '',
				description: 'Start date for filtering events',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: [
					{ name: 'Assignment', value: 'assignment' },
					{ name: 'Event', value: 'event' },
					{ name: 'Sub Assignment', value: 'sub_assignment' },
				],
				default: 'event',
				description: 'Type of calendar events to return',
			},
			{
				displayName: 'Undated',
				name: 'undated',
				type: 'boolean',
				default: false,
				description: 'Whether to return only undated events',
			},
			{
				displayName: 'User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description: 'Filter events for a specific user',
			},
		],
	},

	// ----------------------------------
	//         calendarEvent: reserveTimeSlot
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['calendarEvent'],
				operation: ['reserveTimeSlot'],
			},
		},
		options: [
			{
				displayName: 'Cancel Existing',
				name: 'cancel_existing',
				type: 'boolean',
				default: false,
				description: 'Whether to cancel any previous reservations',
			},
			{
				displayName: 'Comments',
				name: 'comments',
				type: 'string',
				default: '',
				description: 'Comments or notes for the reservation',
			},
			{
				displayName: 'Participant ID',
				name: 'participant_id',
				type: 'string',
				default: '',
				description: 'User or group ID to reserve for (defaults to current user)',
			},
		],
	},
];
