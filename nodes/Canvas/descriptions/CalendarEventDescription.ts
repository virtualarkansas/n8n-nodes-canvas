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
				description: 'Create a calendar event, optionally repeated or as a recurring series',
				action: 'Create a calendar event',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a calendar event, a whole series, or cancel a reservation',
				action: 'Delete a calendar event',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single calendar event or assignment',
				action: 'Get a calendar event',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the calendar events or assignments of the current user or of another user',
				action: 'Get many calendar events',
			},
			{
				name: 'Reserve Time Slot',
				value: 'reserveTimeSlot',
				description: 'Reserve a time slot of an appointment group',
				action: 'Reserve a time slot',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a calendar event or the events of a series',
				action: 'Update a calendar event',
			},
		],
		default: 'getAll',
	},
];

/** Fields shared by the create and update collections. */
const sectionTimes: INodeProperties = {
	displayName: 'Section Times',
	name: 'child_event_data',
	type: 'fixedCollection',
	typeOptions: {
		multipleValues: true,
	},
	placeholder: 'Add Section Time',
	default: {},
	description: 'For course events: a separate start and end time for individual sections. On update the list replaces the existing section times.',
	options: [
		{
			name: 'times',
			displayName: 'Section Time',
			values: [
				{
					displayName: 'Section Context Code',
					name: 'context_code',
					type: 'string',
					default: '',
					placeholder: 'course_section_123',
					description: 'Context code of a section of the course',
				},
				{
					displayName: 'Start At',
					name: 'start_at',
					type: 'dateTime',
					default: '',
					description: 'Start of the event for this section',
				},
				{
					displayName: 'End At',
					name: 'end_at',
					type: 'dateTime',
					default: '',
					description: 'End of the event for this section',
				},
			],
		},
	],
};

const submissionTypeOptions = [
	{ name: 'Discussion Topic', value: 'discussion_topic' },
	{ name: 'External Tool', value: 'external_tool' },
	{ name: 'Media Recording', value: 'media_recording' },
	{ name: 'None', value: 'none' },
	{ name: 'Not Graded', value: 'not_graded' },
	{ name: 'On Paper', value: 'on_paper' },
	{ name: 'Online Quiz', value: 'online_quiz' },
	{ name: 'Online Text Entry', value: 'online_text_entry' },
	{ name: 'Online Upload', value: 'online_upload' },
	{ name: 'Online URL', value: 'online_url' },
	{ name: 'Student Annotation', value: 'student_annotation' },
	{ name: 'Wiki Page', value: 'wiki_page' },
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
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the calendar event. Get and Update also accept an assignment as "assignment_123".',
	},
	{
		displayName: 'Time Slot ID',
		name: 'eventId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['calendarEvent'],
				operation: ['reserveTimeSlot'],
			},
		},
		description: 'The ID of the time slot: a calendar event of an appointment group (see Appointment Group > Get, field "appointments")',
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
		placeholder: 'course_123',
		displayOptions: {
			show: {
				resource: ['calendarEvent'],
				operation: ['create'],
			},
		},
		description: 'The calendar the event is added to: "course_123", "group_456", "user_789" or "account_1"',
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
				description: 'Whether the event spans the whole day (the times of Start At and End At are ignored)',
			},
			{
				displayName: 'Blackout Date',
				name: 'blackout_date',
				type: 'boolean',
				default: false,
				description: 'Whether the event is a holiday or other day that does not count in course pacing',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The description of the event (HTML)',
			},
			{
				displayName: 'Duplicate Append Iterator',
				name: 'duplicate_append_iterator',
				type: 'boolean',
				default: false,
				description: 'Whether to number the titles of the event and its copies ("Title 1", "Title 2", ...)',
			},
			{
				displayName: 'Duplicate Count',
				name: 'duplicate_count',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 200,
				},
				default: 1,
				description: 'Number of additional copies of the event to create (up to 200). The copies are independent events, returned in the "duplicates" field. Use RRule instead for a series that can be edited as a whole.',
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
				description: 'The unit of the distance between copies (used with Duplicate Count)',
			},
			{
				displayName: 'Duplicate Interval',
				name: 'duplicate_interval',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'Distance between copies in units of Duplicate Frequency (used with Duplicate Count)',
			},
			{
				displayName: 'End At',
				name: 'end_at',
				type: 'dateTime',
				default: '',
				description: 'End date and time of the event',
			},
			{
				displayName: 'Important Dates',
				name: 'important_dates',
				type: 'boolean',
				default: false,
				description: 'Whether the event is shown in the "Important Dates" lists (Canvas for Elementary)',
			},
			{
				displayName: 'Location Address',
				name: 'location_address',
				type: 'string',
				default: '',
				description: 'The address of the event location',
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
				placeholder: 'FREQ=WEEKLY;INTERVAL=1;COUNT=10',
				description: 'Recurrence rule in iCalendar format that turns the event into a series (needs Start At). The series must end: give COUNT or UNTIL.',
			},
			sectionTimes,
			{
				displayName: 'Start At',
				name: 'start_at',
				type: 'dateTime',
				default: '',
				description: 'Start date and time of the event',
			},
			{
				displayName: 'Time Zone',
				name: 'time_zone_edited',
				type: 'string',
				default: '',
				placeholder: 'America/New_York',
				description: 'Time zone the event was entered in (IANA or Rails name). Used to place all-day events and series correctly.',
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
				description: 'Whether the event spans the whole day (the times of Start At and End At are ignored)',
			},
			{
				displayName: 'Blackout Date',
				name: 'blackout_date',
				type: 'boolean',
				default: false,
				description: 'Whether the event is a holiday or other day that does not count in course pacing',
			},
			{
				displayName: 'Context Code',
				name: 'context_code',
				type: 'string',
				default: '',
				placeholder: 'course_123',
				description: 'Move the event to another calendar: "course_123", "group_456", "user_789" or "account_1"',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The description of the event (HTML)',
			},
			{
				displayName: 'End At',
				name: 'end_at',
				type: 'dateTime',
				default: '',
				description: 'End date and time of the event',
			},
			{
				displayName: 'Important Dates',
				name: 'important_dates',
				type: 'boolean',
				default: false,
				description: 'Whether the event is shown in the "Important Dates" lists (Canvas for Elementary)',
			},
			{
				displayName: 'Location Address',
				name: 'location_address',
				type: 'string',
				default: '',
				description: 'The address of the event location',
			},
			{
				displayName: 'Location Name',
				name: 'location_name',
				type: 'string',
				default: '',
				description: 'The name of the event location',
			},
			{
				displayName: 'Remove Section Times',
				name: 'remove_child_events',
				type: 'boolean',
				default: false,
				description: 'Whether to remove all section-specific times from the event',
			},
			{
				displayName: 'RRule',
				name: 'rrule',
				type: 'string',
				default: '',
				placeholder: 'FREQ=WEEKLY;INTERVAL=1;COUNT=10',
				description: 'Recurrence rule in iCalendar format. Turns a single event into a series, or changes the rule of a series (together with Which).',
			},
			sectionTimes,
			{
				displayName: 'Start At',
				name: 'start_at',
				type: 'dateTime',
				default: '',
				description: 'Start date and time of the event. For an assignment this changes its due date.',
			},
			{
				displayName: 'Time Zone',
				name: 'time_zone_edited',
				type: 'string',
				default: '',
				placeholder: 'America/New_York',
				description: 'Time zone the event was entered in (IANA or Rails name)',
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
					{ name: 'All', value: 'all', description: 'Every event of the series' },
					{ name: 'Following', value: 'following', description: 'This event and all later ones' },
					{ name: 'One', value: 'one', description: 'Only this event' },
				],
				default: 'one',
				description: 'For an event of a series: which events to change. With All or Following the node outputs one item per changed event.',
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
				description: 'Reason for deleting the event or canceling the reservation (included in the notification to participants)',
			},
			{
				displayName: 'Which',
				name: 'which',
				type: 'options',
				options: [
					{ name: 'All', value: 'all', description: 'Every event of the series' },
					{ name: 'Following', value: 'following', description: 'This event and all later ones' },
					{ name: 'One', value: 'one', description: 'Only this event' },
				],
				default: 'one',
				description: 'For an event of a series: which events to delete. With All or Following the node outputs one item per event; after Following these include the events that remain (Canvas shortens their recurrence rule), so check "workflow_state".',
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
				description: 'Whether to return all events regardless of date (Start Date, End Date and Undated are ignored). Without this and without dates Canvas only returns today\'s events.',
			},
			{
				displayName: 'Blackout Date',
				name: 'blackout_date',
				type: 'boolean',
				default: false,
				description: 'Whether to return only events marked as blackout dates',
			},
			{
				displayName: 'Context Codes',
				name: 'context_codes',
				type: 'string',
				default: '',
				placeholder: 'course_123, group_456',
				description: 'Comma-separated calendars to read: "course_123", "group_456", "user_789", "account_1" (Canvas uses at most 10). Without it only the personal calendar of the user is read.',
			},
			{
				displayName: 'End Date',
				name: 'end_date',
				type: 'dateTime',
				default: '',
				description: 'Only return events up to this date (inclusive). Defaults to the start date.',
			},
			{
				displayName: 'Exclude Submission Types',
				name: 'exclude_submission_types',
				type: 'multiOptions',
				options: submissionTypeOptions,
				default: [],
				description: 'For Type "Assignment": leave out assignments with these submission types',
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
				description: 'Attributes to leave out of the response',
			},
			{
				displayName: 'Important Dates',
				name: 'important_dates',
				type: 'boolean',
				default: false,
				description: 'Whether to return only events marked as important dates',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Series Natural Language', value: 'series_natural_language' },
					{ name: 'Web Conference', value: 'web_conference' },
				],
				default: [],
				description: 'Additional information to include: the recurrence rule of a series in words, the web conference attached to an event',
			},
			{
				displayName: 'Start Date',
				name: 'start_date',
				type: 'dateTime',
				default: '',
				description: 'Only return events from this date on (inclusive). Defaults to today.',
			},
			{
				displayName: 'Submission Types',
				name: 'submission_types',
				type: 'multiOptions',
				options: submissionTypeOptions,
				default: [],
				description: 'For Type "Assignment": only return assignments with these submission types',
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
				description: 'Whether to return calendar events, assignments or sub assignments (checkpoints)',
			},
			{
				displayName: 'Undated',
				name: 'undated',
				type: 'boolean',
				default: false,
				description: 'Whether to return only events without a date (Start Date and End Date are ignored)',
			},
			{
				displayName: 'User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description: 'Read the calendar of this user instead of the user of the access token (for admins and for observers of the user)',
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
				description: 'Whether to cancel earlier reservations of the participant in this appointment group',
			},
			{
				displayName: 'Comments',
				name: 'comments',
				type: 'string',
				default: '',
				description: 'Comments to store with the reservation (up to 255 characters)',
			},
			{
				displayName: 'Participant ID',
				name: 'participant_id',
				type: 'string',
				default: '',
				description: 'The user (or, for group sign-up, the group) to reserve for. Defaults to the user of the access token; reserving for someone else requires managing the appointment group.',
			},
		],
	},
];
