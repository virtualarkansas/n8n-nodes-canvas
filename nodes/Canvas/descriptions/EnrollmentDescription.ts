import type { INodeProperties } from 'n8n-workflow';

const enrollmentTypeOptions = [
	{ name: 'Designer', value: 'DesignerEnrollment' },
	{ name: 'Observer', value: 'ObserverEnrollment' },
	{ name: 'Student', value: 'StudentEnrollment' },
	{ name: 'TA', value: 'TaEnrollment' },
	{ name: 'Teacher', value: 'TeacherEnrollment' },
];

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
				name: 'Accept Invitation',
				value: 'acceptInvitation',
				description:
					'Accept a course invitation. Only the invited user can do this: the enrollment must belong to the user of the credential.',
				action: 'Accept a course invitation',
			},
			{
				name: 'Bulk Enroll',
				value: 'bulkEnroll',
				description:
					'Enroll several users in several courses in a background job. The users are invited (observers are enrolled as active right away). Returns a Progress object; the Progress resource can poll it.',
				action: 'Enroll several users in several courses',
			},
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
				description: 'Deactivate an enrollment: the user stays on the roster but cannot participate',
				action: 'Deactivate an enrollment',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an enrollment',
				action: 'Delete an enrollment',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single enrollment by ID',
				action: 'Get an enrollment',
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
				description: 'Reactivate an inactive enrollment',
				action: 'Reactivate an enrollment',
			},
			{
				name: 'Reject Invitation',
				value: 'rejectInvitation',
				description:
					'Reject a course invitation. Only the invited user can do this: the enrollment must belong to the user of the credential.',
				action: 'Reject a course invitation',
			},
			{
				name: 'Set Last Attended',
				value: 'setLastAttended',
				description: 'Set the last attended date of a student in a course',
				action: 'Set the last attended date of an enrollment',
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
	//         enrollment: get
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['get'],
			},
		},
		description:
			'The ID of the root account, or of a sub-account the enrollment\'s course belongs to ("self" selects the root account of the Canvas URL)',
	},

	// ----------------------------------
	//         enrollment: create, setLastAttended
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
				operation: ['create', 'setLastAttended'],
			},
		},
		description: 'The ID of the course',
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
				operation: ['create', 'setLastAttended'],
			},
		},
		description: 'The ID of the user',
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
		description:
			'The type of enrollment. When a "Role ID" is given, the type must be the base type of that role.',
	},
	{
		displayName: 'Date',
		name: 'date',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['setLastAttended'],
			},
		},
		description: 'The date the student last attended the course',
	},

	// ----------------------------------
	//         enrollment: conclude/deactivate/delete/reactivate, accept/reject invitation
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
				operation: ['acceptInvitation', 'conclude', 'deactivate', 'delete', 'reactivate', 'rejectInvitation'],
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
				operation: [
					'acceptInvitation',
					'conclude',
					'deactivate',
					'delete',
					'get',
					'reactivate',
					'rejectInvitation',
				],
			},
		},
		description: 'The ID of the enrollment',
	},

	// ----------------------------------
	//         enrollment: bulkEnroll
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['bulkEnroll'],
			},
		},
		description:
			'The ID of the account the background job runs in ("self" selects the root account of the Canvas URL). Canvas looks SIS IDs of users and courses up in this account: they are only found when it is the root account, otherwise such entries are skipped without an error.',
	},
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: '101,102,sis_user_id:ABC',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['bulkEnroll'],
			},
		},
		description:
			'Comma-separated list of the users to enroll. Every user is enrolled in every course; users times courses must not exceed 500. Users Canvas does not find are skipped without an error.',
	},
	{
		displayName: 'Course IDs',
		name: 'courseIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: '11,12,sis_course_id:XYZ',
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['bulkEnroll'],
			},
		},
		description:
			'Comma-separated list of the courses to enroll the users in. The current user must be allowed to enroll users in each of them.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['enrollment'],
				operation: ['bulkEnroll'],
			},
		},
		options: [
			{
				displayName: 'Enrollment Type',
				name: 'enrollmentType',
				type: 'options',
				options: enrollmentTypeOptions,
				default: 'StudentEnrollment',
				description:
					'The type of the enrollments (Canvas default: student, or the base type of "Role ID"). With a "Role ID" it must be the base type of that role.',
			},
			{
				displayName: 'Role ID',
				name: 'roleId',
				type: 'string',
				default: '',
				description: 'The ID of a custom course role to give the enrollments',
			},
		],
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
				description: 'The ID of the course section to enroll the user in (default: the default section of the course)',
			},
			{
				displayName: 'End At',
				name: 'endAt',
				type: 'dateTime',
				default: '',
				description: 'Override end date for the enrollment',
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
				description:
					'The initial state of the enrollment. Without this field Canvas creates the enrollment as "invited" and the user has to accept it.',
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
				description: 'Whether to mark the enrollment as a self-enrollment, which lets students drop the course themselves',
			},
			{
				displayName: 'Self Enrollment Code',
				name: 'selfEnrollmentCode',
				type: 'string',
				default: '',
				description:
					'The self-enrollment code of the course. Lets the current user enroll themselves without permission to manage enrollments: "User ID" must be "self" and all other fields are ignored.',
			},
			{
				displayName: 'Start At',
				name: 'startAt',
				type: 'dateTime',
				default: '',
				description: 'Override start date for the enrollment',
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
				description:
					'Only return enrollments of this term (only when listing by user). SIS IDs work in the form "sis_term_id:ABC".',
			},
			{
				displayName: 'Grading Period ID',
				name: 'gradingPeriodId',
				type: 'string',
				default: '',
				description: 'Return the grades of this grading period instead of the grades for the whole course',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar URL', value: 'avatar_url' },
					{ name: 'Can Be Removed', value: 'can_be_removed' },
					{ name: 'Current Points', value: 'current_points' },
					{ name: 'Group IDs', value: 'group_ids' },
					{ name: 'Locked', value: 'locked' },
					{ name: 'Observed Users', value: 'observed_users' },
					{ name: 'UUID', value: 'uuid' },
				],
				default: [],
				description: 'Additional data to include in the response',
			},
			{
				displayName: 'Role',
				name: 'role',
				type: 'multiOptions',
				options: enrollmentTypeOptions,
				default: [],
				description: 'Filter by the base roles. For custom roles use "Role IDs".',
			},
			{
				displayName: 'Role IDs',
				name: 'roleIds',
				type: 'string',
				default: '',
				description: 'Comma-separated list of role IDs (built-in or custom) to filter by. Takes precedence over "Role" and "Type".',
			},
			{
				displayName: 'SIS Account IDs',
				name: 'sisAccountIds',
				type: 'string',
				default: '',
				description: 'Comma-separated list of SIS account IDs to filter by (sub-accounts are not searched)',
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
					{
						name: 'Current and Concluded (Own Enrollments Only)',
						value: 'current_and_concluded',
					},
					{
						name: 'Current and Future (Own Enrollments Only)',
						value: 'current_and_future',
					},
					{
						name: 'Current and Invited (Own Enrollments Only)',
						value: 'current_and_invited',
					},
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Invited', value: 'invited' },
					{ name: 'Rejected', value: 'rejected' },
				],
				default: [],
				description:
					'Filter by enrollment state(s). Without this filter Canvas returns active and invited enrollments. The combined states only work when listing the enrollments of the current user.',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'multiOptions',
				options: enrollmentTypeOptions,
				default: [],
				description: 'Filter by enrollment type(s). Ignored when a role filter is set.',
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
