import type { INodeProperties } from 'n8n-workflow';

export const appointmentGroupOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['appointmentGroup'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create an appointment group with its time slots',
				action: 'Create an appointment group',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an appointment group with its time slots and reservations',
				action: 'Delete an appointment group',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single appointment group with its time slots',
				action: 'Get an appointment group',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the appointment groups the current user can sign up for or manage',
				action: 'Get many appointment groups',
			},
			{
				name: 'Get Next Appointment',
				value: 'getNextAppointment',
				description: 'Get the next time slot the current user can sign up for',
				action: 'Get next available appointment',
			},
			{
				name: 'List Group Participants',
				value: 'listGroupParticipants',
				description: 'List the student groups that can or did sign up (group sign-up only)',
				action: 'List group participants',
			},
			{
				name: 'List User Participants',
				value: 'listUserParticipants',
				description: 'List the users that can or did sign up (individual sign-up only)',
				action: 'List user participants',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an appointment group, add time slots or publish it',
				action: 'Update an appointment group',
			},
		],
		default: 'getAll',
	},
];

/** Fields that exist on both create and update. */
const commonFields: INodeProperties[] = [
	{
		displayName: 'Allow Observer Signup',
		name: 'allow_observer_signup',
		type: 'boolean',
		default: false,
		description: 'Whether observers may sign up. Canvas refuses this (403) unless observer sign-up is enabled for the account of the course: the account setting and the Canvas feature option for observer appointment sign-up.',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		default: '',
		description: 'Longer description of the appointment group',
	},
	{
		displayName: 'Location Address',
		name: 'location_address',
		type: 'string',
		default: '',
		description: 'The address of the appointment location',
	},
	{
		displayName: 'Location Name',
		name: 'location_name',
		type: 'string',
		default: '',
		description: 'The name of the appointment location',
	},
	{
		displayName: 'Max Appointments Per Participant',
		name: 'max_appointments_per_participant',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 1,
		description: 'Maximum number of time slots a participant may reserve (no limit when not set)',
	},
	{
		displayName: 'Min Appointments Per Participant',
		name: 'min_appointments_per_participant',
		type: 'number',
		typeOptions: {
			minValue: 0,
		},
		default: 1,
		description: 'Minimum number of time slots a participant has to reserve',
	},
	{
		displayName: 'Participant Visibility',
		name: 'participant_visibility',
		type: 'options',
		options: [
			{
				name: 'Private',
				value: 'private',
				description: 'Participants cannot see who signed up for a time slot',
			},
			{
				name: 'Protected',
				value: 'protected',
				description: 'Participants can see who signed up',
			},
		],
		default: 'private',
		description: 'Whether participants can see who else signed up',
	},
	{
		displayName: 'Participants Per Appointment',
		name: 'participants_per_appointment',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 1,
		description: 'Maximum number of participants per time slot (no limit when not set)',
	},
	{
		displayName: 'Publish',
		name: 'publish',
		type: 'boolean',
		default: false,
		description: 'Whether to make the appointment group available for sign-up. A published appointment group cannot be unpublished.',
	},
	{
		displayName: 'Sub Context Codes',
		name: 'sub_context_codes',
		type: 'string',
		default: '',
		placeholder: 'course_section_123',
		description:
			'Comma-separated sections ("course_section_123") to limit the appointment group to, or a single group category ("group_category_45") to let students sign up as groups. On Update, Canvas only takes sections of courses added in the same request (Context Codes) and ignores the others: the sections of a course already in the group cannot be changed.',
	},
	{
		displayName: 'Time Slots',
		name: 'new_appointments',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Time Slot',
		default: {},
		description: 'Time slots to add. Slots must not overlap. On update they are added to the existing ones.',
		options: [
			{
				name: 'slots',
				displayName: 'Time Slot',
				values: [
					{
						displayName: 'Start At',
						name: 'start_at',
						type: 'dateTime',
						default: '',
						description: 'Start of the time slot',
					},
					{
						displayName: 'End At',
						name: 'end_at',
						type: 'dateTime',
						default: '',
						description: 'End of the time slot',
					},
				],
			},
		],
	},
];

/** Update offers the same fields plus the two that are required on create (kept in alphabetical order). */
const updateOnlyFields: INodeProperties[] = [
	{
		displayName: 'Context Codes',
		name: 'context_codes',
		type: 'string',
		default: '',
		placeholder: 'course_123, course_456',
		description: 'Comma-separated context codes of courses to add. Courses can only be added, not removed.',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		description: 'The title of the appointment group',
	},
];
const updateFields: INodeProperties[] = [...commonFields, ...updateOnlyFields].sort((a, b) =>
	a.displayName.localeCompare(b.displayName),
);

export const appointmentGroupFields: INodeProperties[] = [
	// ----------------------------------
	//         appointmentGroup: shared
	// ----------------------------------
	{
		displayName: 'Appointment Group ID',
		name: 'appointmentGroupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['appointmentGroup'],
				operation: ['get', 'update', 'delete', 'listUserParticipants', 'listGroupParticipants'],
			},
		},
		description: 'The ID of the appointment group',
	},

	// ----------------------------------
	//         appointmentGroup: create
	// ----------------------------------
	{
		displayName: 'Context Codes',
		name: 'contextCodes',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'course_123',
		displayOptions: {
			show: {
				resource: ['appointmentGroup'],
				operation: ['create'],
			},
		},
		description: 'Comma-separated context codes of the courses whose members can sign up (e.g. "course_123, course_456")',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['appointmentGroup'],
				operation: ['create'],
			},
		},
		description: 'The title of the appointment group',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['appointmentGroup'],
				operation: ['create'],
			},
		},
		options: commonFields,
	},

	// ----------------------------------
	//         appointmentGroup: delete
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['appointmentGroup'],
				operation: ['delete'],
			},
		},
		options: [
			{
				displayName: 'Cancel Reason',
				name: 'cancel_reason',
				type: 'string',
				default: '',
				description: 'Reason for deleting the appointment group (included in the notification to participants)',
			},
		],
	},

	// ----------------------------------
	//         appointmentGroup: get
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['appointmentGroup'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{
						name: 'All Context Codes',
						value: 'all_context_codes',
						description: 'Every context code of the appointment group (only for users who manage it)',
					},
					{
						name: 'Appointments',
						value: 'appointments',
						description: 'The time slots (always included for a single appointment group)',
					},
					{
						name: 'Child Events',
						value: 'child_events',
						description: 'The reservations of each time slot',
					},
				],
				default: [],
				description: 'Additional information to include',
			},
		],
	},

	// ----------------------------------
	//         appointmentGroup: getAll
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['appointmentGroup'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Context Codes',
				name: 'context_codes',
				type: 'string',
				default: '',
				placeholder: 'course_123, course_456',
				description: 'Comma-separated context codes to limit the result to',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{
						name: 'All Context Codes',
						value: 'all_context_codes',
						description: 'Every context code of the appointment group (only for users who manage it)',
					},
					{
						name: 'Appointments',
						value: 'appointments',
						description: 'The time slots of the appointment group',
					},
					{
						name: 'Child Events',
						value: 'child_events',
						description: 'The reservations of each time slot (together with Appointments)',
					},
					{
						name: 'Participant Count',
						value: 'participant_count',
						description: 'The number of reservations',
					},
					{
						name: 'Reserved Times',
						value: 'reserved_times',
						description: 'The time slots the current user has reserved',
					},
				],
				default: [],
				description: 'Additional information to include',
			},
			{
				displayName: 'Include Past Appointments',
				name: 'include_past_appointments',
				type: 'boolean',
				default: false,
				description: 'Whether to include appointment groups whose time slots are all in the past',
			},
			{
				displayName: 'Scope',
				name: 'scope',
				type: 'options',
				options: [
					{
						name: 'Manageable',
						value: 'manageable',
						description: 'Appointment groups the current user can manage',
					},
					{
						name: 'Reservable',
						value: 'reservable',
						description: 'Published appointment groups the current user can sign up for',
					},
				],
				default: 'reservable',
				description: 'Which appointment groups to list. Canvas lists the reservable ones unless told otherwise.',
			},
		],
	},

	// ----------------------------------
	//         appointmentGroup: getNextAppointment
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['appointmentGroup'],
				operation: ['getNextAppointment'],
			},
		},
		options: [
			{
				displayName: 'Appointment Group IDs',
				name: 'appointment_group_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated IDs of the appointment groups to search. Without it every appointment group the user can sign up for is searched.',
			},
		],
	},

	// ----------------------------------
	//         appointmentGroup: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['appointmentGroup'],
				operation: ['update'],
			},
		},
		options: updateFields,
	},

	// ----------------------------------
	//         appointmentGroup: listUserParticipants / listGroupParticipants
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['appointmentGroup'],
				operation: ['listUserParticipants', 'listGroupParticipants'],
			},
		},
		options: [
			{
				displayName: 'Registration Status',
				name: 'registration_status',
				type: 'options',
				options: [
					{
						name: 'All',
						value: 'all',
						description: 'Everyone who may sign up',
					},
					{
						name: 'Registered',
						value: 'registered',
						description: 'Only those who reserved a time slot',
					},
				],
				default: 'all',
				description: 'Whether to list everyone who may sign up or only those who did',
			},
		],
	},
];
