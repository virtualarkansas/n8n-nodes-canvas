import type { INodeProperties } from 'n8n-workflow';

export const liveAssessmentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['liveAssessment'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a live assessment, or find the existing one with the same key',
				action: 'Create or find a live assessment',
			},
			{
				name: 'Create Results',
				value: 'createResults',
				description: 'Record pass or fail results for students in a live assessment',
				action: 'Create live assessment results',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the live assessments of a course',
				action: 'Get many live assessments',
			},
			{
				name: 'Get Results',
				value: 'getResults',
				description: 'List the results recorded in a live assessment',
				action: 'Get live assessment results',
			},
		],
		default: 'getAll',
	},
];

export const liveAssessmentFields: INodeProperties[] = [
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['liveAssessment'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Assessment ID',
		name: 'assessmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['liveAssessment'],
				operation: ['createResults', 'getResults'],
			},
		},
		description: 'The ID of the live assessment',
	},
	{
		displayName: 'Key',
		name: 'key',
		type: 'string',
		required: true,
		default: '',
		placeholder: '2026-05-27-Outcome-52',
		displayOptions: {
			show: {
				resource: ['liveAssessment'],
				operation: ['create'],
			},
		},
		description: 'A key that identifies the assessment. If an assessment with this key exists in the course it is returned instead of a new one being created.',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['liveAssessment'],
				operation: ['create'],
			},
		},
		description: 'A human readable title',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['liveAssessment'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Outcome ID',
				name: 'outcome_id',
				type: 'string',
				default: '',
				description: 'The ID of a learning outcome to align the assessment with',
			},
		],
	},
	{
		displayName: 'Results',
		name: 'results',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Result',
		default: {},
		displayOptions: {
			show: {
				resource: ['liveAssessment'],
				operation: ['createResults'],
			},
		},
		description: 'One result per student',
		options: [
			{
				displayName: 'Result',
				name: 'result',
				values: [
					{
						displayName: 'Assessed At',
						name: 'assessed_at',
						type: 'dateTime',
						default: '',
						description: 'When the student was assessed. Defaults to now.',
					},
					{
						displayName: 'Passed',
						name: 'passed',
						type: 'boolean',
						default: true,
						description: 'Whether the student passed',
					},
					{
						displayName: 'User ID',
						name: 'user_id',
						type: 'string',
						default: '',
						description: 'The ID of the student',
					},
				],
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
				resource: ['liveAssessment'],
				operation: ['getResults'],
			},
		},
		options: [
			{
				displayName: 'User ID',
				name: 'user_id',
				type: 'string',
				default: '',
				description: 'Only return results for this student',
			},
		],
	},
];
