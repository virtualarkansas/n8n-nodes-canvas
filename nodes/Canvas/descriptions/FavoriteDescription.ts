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
		],
	},
];
