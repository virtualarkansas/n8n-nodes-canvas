import type { INodeProperties } from 'n8n-workflow';

export const analyticsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['analytics'],
			},
		},
		options: [
			{
				name: 'Get Course Activity',
				value: 'getCourseActivity',
				description: 'Get page view hits and participation numbers for a course',
				action: 'Get course activity',
			},
			{
				name: 'Get Course Assignments',
				value: 'getCourseAssignments',
				description: 'Get assignment data for a course with grade distributions',
				action: 'Get course assignments',
			},
			{
				name: 'Get Department Activity',
				value: 'getDepartmentActivity',
				description: 'Get page view hits summed across all courses in a department',
				action: 'Get department activity',
			},
			{
				name: 'Get Department Grades',
				value: 'getDepartmentGrades',
				description: 'Get grade distribution for students in department courses',
				action: 'Get department grades',
			},
			{
				name: 'Get Department Statistics',
				value: 'getDepartmentStatistics',
				description: 'Get numeric statistics for a department',
				action: 'Get department statistics',
			},
			{
				name: 'Get Department Statistics by Subaccount',
				value: 'getDepartmentStatisticsBySubaccount',
				description: 'Get statistics broken down by subaccount',
				action: 'Get department statistics by subaccount',
			},
			{
				name: 'Get Student Summaries',
				value: 'getStudentSummaries',
				description: 'Get summary of per-user access information for all students',
				action: 'Get student summaries',
			},
			{
				name: 'Get User Activity',
				value: 'getUserActivity',
				description: 'Get page view hits grouped by hour for a specific user',
				action: 'Get user activity',
			},
			{
				name: 'Get User Assignments',
				value: 'getUserAssignments',
				description: 'Get assignment data for a specific user in a course',
				action: 'Get user assignments',
			},
			{
				name: 'Get User Communication',
				value: 'getUserCommunication',
				description: 'Get messaging data between student and instructors',
				action: 'Get user communication',
			},
		],
		default: 'getCourseActivity',
	},
];

export const analyticsFields: INodeProperties[] = [
	// ----------------------------------
	//         analytics: shared fields
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: [
					'getCourseActivity',
					'getCourseAssignments',
					'getStudentSummaries',
					'getUserActivity',
					'getUserAssignments',
					'getUserCommunication',
				],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: [
					'getDepartmentActivity',
					'getDepartmentGrades',
					'getDepartmentStatistics',
					'getDepartmentStatisticsBySubaccount',
				],
			},
		},
		description: 'The ID of the account (department)',
	},
	{
		displayName: 'Student ID',
		name: 'studentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: ['getUserActivity', 'getUserAssignments', 'getUserCommunication'],
			},
		},
		description: 'The ID of the student',
	},

	// ----------------------------------
	//         analytics: department term filter
	// ----------------------------------
	{
		displayName: 'Term Filter',
		name: 'termFilter',
		type: 'options',
		required: true,
		default: 'current',
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: [
					'getDepartmentActivity',
					'getDepartmentGrades',
					'getDepartmentStatistics',
					'getDepartmentStatisticsBySubaccount',
				],
			},
		},
		options: [
			{
				name: 'Completed',
				value: 'completed',
			},
			{
				name: 'Current',
				value: 'current',
			},
			{
				name: 'Specific Term',
				value: 'term',
			},
		],
		description: 'Filter analytics by term',
	},
	{
		displayName: 'Term ID',
		name: 'termId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: [
					'getDepartmentActivity',
					'getDepartmentGrades',
					'getDepartmentStatistics',
					'getDepartmentStatisticsBySubaccount',
				],
				termFilter: ['term'],
			},
		},
		description: 'The ID of the specific term',
	},

	// ----------------------------------
	//         analytics: getCourseAssignments options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: ['getCourseAssignments'],
			},
		},
		options: [
			{
				displayName: 'Async',
				name: 'async',
				type: 'boolean',
				default: false,
				description:
					'Whether to enable asynchronous processing and return a progress URL instead of results',
			},
		],
	},

	// ----------------------------------
	//         analytics: getStudentSummaries options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['analytics'],
				operation: ['getStudentSummaries'],
			},
		},
		options: [
			{
				displayName: 'Sort Column',
				name: 'sort_column',
				type: 'options',
				default: 'name',
				options: [
					{
						name: 'Name',
						value: 'name',
					},
					{
						name: 'Page Views',
						value: 'page_views',
					},
					{
						name: 'Page Views (Descending)',
						value: 'page_views_descending',
					},
					{
						name: 'Participations',
						value: 'participations',
					},
					{
						name: 'Participations (Descending)',
						value: 'participations_descending',
					},
					{
						name: 'Score',
						value: 'score',
					},
				],
				description: 'The column to sort results by',
			},
			{
				displayName: 'Student ID',
				name: 'student_id',
				type: 'string',
				default: '',
				description: 'Filter to a specific student ID',
			},
		],
	},
];
