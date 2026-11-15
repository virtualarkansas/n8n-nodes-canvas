import type { INodeProperties } from 'n8n-workflow';

export const questionBankOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['questionBank'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single question bank of classic quizzes',
				action: 'Get a question bank',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the question banks of a course or an account. Canvas does not page this list: every bank comes in one answer, whatever page size is set. It has no API to create or change question banks.',
				action: 'Get many question banks',
			},
			{
				name: 'List Questions',
				value: 'listQuestions',
				description: 'List the questions of a question bank with their answers',
				action: 'List questions of a question bank',
			},
		],
		default: 'getAll',
	},
];

const includeQuestionCount: INodeProperties = {
	displayName: 'Include Question Count',
	name: 'include_question_count',
	type: 'boolean',
	default: false,
	description: 'Whether to add the number of questions (assessment_question_count) to each question bank',
};

export const questionBankFields: INodeProperties[] = [
	// ----------------------------------
	//         questionBank: get, listQuestions
	// ----------------------------------
	{
		displayName: 'Question Bank ID',
		name: 'questionBankId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['questionBank'],
				operation: ['get', 'listQuestions'],
			},
		},
		description: 'The ID of the question bank. Canvas answers "unauthorized" rather than "not found" for an ID it does not know.',
	},

	// ----------------------------------
	//         questionBank: getAll
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['questionBank'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				name: 'Account',
				value: 'account',
			},
			{
				name: 'Course',
				value: 'course',
			},
		],
		description: 'Whether to list the question banks of a course or of an account',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['questionBank'],
				operation: ['getAll'],
				context: ['account'],
			},
		},
		description: 'The numeric ID of the account. This endpoint does not accept SIS IDs or "self".',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['questionBank'],
				operation: ['getAll'],
				context: ['course'],
			},
		},
		description: 'The numeric ID of the course. This endpoint does not accept SIS IDs.',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['questionBank'],
				operation: ['getAll', 'get'],
			},
		},
		options: [includeQuestionCount],
	},
];
