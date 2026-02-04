import type { INodeProperties } from 'n8n-workflow';

export const enrollmentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['enrollment'],
			},
		},
		options: [
			{
				name: 'Conclude',
				value: 'conclude',
				description: 'Conclude an enrollment',
				action: 'Conclude an enrollment',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Enroll a user in a course',
				action: 'Create an enrollment',
			},
			{
				name: 'Deactivate',
				value: 'deactivate',
				description: 'Deactivate an enrollment',
				action: 'Deactivate an enrollment',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many enrollments',
				action: 'Get many enrollments',
			},
			{
				name: 'Reactivate',
				value: 'reactivate',
				description: 'Reactivate an enrollment',
				action: 'Reactivate an enrollment',
			},
		],
		default: 'getAll',
	},
];

export const enrollmentFields: INodeProperties[] = [
	// ----------------------------------
	//         enrollment: getAll
	// ----------------------------------
	{
		displayName: 'List By',
		name: 'listBy',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				name: 'Course',
				value: 'course',
				description: 'List enrollments in a course',
			},
			{
				name: 'Section',
				value: 'section',
				description: 'List enrollments in a section',
			},
			{
				name: 'User',
				value: 'user',
				description: 'List enrollments for a user',
			},
		],
		description: 'How to list enrollments',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['getAll'],
				listBy: ['course'],
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
				resource: ['enrollment'],
				operation: ['getAll'],
				listBy: ['section'],
			},
		},
		description: 'The ID of the section',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['getAll'],
				listBy: ['user'],
			},
		},
		description: 'The ID of the user (use "self" for current user)',
	},

	// ----------------------------------
	//         enrollment: create
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['create'],
			},
		},
		description: 'The ID of the course to enroll the user in',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['create'],
			},
		},
		description: 'The ID of the user to enroll',
	},
	{
		displayName: 'Enrollment Type',
		name: 'enrollmentType',
		type: 'options',
		required: true,
		default: 'StudentEnrollment',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['create'],
			},
		},
		options: [
			{
				name: 'Designer',
				value: 'DesignerEnrollment',
				description: 'Enroll as a course designer',
			},
			{
				name: 'Observer',
				value: 'ObserverEnrollment',
				description: 'Enroll as an observer',
			},
			{
				name: 'Student',
				value: 'StudentEnrollment',
				description: 'Enroll as a student',
			},
			{
				name: 'TA',
				value: 'TaEnrollment',
				description: 'Enroll as a teaching assistant',
			},
			{
				name: 'Teacher',
				value: 'TeacherEnrollment',
				description: 'Enroll as a teacher',
			},
		],
		description: 'The type of enrollment',
	},

	// ----------------------------------
	//         enrollment: conclude/deactivate/reactivate
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['conclude', 'deactivate', 'reactivate'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Enrollment ID',
		name: 'enrollmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['conclude', 'deactivate', 'reactivate'],
			},
		},
		description: 'The ID of the enrollment',
	},

	// ----------------------------------
	//         enrollment: create - Additional Fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Associated User ID',
				name: 'associatedUserId',
				type: 'string',
				default: '',
				description: 'For observer enrollments, the ID of the student to observe',
			},
			{
				displayName: 'Course Section ID',
				name: 'courseSectionId',
				type: 'string',
				default: '',
				description: 'The ID of the course section to enroll the user in',
			},
			{
				displayName: 'Enrollment State',
				name: 'enrollmentState',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Invited', value: 'invited' },
				],
				default: 'active',
				description: 'The initial state of the enrollment',
			},
			{
				displayName: 'Limit Privileges to Course Section',
				name: 'limitPrivilegesToCourseSection',
				type: 'boolean',
				default: false,
				description: 'Whether to limit the user\'s privileges to the enrolled section',
			},
			{
				displayName: 'Notify',
				name: 'notify',
				type: 'boolean',
				default: false,
				description: 'Whether to send an enrollment notification email to the user',
			},
			{
				displayName: 'Role ID',
				name: 'roleId',
				type: 'string',
				default: '',
				description: 'The ID of a custom role to use for the enrollment',
			},
			{
				displayName: 'Self Enrolled',
				name: 'selfEnrolled',
				type: 'boolean',
				default: false,
				description: 'Whether the user enrolled themselves',
			},
			{
				displayName: 'Self Enrollment Code',
				name: 'selfEnrollmentCode',
				type: 'string',
				default: '',
				description: 'The self-enrollment code used (if self-enrolled)',
			},
			{
				displayName: 'SIS Enrollment ID',
				name: 'sisEnrollmentId',
				type: 'string',
				default: '',
				description: 'SIS ID for the enrollment',
			},
			{
				displayName: 'Start At',
				name: 'startAt',
				type: 'dateTime',
				default: '',
				description: 'Override start date for the enrollment',
			},
			{
				displayName: 'End At',
				name: 'endAt',
				type: 'dateTime',
				default: '',
				description: 'Override end date for the enrollment',
			},
		],
	},

	// ----------------------------------
	//         enrollment: getAll - Filters
	// ----------------------------------
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Enrollment Term ID',
				name: 'enrollmentTermId',
				type: 'string',
				default: '',
				description: 'Filter by enrollment term',
			},
			{
				displayName: 'Grading Period ID',
				name: 'gradingPeriodId',
				type: 'string',
				default: '',
				description: 'Filter by grading period',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar URL', value: 'avatar_url' },
					{ name: 'Current Points', value: 'current_points' },
					{ name: 'Group IDs', value: 'group_ids' },
					{ name: 'Locked', value: 'locked' },
					{ name: 'Observed Users', value: 'observed_users' },
					{ name: 'Total Scores', value: 'total_scores' },
					{ name: 'UUID', value: 'uuid' },
				],
				default: [],
				description: 'Additional data to include in the response',
			},
			{
				displayName: 'Role',
				name: 'role',
				type: 'multiOptions',
				options: [
					{ name: 'Designer', value: 'DesignerEnrollment' },
					{ name: 'Observer', value: 'ObserverEnrollment' },
					{ name: 'Student', value: 'StudentEnrollment' },
					{ name: 'TA', value: 'TaEnrollment' },
					{ name: 'Teacher', value: 'TeacherEnrollment' },
				],
				default: [],
				description: 'Filter by enrollment role(s)',
			},
			{
				displayName: 'SIS Account IDs',
				name: 'sisAccountIds',
				type: 'string',
				default: '',
				description: 'Comma-separated list of SIS account IDs to filter by',
			},
			{
				displayName: 'SIS Course IDs',
				name: 'sisCourseIds',
				type: 'string',
				default: '',
				description: 'Comma-separated list of SIS course IDs to filter by',
			},
			{
				displayName: 'SIS Section IDs',
				name: 'sisSectionIds',
				type: 'string',
				default: '',
				description: 'Comma-separated list of SIS section IDs to filter by',
			},
			{
				displayName: 'SIS User IDs',
				name: 'sisUserIds',
				type: 'string',
				default: '',
				description: 'Comma-separated list of SIS user IDs to filter by',
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'multiOptions',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Creation Pending', value: 'creation_pending' },
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Invited', value: 'invited' },
					{ name: 'Rejected', value: 'rejected' },
				],
				default: [],
				description: 'Filter by enrollment state(s)',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'multiOptions',
				options: [
					{ name: 'Designer', value: 'DesignerEnrollment' },
					{ name: 'Observer', value: 'ObserverEnrollment' },
					{ name: 'Student', value: 'StudentEnrollment' },
					{ name: 'TA', value: 'TaEnrollment' },
					{ name: 'Teacher', value: 'TeacherEnrollment' },
				],
				default: [],
				description: 'Filter by enrollment type(s)',
			},
			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				description: 'Filter by specific user ID (when listing by course/section)',
			},
		],
	},
];
