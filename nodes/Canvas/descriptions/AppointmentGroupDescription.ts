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
				description: 'Create an appointment group',
				action: 'Create an appointment group',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an appointment group',
				action: 'Delete an appointment group',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single appointment group',
				action: 'Get an appointment group',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many appointment groups',
				action: 'Get many appointment groups',
			},
			{
				name: 'Get Next Appointment',
				value: 'getNextAppointment',
				description: 'Get the next available appointment',
				action: 'Get next available appointment',
			},
			{
				name: 'List Group Participants',
				value: 'listGroupParticipants',
				description: 'List student group participants in an appointment group',
				action: 'List group participants',
			},
			{
				name: 'List User Participants',
				value: 'listUserParticipants',
				description: 'List user participants in an appointment group',
				action: 'List user participants',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an appointment group',
				action: 'Update an appointment group',
			},
		],
		default: 'getAll',
	},
];

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
		displayOptions: {
			show: {
				resource: ['appointmentGroup'],
				operation: ['create'],
			},
		},
		description: 'Comma-separated context codes (e.g., "course_123,course_456"). At least one is required.',
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
		options: [
			{
				displayName: 'Allow Observer Signup',
				name: 'allow_observer_signup',
				type: 'boolean',
				default: false,
				description: 'Whether to allow observers to sign up for appointments',
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
				description: 'The physical address of the appointment location',
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
				default: 1,
				description: 'Maximum number of time slots a participant can reserve',
			},
			{
				displayName: 'Min Appointments Per Participant',
				name: 'min_appointments_per_participant',
				type: 'number',
				default: 0,
				description: 'Minimum number of time slots a participant must reserve',
			},
			{
				displayName: 'Participant Visibility',
				name: 'participant_visibility',
				type: 'options',
				options: [
					{ name: 'Private', value: 'private' },
					{ name: 'Protected', value: 'protected' },
				],
				default: 'private',
				description: 'Visibility of participant information',
			},
			{
				displayName: 'Participants Per Appointment',
				name: 'participants_per_appointment',
				type: 'number',
				default: 1,
				description: 'Maximum number of participants per time slot',
			},
			{
				displayName: 'Publish',
				name: 'publish',
				type: 'boolean',
				default: false,
				description: 'Whether to make the appointment group available for signup',
			},
			{
				displayName: 'Sub Context Codes',
				name: 'sub_context_codes',
				type: 'string',
				default: '',
				description: 'Comma-separated course section or group category codes',
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
		options: [
			{
				displayName: 'Allow Observer Signup',
				name: 'allow_observer_signup',
				type: 'boolean',
				default: false,
				description: 'Whether to allow observers to sign up for appointments',
			},
			{
				displayName: 'Context Codes',
				name: 'context_codes',
				type: 'string',
				default: '',
				description: 'Comma-separated context codes (e.g., "course_123,course_456")',
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
				description: 'The physical address of the appointment location',
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
				default: 1,
				description: 'Maximum number of time slots a participant can reserve',
			},
			{
				displayName: 'Min Appointments Per Participant',
				name: 'min_appointments_per_participant',
				type: 'number',
				default: 0,
				description: 'Minimum number of time slots a participant must reserve',
			},
			{
				displayName: 'Participant Visibility',
				name: 'participant_visibility',
				type: 'options',
				options: [
					{ name: 'Private', value: 'private' },
					{ name: 'Protected', value: 'protected' },
				],
				default: 'private',
				description: 'Visibility of participant information',
			},
			{
				displayName: 'Participants Per Appointment',
				name: 'participants_per_appointment',
				type: 'number',
				default: 1,
				description: 'Maximum number of participants per time slot',
			},
			{
				displayName: 'Publish',
				name: 'publish',
				type: 'boolean',
				default: false,
				description: 'Whether to make the appointment group available for signup',
			},
			{
				displayName: 'Sub Context Codes',
				name: 'sub_context_codes',
				type: 'string',
				default: '',
				description: 'Comma-separated course section or group category codes',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the appointment group',
			},
		],
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
				description: 'Reason for canceling/deleting the appointment group',
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
					{ name: 'All Context Codes', value: 'all_context_codes' },
					{ name: 'Appointments', value: 'appointments' },
					{ name: 'Child Events', value: 'child_events' },
				],
				default: [],
				description: 'Additional data to include in the response',
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
				description: 'Comma-separated context codes to filter by',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'All Context Codes', value: 'all_context_codes' },
					{ name: 'Appointments', value: 'appointments' },
					{ name: 'Child Events', value: 'child_events' },
					{ name: 'Participant Count', value: 'participant_count' },
					{ name: 'Reserved Times', value: 'reserved_times' },
				],
				default: [],
				description: 'Additional data to include in the response',
			},
			{
				displayName: 'Include Past Appointments',
				name: 'include_past_appointments',
				type: 'boolean',
				default: false,
				description: 'Whether to include past appointment groups',
			},
			{
				displayName: 'Scope',
				name: 'scope',
				type: 'options',
				options: [
					{ name: 'Manageable', value: 'manageable' },
					{ name: 'Reservable', value: 'reservable' },
				],
				default: 'reservable',
				description: 'Scope of appointment groups to return',
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
				description: 'Comma-separated appointment group IDs to search within',
			},
		],
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
					{ name: 'All', value: 'all' },
					{ name: 'Registered', value: 'registered' },
				],
				default: 'all',
				description: 'Filter participants by registration status',
			},
		],
	},
];
