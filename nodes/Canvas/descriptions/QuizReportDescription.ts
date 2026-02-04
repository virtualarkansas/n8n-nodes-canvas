import type { INodeProperties } from 'n8n-workflow';

export const quizReportOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['quizReport'],
			},
		},
		options: [
			{
				name: 'Abort',
				value: 'abort',
				description: 'Abort a running report or remove a generated one',
				action: 'Abort a quiz report',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new quiz report',
				action: 'Create a quiz report',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single quiz report',
				action: 'Get a quiz report',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many quiz reports',
				action: 'Get many quiz reports',
			},
		],
		default: 'getAll',
	},
];

export const quizReportFields: INodeProperties[] = [
	// ----------------------------------
	//         quizReport: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizReport'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Quiz ID',
		name: 'quizId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizReport'],
			},
		},
		description: 'The ID of the quiz',
	},

	// ----------------------------------
	//         quizReport: get, abort
	// ----------------------------------
	{
		displayName: 'Report ID',
		name: 'reportId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizReport'],
				operation: ['get', 'abort'],
			},
		},
		description: 'The ID of the quiz report',
	},

	// ----------------------------------
	//         quizReport: create
	// ----------------------------------
	{
		displayName: 'Report Type',
		name: 'reportType',
		type: 'options',
		required: true,
		options: [
			{
				name: 'Item Analysis',
				value: 'item_analysis',
				description: 'Analyze question performance and statistics',
			},
			{
				name: 'Student Analysis',
				value: 'student_analysis',
				description: 'Analyze student responses and scores',
			},
		],
		default: 'student_analysis',
		displayOptions: {
			show: {
				resource: ['quizReport'],
				operation: ['create'],
			},
		},
		description: 'The type of report to generate',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizReport'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'File', value: 'file' },
					{ name: 'Progress', value: 'progress' },
				],
				default: [],
				description: 'Additional objects to include in the response (JSON-API only)',
			},
			{
				displayName: 'Includes All Versions',
				name: 'includes_all_versions',
				type: 'boolean',
				default: false,
				description: 'Whether to include all submission attempts or only the most recent',
			},
		],
	},

	// ----------------------------------
	//         quizReport: get - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizReport'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'File', value: 'file' },
					{ name: 'Progress', value: 'progress' },
				],
				default: [],
				description: 'Additional objects to include in the response (JSON-API only)',
			},
		],
	},

	// ----------------------------------
	//         quizReport: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizReport'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Includes All Versions',
				name: 'includes_all_versions',
				type: 'boolean',
				default: false,
				description: 'Whether to retrieve reports that include all submission attempts',
			},
		],
	},
];
