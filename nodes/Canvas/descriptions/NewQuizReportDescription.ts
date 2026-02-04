import type { INodeProperties } from 'n8n-workflow';

export const newQuizReportOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['newQuizReport'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new quiz report',
				action: 'Create a new quiz report',
			},
		],
		default: 'create',
	},
];

export const newQuizReportFields: INodeProperties[] = [
	// ----------------------------------
	//         newQuizReport: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['newQuizReport'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Assignment ID',
		name: 'assignmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['newQuizReport'],
			},
		},
		description: 'The ID of the assignment linked to the quiz',
	},

	// ----------------------------------
	//         newQuizReport: create
	// ----------------------------------
	{
		displayName: 'Report Type',
		name: 'reportType',
		type: 'options',
		required: true,
		default: 'student_analysis',
		displayOptions: {
			show: {
				resource: ['newQuizReport'],
				operation: ['create'],
			},
		},
		options: [
			{
				name: 'Item Analysis',
				value: 'item_analysis',
				description: 'Analysis of quiz questions and answer patterns',
			},
			{
				name: 'Student Analysis',
				value: 'student_analysis',
				description: 'Analysis of student performance on the quiz',
			},
		],
		description: 'The type of report to generate',
	},
	{
		displayName: 'Format',
		name: 'format',
		type: 'options',
		required: true,
		default: 'csv',
		displayOptions: {
			show: {
				resource: ['newQuizReport'],
				operation: ['create'],
			},
		},
		options: [
			{
				name: 'CSV',
				value: 'csv',
				description: 'Comma-separated values format',
			},
			{
				name: 'JSON',
				value: 'json',
				description: 'JavaScript Object Notation format',
			},
		],
		description: 'The format of the generated report',
	},
];
