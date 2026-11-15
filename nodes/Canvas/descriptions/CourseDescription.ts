import type { INodeProperties } from 'n8n-workflow';

export const courseOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['course'],
			},
		},
		options: [
			{
				name: 'Batch Update',
				value: 'batchUpdate',
				description:
					'Publish, conclude, delete or restore up to 500 courses of an account in one background job (returns a Progress)',
				action: 'Batch update courses',
			},
			{
				name: 'Conclude',
				value: 'conclude',
				description:
					'Conclude a course',
				action: 'Conclude a course',
			},
			{
				name: 'Copy',
				value: 'copy',
				description:
					'Copy a course to a new course',
				action: 'Copy a course',
			},
			{
				name: 'Create',
				value: 'create',
				description:
					'Create a new course',
				action: 'Create a course',
			},
			{
				name: 'Delete',
				value: 'delete',
				description:
					'Delete a course',
				action: 'Delete a course',
			},
			{
				name: 'Get',
				value: 'get',
				description:
					'Get a single course',
				action: 'Get a course',
			},
			{
				name: 'Get Activity Stream',
				value: 'getActivityStream',
				description:
					'Get the current user\'s activity stream of a course',
				action: 'Get the activity stream of a course',
			},
			{
				name: 'Get Activity Stream Summary',
				value: 'getActivityStreamSummary',
				description:
					'Get the number of (unread) items per type in the current user\'s activity stream of a course',
				action: 'Get the activity stream summary of a course',
			},
			{
				name: 'Get Bulk User Progress',
				value: 'getBulkUserProgress',
				description:
					'Get the module progress of every student in a course',
				action: 'Get the progress of all students in a course',
			},
			{
				name: 'Get Effective Due Dates',
				value: 'getEffectiveDueDates',
				description:
					'Get the due date that applies to each student for each assignment, after overrides: one item per assignment and student',
				action: 'Get effective due dates in a course',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description:
					'Get many courses of the current user',
				action: 'Get many courses',
			},
			{
				name: 'Get Many for User',
				value: 'getAllForUser',
				description:
					'Get many courses of another user (as an admin or as an observer of that user)',
				action: 'Get many courses of a user',
			},
			{
				name: 'Get Permissions',
				value: 'getPermissions',
				description:
					'Check which permissions the current user has in a course',
				action: 'Get permissions in a course',
			},
			{
				name: 'Get Settings',
				value: 'getSettings',
				description:
					'Get the settings of a course',
				action: 'Get settings of a course',
			},
			{
				name: 'Get Test Student',
				value: 'getTestStudent',
				description:
					'Get the test student of a course (Canvas creates it when the course has none yet)',
				action: 'Get the test student of a course',
			},
			{
				name: 'Get User',
				value: 'getUser',
				description:
					'Get a single user of a course',
				action: 'Get a user of a course',
			},
			{
				name: 'Get User Progress',
				value: 'getUserProgress',
				description:
					'Get the module progress of one user in a course',
				action: 'Get the progress of a user in a course',
			},
			{
				name: 'List Content Share Users',
				value: 'listContentShareUsers',
				description:
					'Search the users content of a course can be shared with (teachers and admins)',
				action: 'List content share users of a course',
			},
			{
				name: 'List Recent Students',
				value: 'listRecentStudents',
				description:
					'List the students of a course by how recently they logged in',
				action: 'List recently logged in students of a course',
			},
			{
				name: 'List Students',
				value: 'listStudents',
				description:
					'List every student of a course. Prefer List Users, which also filters by role and honours the Pagination options.',
				action: 'List students in a course',
			},
			{
				name: 'List To-Do Items',
				value: 'listTodoItems',
				description:
					'List the current user\'s to-do items in a course (assignments to submit or to grade)',
				action: 'List to do items in a course',
			},
			{
				name: 'List Users',
				value: 'listUsers',
				description:
					'List the users enrolled in a course (the roster), optionally with their enrollments',
				action: 'List users in a course',
			},
			{
				name: 'Preview HTML',
				value: 'previewHtml',
				description:
					'Get HTML the way Canvas would store it for a course: sanitized, with links to course content resolved',
				action: 'Preview processed HTML for a course',
			},
			{
				name: 'Reset Content',
				value: 'resetContent',
				description:
					'Replace a course by a new, empty course with the same sections and enrollments (the original course is deleted)',
				action: 'Reset the content of a course',
			},
			{
				name: 'Restore Version',
				value: 'restoreVersion',
				description:
					'Restore the syllabus of a course to one of its earlier versions',
				action: 'Restore a syllabus version of a course',
			},
			{
				name: 'Update',
				value: 'update',
				description:
					'Update a course',
				action: 'Update a course',
			},
			{
				name: 'Update Settings',
				value: 'updateSettings',
				description:
					'Update the settings of a course',
				action: 'Update settings of a course',
			},
		],
		default: 'getAll',
	},
];

export const courseFields: INodeProperties[] = [
	// ----------------------------------
	//         course: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: [
					'conclude',
					'copy',
					'delete',
					'get',
					'getActivityStream',
					'getActivityStreamSummary',
					'getBulkUserProgress',
					'getEffectiveDueDates',
					'getPermissions',
					'getSettings',
					'getTestStudent',
					'getUser',
					'getUserProgress',
					'listContentShareUsers',
					'listRecentStudents',
					'listStudents',
					'listTodoItems',
					'listUsers',
					'previewHtml',
					'resetContent',
					'restoreVersion',
					'update',
					'updateSettings',
				],
			},
		},
		description: 'The ID of the course. Also accepts SIS IDs in the form "sis_course_id:XYZ".',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['getAllForUser', 'getUser', 'getUserProgress'],
			},
		},
		description:
			'The ID of the user. Also accepts "self" (the user of the token) and SIS IDs in the form "sis_user_id:XYZ".',
	},

	// ----------------------------------
	//         course: create
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['batchUpdate', 'create'],
			},
		},
		description:
			'The ID of the account to create the course in. For Batch Update: an account the courses belong to (the root account covers all of them).',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['create'],
			},
		},
		description: 'The name of the course',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Allow Student Assignment Edits',
				name: 'allow_student_assignment_edits',
				type: 'boolean',
				default: false,
				description: 'Whether students can edit their own assignments',
			},
			{
				displayName: 'Allow Student Forum Attachments',
				name: 'allow_student_forum_attachments',
				type: 'boolean',
				default: false,
				description: 'Whether students can attach files to discussion posts',
			},
			{
				displayName: 'Allow Wiki Comments',
				name: 'allow_wiki_comments',
				type: 'boolean',
				default: false,
				description: 'Whether students can comment on wiki pages',
			},
			{
				displayName: 'Apply Assignment Group Weights',
				name: 'apply_assignment_group_weights',
				type: 'boolean',
				default: false,
				description: 'Whether to weight final grade based on assignment groups',
			},
			{
				displayName: 'Course Code',
				name: 'course_code',
				type: 'string',
				default: '',
				description: 'The course code (short name)',
			},
			{
				displayName: 'Course Format',
				name: 'course_format',
				type: 'options',
				options: [
					{ name: 'Blended', value: 'blended' },
					{ name: 'On Campus', value: 'on_campus' },
					{ name: 'Online', value: 'online' },
				],
				default: 'online',
				description: 'The format of the course',
			},
			{
				displayName: 'Default View',
				name: 'default_view',
				type: 'options',
				options: [
					{ name: 'Assignments', value: 'assignments' },
					{ name: 'Feed', value: 'feed' },
					{ name: 'Modules', value: 'modules' },
					{ name: 'Syllabus', value: 'syllabus' },
					{ name: 'Wiki', value: 'wiki' },
				],
				default: 'modules',
				description: 'The default view for the course home page',
			},
			{
				displayName: 'Enable SIS Reactivation',
				name: 'enable_sis_reactivation',
				type: 'boolean',
				default: false,
				description: 'Whether to enable SIS reactivation for the course',
			},
			{
				displayName: 'End At',
				name: 'end_at',
				type: 'dateTime',
				default: '',
				description: 'Course end date in ISO 8601 format',
			},
			{
				displayName: 'Enroll Me',
				name: 'enroll_me',
				type: 'boolean',
				default: false,
				description: 'Whether to enroll the user who owns the token as a teacher in the new course',
			},
			{
				displayName: 'Enrollment Term ID',
				name: 'enrollment_term_id',
				type: 'string',
				default: '',
				description: 'The ID of the enrollment term for the course',
			},
			{
				displayName: 'Grade Passback Setting',
				name: 'grade_passback_setting',
				type: 'options',
				options: [
					{ name: 'Disabled', value: 'disabled' },
					{ name: 'Nightly Sync', value: 'nightly_sync' },
					{ name: 'Not Set', value: 'not_set' },
				],
				default: 'not_set',
				description: 'Grade passback setting for the course',
			},
			{
				displayName: 'Grading Standard ID',
				name: 'grading_standard_id',
				type: 'string',
				default: '',
				description: 'The ID of the grading standard to use',
			},
			{
				displayName: 'Hide Final Grades',
				name: 'hide_final_grades',
				type: 'boolean',
				default: false,
				description: 'Whether to hide final grades from students',
			},
			{
				displayName: 'Integration ID',
				name: 'integration_id',
				type: 'string',
				default: '',
				description: 'The integration ID for the course',
			},
			{
				displayName: 'Is Public',
				name: 'is_public',
				type: 'boolean',
				default: false,
				description: 'Whether the course is publicly visible',
			},
			{
				displayName: 'Is Public to Auth Users',
				name: 'is_public_to_auth_users',
				type: 'boolean',
				default: false,
				description: 'Whether the course is visible to authenticated users',
			},
			{
				displayName: 'License',
				name: 'license',
				type: 'options',
				options: [
					{ name: 'CC Attribution', value: 'cc_by' },
					{ name: 'CC Attribution No Derivatives', value: 'cc_by_nd' },
					{ name: 'CC Attribution Non-Commercial', value: 'cc_by_nc' },
					{ name: 'CC Attribution Non-Commercial No Derivatives', value: 'cc_by_nc_nd' },
					{ name: 'CC Attribution Non-Commercial Share Alike', value: 'cc_by_nc_sa' },
					{ name: 'CC Attribution Share Alike', value: 'cc_by_sa' },
					{ name: 'Private (Copyrighted)', value: 'private' },
					{ name: 'Public Domain', value: 'public_domain' },
				],
				default: 'private',
				description: 'The license for course content',
			},
			{
				displayName: 'Offer',
				name: 'offer',
				type: 'boolean',
				default: false,
				description: 'Whether to make the course available to students immediately',
			},
			{
				displayName: 'Open Enrollment',
				name: 'open_enrollment',
				type: 'boolean',
				default: false,
				description: 'Whether to allow self-enrollment',
			},
			{
				displayName: 'Public Description',
				name: 'public_description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'A publicly visible description of the course',
			},
			{
				displayName: 'Public Syllabus',
				name: 'public_syllabus',
				type: 'boolean',
				default: false,
				description: 'Whether to make the syllabus publicly visible',
			},
			{
				displayName: 'Public Syllabus to Auth',
				name: 'public_syllabus_to_auth',
				type: 'boolean',
				default: false,
				description: 'Whether to make the syllabus visible to authenticated users',
			},
			{
				displayName: 'Restrict Enrollments to Course Dates',
				name: 'restrict_enrollments_to_course_dates',
				type: 'boolean',
				default: false,
				description: 'Whether students can only access during course dates',
			},
			{
				displayName: 'Self Enrollment',
				name: 'self_enrollment',
				type: 'boolean',
				default: false,
				description: 'Whether to allow self-enrollment',
			},
			{
				displayName: 'SIS Course ID',
				name: 'sis_course_id',
				type: 'string',
				default: '',
				description: 'The SIS ID for the course',
			},
			{
				displayName: 'Start At',
				name: 'start_at',
				type: 'dateTime',
				default: '',
				description: 'Course start date in ISO 8601 format',
			},
			{
				displayName: 'Syllabus Body',
				name: 'syllabus_body',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The syllabus content (supports HTML)',
			},
			{
				displayName: 'Term ID',
				name: 'term_id',
				type: 'string',
				default: '',
				description: 'The term ID for the course',
			},
			{
				displayName: 'Time Zone',
				name: 'time_zone',
				type: 'string',
				default: '',
				description: 'The time zone for the course (e.g., "America/New_York")',
			},
		],
	},

	// ----------------------------------
	//         course: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Allow Student Assignment Edits',
				name: 'allow_student_assignment_edits',
				type: 'boolean',
				default: false,
				description: 'Whether students can edit their own assignments',
			},
			{
				displayName: 'Allow Student Forum Attachments',
				name: 'allow_student_forum_attachments',
				type: 'boolean',
				default: false,
				description: 'Whether students can attach files to discussion posts',
			},
			{
				displayName: 'Allow Wiki Comments',
				name: 'allow_wiki_comments',
				type: 'boolean',
				default: false,
				description: 'Whether students can comment on wiki pages',
			},
			{
				displayName: 'Apply Assignment Group Weights',
				name: 'apply_assignment_group_weights',
				type: 'boolean',
				default: false,
				description: 'Whether to weight final grade based on assignment groups',
			},
			{
				displayName: 'Course Code',
				name: 'course_code',
				type: 'string',
				default: '',
				description: 'The course code (short name)',
			},
			{
				displayName: 'Course Format',
				name: 'course_format',
				type: 'options',
				options: [
					{ name: 'Blended', value: 'blended' },
					{ name: 'On Campus', value: 'on_campus' },
					{ name: 'Online', value: 'online' },
				],
				default: 'online',
				description: 'The format of the course',
			},
			{
				displayName: 'Default View',
				name: 'default_view',
				type: 'options',
				options: [
					{ name: 'Assignments', value: 'assignments' },
					{ name: 'Feed', value: 'feed' },
					{ name: 'Modules', value: 'modules' },
					{ name: 'Syllabus', value: 'syllabus' },
					{ name: 'Wiki', value: 'wiki' },
				],
				default: 'modules',
				description: 'The default view for the course home page',
			},
			{
				displayName: 'End At',
				name: 'end_at',
				type: 'dateTime',
				default: '',
				description: 'Course end date in ISO 8601 format',
			},
			{
				displayName: 'Enrollment Term ID',
				name: 'enrollment_term_id',
				type: 'string',
				default: '',
				description: 'The ID of the enrollment term for the course',
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{ name: 'Claim', value: 'claim' },
					{ name: 'Conclude', value: 'conclude' },
					{ name: 'Delete', value: 'delete' },
					{ name: 'Offer', value: 'offer' },
					{ name: 'Undelete', value: 'undelete' },
				],
				default: 'offer',
				description: 'The action to take on the course',
			},
			{
				displayName: 'Grade Passback Setting',
				name: 'grade_passback_setting',
				type: 'options',
				options: [
					{ name: 'Disabled', value: 'disabled' },
					{ name: 'Nightly Sync', value: 'nightly_sync' },
					{ name: 'Not Set', value: 'not_set' },
				],
				default: 'not_set',
				description: 'Grade passback setting for the course',
			},
			{
				displayName: 'Grading Standard ID',
				name: 'grading_standard_id',
				type: 'string',
				default: '',
				description: 'The ID of the grading standard to use',
			},
			{
				displayName: 'Hide Final Grades',
				name: 'hide_final_grades',
				type: 'boolean',
				default: false,
				description: 'Whether to hide final grades from students',
			},
			{
				displayName: 'Integration ID',
				name: 'integration_id',
				type: 'string',
				default: '',
				description: 'The integration ID for the course',
			},
			{
				displayName: 'Is Public',
				name: 'is_public',
				type: 'boolean',
				default: false,
				description: 'Whether the course is publicly visible',
			},
			{
				displayName: 'Is Public to Auth Users',
				name: 'is_public_to_auth_users',
				type: 'boolean',
				default: false,
				description: 'Whether the course is visible to authenticated users',
			},
			{
				displayName: 'License',
				name: 'license',
				type: 'options',
				options: [
					{ name: 'CC Attribution', value: 'cc_by' },
					{ name: 'CC Attribution No Derivatives', value: 'cc_by_nd' },
					{ name: 'CC Attribution Non-Commercial', value: 'cc_by_nc' },
					{ name: 'CC Attribution Non-Commercial No Derivatives', value: 'cc_by_nc_nd' },
					{ name: 'CC Attribution Non-Commercial Share Alike', value: 'cc_by_nc_sa' },
					{ name: 'CC Attribution Share Alike', value: 'cc_by_sa' },
					{ name: 'Private (Copyrighted)', value: 'private' },
					{ name: 'Public Domain', value: 'public_domain' },
				],
				default: 'private',
				description: 'The license for course content',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the course',
			},
			{
				displayName: 'Open Enrollment',
				name: 'open_enrollment',
				type: 'boolean',
				default: false,
				description: 'Whether to allow self-enrollment',
			},
			{
				displayName: 'Public Description',
				name: 'public_description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'A publicly visible description of the course',
			},
			{
				displayName: 'Public Syllabus',
				name: 'public_syllabus',
				type: 'boolean',
				default: false,
				description: 'Whether to make the syllabus publicly visible',
			},
			{
				displayName: 'Public Syllabus to Auth',
				name: 'public_syllabus_to_auth',
				type: 'boolean',
				default: false,
				description: 'Whether to make the syllabus visible to authenticated users',
			},
			{
				displayName: 'Restrict Enrollments to Course Dates',
				name: 'restrict_enrollments_to_course_dates',
				type: 'boolean',
				default: false,
				description: 'Whether students can only access during course dates',
			},
			{
				displayName: 'Self Enrollment',
				name: 'self_enrollment',
				type: 'boolean',
				default: false,
				description: 'Whether to allow self-enrollment',
			},
			{
				displayName: 'SIS Course ID',
				name: 'sis_course_id',
				type: 'string',
				default: '',
				description: 'The SIS ID for the course',
			},
			{
				displayName: 'Start At',
				name: 'start_at',
				type: 'dateTime',
				default: '',
				description: 'Course start date in ISO 8601 format',
			},
			{
				displayName: 'Syllabus Body',
				name: 'syllabus_body',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The syllabus content (supports HTML)',
			},
			{
				displayName: 'Term ID',
				name: 'term_id',
				type: 'string',
				default: '',
				description: 'The term ID for the course',
			},
			{
				displayName: 'Time Zone',
				name: 'time_zone',
				type: 'string',
				default: '',
				description: 'The time zone for the course (e.g., "America/New_York")',
			},
		],
	},

	// ----------------------------------
	//         course: getAll, getAllForUser - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['getAll', 'getAllForUser'],
			},
		},
		options: [
			{
				displayName: 'Account ID',
				name: 'account_id',
				type: 'string',
				default: '',
				description:
					'Only return courses that belong directly to this account (courses of its sub-accounts are not included)',
			},
			{
				displayName: 'Enrollment Role',
				name: 'enrollment_role',
				type: 'string',
				default: '',
				description: 'Filter by custom enrollment role',
			},
			{
				displayName: 'Enrollment Role ID',
				name: 'enrollment_role_id',
				type: 'string',
				default: '',
				description: 'Filter by enrollment role ID',
			},
			{
				displayName: 'Enrollment State',
				name: 'enrollment_state',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Invited or Pending', value: 'invited_or_pending' },
				],
				default: 'active',
				description: 'Filter by enrollment state',
			},
			{
				displayName: 'Enrollment Type',
				name: 'enrollment_type',
				type: 'options',
				options: [
					{ name: 'Designer', value: 'designer' },
					{ name: 'Observer', value: 'observer' },
					{ name: 'Student', value: 'student' },
					{ name: 'TA', value: 'ta' },
					{ name: 'Teacher', value: 'teacher' },
				],
				default: 'student',
				description: 'Filter by enrollment type',
			},
			{
				displayName: 'Exclude Blueprint Courses',
				name: 'exclude_blueprint_courses',
				type: 'boolean',
				default: false,
				description: 'Whether to exclude blueprint courses',
			},
			{
				displayName: 'Homeroom',
				name: 'homeroom',
				type: 'boolean',
				default: false,
				description: 'Whether to filter for homeroom courses',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Banner Image', value: 'banner_image' },
					{ name: 'Concluded', value: 'concluded' },
					{ name: 'Course Image', value: 'course_image' },
					{ name: 'Course Progress', value: 'course_progress' },
					{ name: 'Current Grading Period Scores', value: 'current_grading_period_scores' },
					{ name: 'Favorites', value: 'favorites' },
					{ name: 'Grading Periods', value: 'grading_periods' },
					{ name: 'Needs Grading Count', value: 'needs_grading_count' },
					{ name: 'Observed Users', value: 'observed_users' },
					{ name: 'Passback Status', value: 'passback_status' },
					{ name: 'Permissions', value: 'permissions' },
					{ name: 'Post Manually', value: 'post_manually' },
					{ name: 'Public Description', value: 'public_description' },
					{ name: 'Sections', value: 'sections' },
					{ name: 'Storage Quota Used (MB)', value: 'storage_quota_used_mb' },
					{ name: 'Syllabus Body', value: 'syllabus_body' },
					{ name: 'Tabs', value: 'tabs' },
					{ name: 'Teachers', value: 'teachers' },
					{ name: 'Term', value: 'term' },
					{ name: 'Total Scores', value: 'total_scores' },
					{ name: 'Total Students', value: 'total_students' },
				],
				default: [],
				description: 'Additional information to include with each course',
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'multiOptions',
				options: [
					{ name: 'Available', value: 'available' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Created', value: 'created' },
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Unpublished', value: 'unpublished' },
				],
				default: [],
				description: 'Filter by course state',
			},
		],
	},

	// ----------------------------------
	//         course: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'All Courses', value: 'all_courses' },
					{ name: 'Banner Image', value: 'banner_image' },
					{ name: 'Course Image', value: 'course_image' },
					{ name: 'Current Grading Period Scores', value: 'current_grading_period_scores' },
					{ name: 'Grading Periods', value: 'grading_periods' },
					{ name: 'Needs Grading Count', value: 'needs_grading_count' },
					{ name: 'Observed Users', value: 'observed_users' },
					{ name: 'Permissions', value: 'permissions' },
					{ name: 'Public Description', value: 'public_description' },
					{ name: 'Sections', value: 'sections' },
					{ name: 'Syllabus Body', value: 'syllabus_body' },
					{ name: 'Syllabus Versions', value: 'syllabus_versions' },
					{ name: 'Teachers', value: 'teachers' },
					{ name: 'Term', value: 'term' },
					{ name: 'Total Scores', value: 'total_scores' },
					{ name: 'Total Students', value: 'total_students' },
				],
				default: [],
				description: 'Additional information to include with the course',
			},
			{
				displayName: 'Teacher Limit',
				name: 'teacher_limit',
				type: 'number',
				default: 10,
				description: 'Maximum number of teachers to include',
			},
		],
	},

	// ----------------------------------
	//         course: copy - options
	// ----------------------------------
	{
		displayName: 'Source Course ID',
		name: 'sourceCourseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['copy'],
			},
		},
		description: 'The ID of the source course to copy from',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['copy'],
			},
		},
		options: [
			{
				displayName: 'Except',
				name: 'except',
				type: 'multiOptions',
				options: [
					{ name: 'Announcements', value: 'announcements' },
					{ name: 'Assignment Groups', value: 'assignment_groups' },
					{ name: 'Assignments', value: 'assignments' },
					{ name: 'Attachments', value: 'attachments' },
					{ name: 'Calendar Events', value: 'calendar_events' },
					{ name: 'Discussion Topics', value: 'discussion_topics' },
					{ name: 'Modules', value: 'modules' },
					{ name: 'Quizzes', value: 'quizzes' },
					{ name: 'Rubrics', value: 'rubrics' },
					{ name: 'Wiki Pages', value: 'wiki_pages' },
				],
				default: [],
				description: 'Content types to exclude from the copy',
			},
			{
				displayName: 'Only',
				name: 'only',
				type: 'multiOptions',
				options: [
					{ name: 'Announcements', value: 'announcements' },
					{ name: 'Assignment Groups', value: 'assignment_groups' },
					{ name: 'Assignments', value: 'assignments' },
					{ name: 'Attachments', value: 'attachments' },
					{ name: 'Calendar Events', value: 'calendar_events' },
					{ name: 'Discussion Topics', value: 'discussion_topics' },
					{ name: 'Modules', value: 'modules' },
					{ name: 'Quizzes', value: 'quizzes' },
					{ name: 'Rubrics', value: 'rubrics' },
					{ name: 'Wiki Pages', value: 'wiki_pages' },
				],
				default: [],
				description: 'Content types to include in the copy (if specified, only these are copied)',
			},
		],
	},

	// ----------------------------------
	//         course: listUsers, listStudents - options
	// ----------------------------------
	{
		displayName:
			'Returns every student of the course in one go, whatever the Pagination options say. List Users does the same for any role and can be limited and paged.',
		name: 'listStudentsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['listStudents'],
			},
		},
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['listUsers'],
			},
		},
		options: [
			{
				displayName: 'Enrollment Role ID',
				name: 'enrollment_role_id',
				type: 'string',
				default: '',
				description:
					'Only return users enrolled with this course role (the ID of a built-in or custom role). Enrollment Type is ignored when this is set.',
			},
			{
				displayName: 'Enrollment State',
				name: 'enrollment_state',
				type: 'multiOptions',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Invited', value: 'invited' },
					{ name: 'Rejected', value: 'rejected' },
				],
				default: [],
				description:
					'Only return users with an enrollment in one of these states. Without this option Canvas returns active and invited users.',
			},
			{
				displayName: 'Enrollment Type',
				name: 'enrollment_type',
				type: 'multiOptions',
				options: [
					{ name: 'Designer', value: 'designer' },
					{ name: 'Observer', value: 'observer' },
					{ name: 'Student', value: 'student' },
					{ name: 'TA', value: 'ta' },
					{ name: 'Teacher', value: 'teacher' },
					{ name: 'Test Student', value: 'student_view' },
				],
				default: [],
				description: 'Only return users enrolled as one of these types',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar URL', value: 'avatar_url' },
					{ name: 'Bio', value: 'bio' },
					{ name: 'Current Grading Period Scores', value: 'current_grading_period_scores' },
					{ name: 'Custom Links', value: 'custom_links' },
					{ name: 'Enrollments', value: 'enrollments' },
					{ name: 'Group IDs', value: 'group_ids' },
					{ name: 'Locked', value: 'locked' },
					{ name: 'Test Student', value: 'test_student' },
					{ name: 'UUID', value: 'uuid' },
				],
				default: [],
				description:
					'Additional information to include with each user. Email addresses and SIS IDs are always returned when the token may see them. "Current Grading Period Scores" and "Locked" add to the enrollments, so they need "Enrollments" as well.',
			},
			{
				displayName: 'Include Inactive',
				name: 'include_inactive',
				type: 'boolean',
				default: false,
				description:
					'Whether to also return users whose enrollment is inactive (teachers and admins only). Has no effect together with Enrollment State.',
			},
			{
				displayName: 'Page Containing User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description:
					'Return only the page of the roster that contains this user: as many users as Items Per Page in the Pagination options, in roster order. Canvas cannot continue from that page, so no further pages are read. When the user is not on the roster, the first page is returned.',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description:
					'Only return users whose name, login, email or SIS ID contains this text (at least 2 characters), or whose ID is exactly this number',
			},
			{
				displayName: 'Section IDs',
				name: 'section_ids',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of section IDs: only return users enrolled in one of these sections',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Email', value: 'email' },
					{ name: 'SIS ID', value: 'sis_id' },
					{ name: 'Username', value: 'username' },
				],
				default: 'username',
				description: 'The field to sort users by. Without this option users are sorted by name.',
			},
			{
				displayName: 'User IDs',
				name: 'user_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of user IDs: only return these users',
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
				resource: ['course'],
				operation: ['listStudents'],
			},
		},
		options: [
			{
				displayName: 'Enrollment State',
				name: 'enrollment_state',
				type: 'multiOptions',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Invited', value: 'invited' },
					{ name: 'Rejected', value: 'rejected' },
				],
				default: ['active'],
				description:
					'Only return students with an enrollment in one of these states. Without this option Canvas returns active and invited students.',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar URL', value: 'avatar_url' },
					{ name: 'Bio', value: 'bio' },
					{ name: 'Enrollments', value: 'enrollments' },
					{ name: 'Group IDs', value: 'group_ids' },
					{ name: 'Locale', value: 'locale' },
					{ name: 'Test Student', value: 'test_student' },
					{ name: 'UUID', value: 'uuid' },
				],
				default: [],
				description:
					'Additional information to include with each student. Email addresses are always returned when the token may see them.',
			},
			{
				displayName: 'Search Term',
				name: 'search_term',
				type: 'string',
				default: '',
				description:
					'Only return students whose name, login, email or SIS ID contains this text (at least 2 characters), or whose ID is exactly this number',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Email', value: 'email' },
					{ name: 'Username', value: 'username' },
				],
				default: 'username',
				description: 'The field to sort students by',
			},
			{
				displayName: 'User IDs',
				name: 'user_ids',
				type: 'string',
				default: '',
				description: 'Comma-separated list of user IDs to filter by',
			},
		],
	},

	// ----------------------------------
	//         course: getUser - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['getUser'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar URL', value: 'avatar_url' },
					{ name: 'Bio', value: 'bio' },
					{ name: 'Current Grading Period Scores', value: 'current_grading_period_scores' },
					{ name: 'Custom Links', value: 'custom_links' },
					{ name: 'Email', value: 'email' },
					{ name: 'Enrollments', value: 'enrollments' },
					{ name: 'Inactive Enrollments', value: 'inactive_enrollments' },
					{ name: 'Locked', value: 'locked' },
					{ name: 'UUID', value: 'uuid' },
				],
				default: [],
				description:
					'Additional information to include with the user. "Inactive Enrollments" also finds a user whose enrollment in the course is inactive. "Current Grading Period Scores" and "Locked" add to the enrollments, so they need "Enrollments" as well.',
			},
		],
	},

	// ----------------------------------
	//         course: getPermissions
	// ----------------------------------
	{
		displayName: 'Permissions',
		name: 'permissions',
		type: 'string',
		default: '',
		placeholder: 'manage_grades,send_messages',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['getPermissions'],
			},
		},
		description:
			'Comma-separated list of permission names to check for the current user (e.g. "manage_grades,send_messages"). The result has one true/false property per permission. Leave empty to get every permission Canvas knows.',
	},

	// ----------------------------------
	//         course: updateSettings
	// ----------------------------------
	{
		displayName: 'Settings',
		name: 'settings',
		type: 'collection',
		placeholder: 'Add Setting',
		default: {},
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['updateSettings'],
			},
		},
		options: [
			{
				displayName: 'Allow Final Grade Override',
				name: 'allow_final_grade_override',
				type: 'boolean',
				default: false,
				description:
					'Whether final grades can be overridden in the gradebook. Only takes effect when the "Final Grade Override" feature is enabled for the course.',
			},
			{
				displayName: 'Allow Student Anonymous Discussion Topics',
				name: 'allow_student_anonymous_discussion_topics',
				type: 'boolean',
				default: false,
				description: 'Whether students can create anonymous discussion topics',
			},
			{
				displayName: 'Allow Student Discussion Editing',
				name: 'allow_student_discussion_editing',
				type: 'boolean',
				default: true,
				description: 'Whether students can edit or delete their own discussion replies',
			},
			{
				displayName: 'Allow Student Discussion Reporting',
				name: 'allow_student_discussion_reporting',
				type: 'boolean',
				default: true,
				description: 'Whether students can report offensive discussion content',
			},
			{
				displayName: 'Allow Student Discussion Topics',
				name: 'allow_student_discussion_topics',
				type: 'boolean',
				default: true,
				description: 'Whether students can create discussion topics',
			},
			{
				displayName: 'Allow Student Forum Attachments',
				name: 'allow_student_forum_attachments',
				type: 'boolean',
				default: true,
				description: 'Whether students can attach files to discussions',
			},
			{
				displayName: 'Allow Student Organized Groups',
				name: 'allow_student_organized_groups',
				type: 'boolean',
				default: true,
				description: 'Whether students can organize their own groups',
			},
			{
				displayName: 'Conditional Release',
				name: 'conditional_release',
				type: 'boolean',
				default: false,
				description:
					'Whether individual learning paths (Mastery Paths) are enabled. Ignored when the account locks this setting.',
			},
			{
				displayName: 'Default Due Time',
				name: 'default_due_time',
				type: 'string',
				default: '23:59:59',
				placeholder: '23:59:59',
				description:
					'The due time Canvas preselects for new assignments, as 24-hour HH:MM:SS. Existing assignments are not changed. Use "inherit" to follow the account setting; a value Canvas cannot read as a time has the same effect.',
			},
			{
				displayName: 'Filter SpeedGrader by Student Group',
				name: 'filter_speed_grader_by_student_group',
				type: 'boolean',
				default: false,
				description:
					'Whether SpeedGrader only shows the selected student group. Only takes effect when the feature of the same name is enabled for the root account.',
			},
			{
				displayName: 'Hide Distribution Graphs',
				name: 'hide_distribution_graphs',
				type: 'boolean',
				default: false,
				description: 'Whether to hide grade distribution graphs from students',
			},
			{
				displayName: 'Hide Final Grades',
				name: 'hide_final_grades',
				type: 'boolean',
				default: false,
				description: 'Whether to hide totals in the student grades summary',
			},
			{
				displayName: 'Hide Sections on Course Users Page',
				name: 'hide_sections_on_course_users_page',
				type: 'boolean',
				default: false,
				description:
					'Whether to keep students from seeing students of sections they do not belong to',
			},
			{
				displayName: 'Home Page Announcement Limit',
				name: 'home_page_announcement_limit',
				type: 'number',
				typeOptions: {
					minValue: 0,
				},
				default: 3,
				description:
					'How many announcements to show on the home page when Show Announcements on Home Page is enabled',
			},
			{
				displayName: 'Lock All Announcements',
				name: 'lock_all_announcements',
				type: 'boolean',
				default: false,
				description: 'Whether to disable comments on announcements',
			},
			{
				displayName: 'Restrict Student Future View',
				name: 'restrict_student_future_view',
				type: 'boolean',
				default: false,
				description: 'Whether to keep students from viewing the course before its start date',
			},
			{
				displayName: 'Restrict Student Past View',
				name: 'restrict_student_past_view',
				type: 'boolean',
				default: false,
				description: 'Whether to keep students from viewing the course after its end date',
			},
			{
				displayName: 'Show Announcements on Home Page',
				name: 'show_announcements_on_home_page',
				type: 'boolean',
				default: false,
				description: 'Whether to show the most recent announcements on the course home page',
			},
			{
				displayName: 'Syllabus Course Summary',
				name: 'syllabus_course_summary',
				type: 'boolean',
				default: true,
				description:
					'Whether to show the course summary (assignments and calendar events) on the syllabus page',
			},
			{
				displayName: 'Usage Rights Required',
				name: 'usage_rights_required',
				type: 'boolean',
				default: false,
				description:
					'Whether copyright and license information must be provided for files before they are published',
			},
		],
	},

	// ----------------------------------
	//         course: batchUpdate
	// ----------------------------------
	{
		displayName: 'Course IDs',
		name: 'courseIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: '101,102,sis_course_id:BIO-1',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['batchUpdate'],
			},
		},
		description:
			'Comma-separated list of the courses to update (at most 500). SIS IDs in the form "sis_course_id:XYZ" are accepted.',
	},
	{
		displayName: 'Event',
		name: 'event',
		type: 'options',
		required: true,
		options: [
			{
				name: 'Conclude',
				value: 'conclude',
				description: 'Make the courses read-only for all participants',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Remove the courses, including all enrollments',
			},
			{
				name: 'Offer',
				value: 'offer',
				description: 'Publish the courses',
			},
			{
				name: 'Undelete',
				value: 'undelete',
				description:
					'Restore deleted courses as unpublished courses (their enrollments are not restored)',
			},
		],
		default: 'offer',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['batchUpdate'],
			},
		},
		description:
			'The action to take on each course. The courses are updated by a background job: the output is its Progress object, which the Progress resource can poll.',
	},

	// ----------------------------------
	//         course: resetContent
	// ----------------------------------
	{
		displayName:
			'Canvas deletes this course and creates a new, empty one with the same name, sections and enrollments. The output is the new course, which has a new ID. All content of the original course is gone.',
		name: 'resetContentNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['resetContent'],
			},
		},
	},

	// ----------------------------------
	//         course: restoreVersion
	// ----------------------------------
	{
		displayName: 'Version',
		name: 'versionId',
		type: 'string',
		required: true,
		default: '',
		placeholder: '3',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['restoreVersion'],
			},
		},
		description:
			'The number of the syllabus version to restore. Get (Include: Syllabus Versions) lists the versions of a course. Restoring adds a new version with the old text. Needs the "Syllabus Versioning" feature of the Canvas instance; without it Canvas answers "not found".',
	},

	// ----------------------------------
	//         course: getEffectiveDueDates
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['getEffectiveDueDates'],
			},
		},
		options: [
			{
				displayName: 'Assignment IDs',
				name: 'assignment_ids',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of assignment IDs to return due dates for. Without this option every assignment of the course is returned.',
			},
		],
	},

	// ----------------------------------
	//         course: listTodoItems
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['listTodoItems'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [{ name: 'Ungraded Quizzes', value: 'ungraded_quizzes' }],
				default: [],
				description:
					'Additional items to return. "Ungraded Quizzes" adds practice quizzes and surveys the user still has to take.',
			},
		],
	},

	// ----------------------------------
	//         course: listContentShareUsers
	// ----------------------------------
	{
		displayName: 'Search Term',
		name: 'searchTerm',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['listContentShareUsers'],
			},
		},
		description: 'Text to look for in the name or email address of teachers and account admins',
	},

	// ----------------------------------
	//         course: listRecentStudents
	// ----------------------------------
	{
		displayName:
			'Each student has a "last_login" time; the most recent login comes first. Students who never logged in come last, in no fixed order: when they fill more than one page Canvas can repeat some of them and leave others out. The node removes the repeats. Use Return All in the Pagination options (pages of 100) when the list has to be complete.',
		name: 'recentStudentsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['listRecentStudents'],
			},
		},
	},

	// ----------------------------------
	//         course: getTestStudent
	// ----------------------------------
	{
		displayName:
			'Every course has at most one test student (the user behind "Student View"). If the course has none yet, Canvas creates it with this request.',
		name: 'testStudentNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['getTestStudent'],
			},
		},
	},

	// ----------------------------------
	//         course: previewHtml
	// ----------------------------------
	{
		displayName: 'HTML',
		name: 'html',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['course'],
				operation: ['previewHtml'],
			},
		},
		description:
			'The HTML to process. Canvas removes elements and attributes it does not allow and rewrites links to course files. Nothing is stored.',
	},
];
