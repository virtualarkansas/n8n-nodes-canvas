import type { INodeProperties } from 'n8n-workflow';

export const gradeChangeLogOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['gradeChangeLog'],
			},
		},
		options: [
			{
				name: 'Get by Assignment',
				value: 'getByAssignment',
				description: 'List grade changes for an assignment',
				action: 'Get grade changes for an assignment',
			},
			{
				name: 'Get by Course',
				value: 'getByCourse',
				description: 'List grade changes in a course',
				action: 'Get grade changes for a course',
			},
			{
				name: 'Get by Grader',
				value: 'getByGrader',
				description: 'List grade changes made by a grader',
				action: 'Get grade changes by a grader',
			},
			{
				name: 'Get by Student',
				value: 'getByStudent',
				description: 'List grade changes for a student',
				action: 'Get grade changes for a student',
			},
			{
				name: 'Query',
				value: 'query',
				description: 'List grade changes matching any combination of course, assignment, student and grader',
				action: 'Query grade changes',
			},
		],
		default: 'getByCourse',
	},
];

const timeRange: INodeProperties[] = [
	{
		displayName: 'End Time',
		name: 'end_time',
		type: 'dateTime',
		default: '',
		description: 'Only return changes made before this time',
	},
	{
		displayName: 'Start Time',
		name: 'start_time',
		type: 'dateTime',
		default: '',
		description: 'Only return changes made at or after this time',
	},
];

export const gradeChangeLogFields: INodeProperties[] = [
	{
		displayName:
			'The grade change log is available to account administrators. Each change becomes one item.',
		name: 'gradeChangeLogNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['gradeChangeLog'],
			},
		},
	},
	{
		displayName: 'Assignment ID',
		name: 'assignmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradeChangeLog'],
				operation: ['getByAssignment'],
			},
		},
		description: 'The ID of the assignment',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradeChangeLog'],
				operation: ['getByCourse'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Grader ID',
		name: 'graderId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradeChangeLog'],
				operation: ['getByGrader'],
			},
		},
		description: 'The ID of the user who changed the grades',
	},
	{
		displayName: 'Student ID',
		name: 'studentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradeChangeLog'],
				operation: ['getByStudent'],
			},
		},
		description: 'The ID of the student whose grades changed',
	},
	{
		displayName: 'Include Linked Records',
		name: 'includeLinked',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: {
				resource: ['gradeChangeLog'],
			},
		},
		description:
			'Whether to add to every event a "linked" object with the records its "links" point to (course, assignment, student, grader, page view), as Canvas sends them with the event. Keeps the names of deleted records that cannot be looked up later. The linked records are repeated on every event, so a long log grows considerably. Switch it off when the IDs are enough.',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['gradeChangeLog'],
				operation: ['getByAssignment', 'getByCourse', 'getByGrader', 'getByStudent'],
			},
		},
		options: timeRange,
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['gradeChangeLog'],
				operation: ['query'],
			},
		},
		description: 'At least one of course, assignment, student or grader is needed',
		options: [
			{
				displayName: 'Assignment ID',
				name: 'assignment_id',
				type: 'string',
				default: '',
				description: 'Only return changes to this assignment',
			},
			{
				displayName: 'Course ID',
				name: 'course_id',
				type: 'string',
				default: '',
				description: 'Only return changes in this course',
			},
			timeRange[0],
			{
				displayName: 'Grader ID',
				name: 'grader_id',
				type: 'string',
				default: '',
				description: 'Only return changes made by this user',
			},
			timeRange[1],
			{
				displayName: 'Student ID',
				name: 'student_id',
				type: 'string',
				default: '',
				description: 'Only return changes to this student\'s grades',
			},
		],
	},
];
