import type { INodeProperties } from 'n8n-workflow';

export const quizQuestionGroupOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['quizQuestionGroup'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new quiz question group',
				action: 'Create a quiz question group',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a quiz question group',
				action: 'Delete a quiz question group',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single quiz question group',
				action: 'Get a quiz question group',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many quiz question groups',
				action: 'Get many quiz question groups',
			},
			{
				name: 'Reorder',
				value: 'reorder',
				description: 'Reorder questions within a group',
				action: 'Reorder questions in a group',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a quiz question group',
				action: 'Update a quiz question group',
			},
		],
		default: 'getAll',
	},
];

export const quizQuestionGroupFields: INodeProperties[] = [
	// ----------------------------------
	//         quizQuestionGroup: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizQuestionGroup'],
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
				resource: ['quizQuestionGroup'],
			},
		},
		description: 'The ID of the quiz',
	},

	// ----------------------------------
	//         quizQuestionGroup: get, update, delete, reorder
	// ----------------------------------
	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizQuestionGroup'],
				operation: ['get', 'update', 'delete', 'reorder'],
			},
		},
		description: 'The ID of the quiz question group',
	},

	// ----------------------------------
	//         quizQuestionGroup: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['quizQuestionGroup'],
				operation: ['create'],
			},
		},
		description: 'The name of the question group',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizQuestionGroup'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Assessment Question Bank ID',
				name: 'assessment_question_bank_id',
				type: 'string',
				default: '',
				description: 'The ID of a question bank to link to this group',
			},
			{
				displayName: 'Pick Count',
				name: 'pick_count',
				type: 'number',
				default: 1,
				description: 'Number of questions to randomly select from this group',
			},
			{
				displayName: 'Question Points',
				name: 'question_points',
				type: 'number',
				default: 1,
				description: 'Points to assign to each question in this group',
			},
		],
	},

	// ----------------------------------
	//         quizQuestionGroup: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizQuestionGroup'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Assessment Question Bank ID',
				name: 'assessment_question_bank_id',
				type: 'string',
				default: '',
				description: 'The ID of a question bank to link to this group',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name of the question group',
			},
			{
				displayName: 'Pick Count',
				name: 'pick_count',
				type: 'number',
				default: 1,
				description: 'Number of questions to randomly select from this group',
			},
			{
				displayName: 'Question Points',
				name: 'question_points',
				type: 'number',
				default: 1,
				description: 'Points to assign to each question in this group',
			},
		],
	},

	// ----------------------------------
	//         quizQuestionGroup: reorder
	// ----------------------------------
	{
		displayName: 'Question Order',
		name: 'questionOrder',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Question',
		default: {},
		displayOptions: {
			show: {
				resource: ['quizQuestionGroup'],
				operation: ['reorder'],
			},
		},
		description: 'The questions to reorder within the group',
		options: [
			{
				name: 'questions',
				displayName: 'Question',
				values: [
					{
						displayName: 'Question ID',
						name: 'id',
						type: 'string',
						required: true,
						default: '',
						description: 'The ID of the question',
					},
				],
			},
		],
	},
];
