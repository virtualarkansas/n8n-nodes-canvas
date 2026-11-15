import type { INodeProperties } from 'n8n-workflow';

export const favoriteOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['favorite'],
			},
		},
		options: [
			{
				name: 'Add Course',
				value: 'addCourse',
				description: 'Add a course to favorites',
				action: 'Add a course to favorites',
			},
			{
				name: 'Add Group',
				value: 'addGroup',
				description: 'Add a group to favorites',
				action: 'Add a group to favorites',
			},
			{
				name: 'Get Many Courses',
				value: 'getAllCourses',
				description: 'Get many favorite courses',
				action: 'Get many favorite courses',
			},
			{
				name: 'Get Many Groups',
				value: 'getAllGroups',
				description: 'Get many favorite groups',
				action: 'Get many favorite groups',
			},
			{
				name: 'Remove Course',
				value: 'removeCourse',
				description: 'Remove a course from favorites',
				action: 'Remove a course from favorites',
			},
			{
				name: 'Remove Group',
				value: 'removeGroup',
				description: 'Remove a group from favorites',
				action: 'Remove a group from favorites',
			},
			{
				name: 'Reset Courses',
				value: 'resetCourses',
				description: 'Reset course favorites to default',
				action: 'Reset course favorites to default',
			},
			{
				name: 'Reset Groups',
				value: 'resetGroups',
				description: 'Reset group favorites to default',
				action: 'Reset group favorites to default',
			},
		],
		default: 'getAllCourses',
	},
];

export const favoriteFields: INodeProperties[] = [
	// ----------------------------------
	//         favorite: addCourse / removeCourse
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['favorite'],
				operation: ['addCourse', 'removeCourse'],
			},
		},
		description: 'The ID of the course to add or remove from favorites',
	},

	// ----------------------------------
	//         favorite: addGroup / removeGroup
	// ----------------------------------
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['favorite'],
				operation: ['addGroup', 'removeGroup'],
			},
		},
		description: 'The ID of the group to add or remove from favorites',
	},

	// ----------------------------------
	//         favorite: getAllCourses - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['favorite'],
				operation: ['getAllCourses'],
			},
		},
		options: [
			{
				displayName: 'Exclude Blueprint Courses',
				name: 'exclude_blueprint_courses',
				type: 'boolean',
				default: false,
				description: 'Whether to exclude blueprint courses from the results',
			},
			{
				displayName: 'Exclude Enrollments',
				name: 'exclude_enrollments',
				type: 'boolean',
				default: false,
				description:
					'Whether to leave the user\'s enrollments out of each course (smaller and faster responses)',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Banner Image', value: 'banner_image' },
					{ name: 'Concluded', value: 'concluded' },
					{ name: 'Course Image', value: 'course_image' },
					{ name: 'Current Grading Period Scores', value: 'current_grading_period_scores' },
					{ name: 'Favorites', value: 'favorites' },
					{ name: 'Grading Periods', value: 'grading_periods' },
					{ name: 'Needs Grading Count', value: 'needs_grading_count' },
					{ name: 'Observed Users', value: 'observed_users' },
					{ name: 'Permissions', value: 'permissions' },
					{ name: 'Public Description', value: 'public_description' },
					{ name: 'Sections', value: 'sections' },
					{ name: 'Syllabus Body', value: 'syllabus_body' },
					{ name: 'Teachers', value: 'teachers' },
					{ name: 'Term', value: 'term' },
					{ name: 'Total Scores', value: 'total_scores' },
					{ name: 'Total Students', value: 'total_students' },
				],
				default: [],
				description: 'Additional information to include with each course',
			},
			{
				displayName: 'Observed User ID',
				name: 'observed_user_id',
				type: 'string',
				default: '',
				description:
					'For an observer: list the dashboard courses in which this observed student is linked to the observer',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{
						name: 'Dashboard Order',
						value: '',
						description: 'The order of the user\'s dashboard',
					},
					{
						name: 'Nickname',
						value: 'nickname',
						description: 'By enrollment type, then by the user\'s nickname for the course (or its name)',
					},
				],
				default: '',
				description: 'How to order the courses',
			},
		],
	},
];
