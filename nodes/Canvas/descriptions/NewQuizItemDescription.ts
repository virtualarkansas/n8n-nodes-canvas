import type { INodeProperties } from 'n8n-workflow';

export const newQuizItemOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['newQuizItem'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new quiz item',
				action: 'Create a new quiz item',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a quiz item',
				action: 'Delete a new quiz item',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single quiz item',
				action: 'Get a new quiz item',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many quiz items',
				action: 'Get many new quiz items',
			},
			{
				name: 'Get Media Upload URL',
				value: 'getMediaUploadUrl',
				description: 'Get a presigned URL for uploading media',
				action: 'Get media upload URL for new quiz item',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a quiz item',
				action: 'Update a new quiz item',
			},
		],
		default: 'getAll',
	},
];

const interactionTypes = [
	{
		name: 'Categorization',
		value: 'categorization',
		description: 'Drag items into categories',
	},
	{
		name: 'Choice (Multiple Choice)',
		value: 'choice',
		description: 'Select one answer from multiple options',
	},
	{
		name: 'Essay',
		value: 'essay',
		description: 'Free-form text response',
	},
	{
		name: 'File Upload',
		value: 'file-upload',
		description: 'Upload a file as the answer',
	},
	{
		name: 'Formula',
		value: 'formula',
		description: 'Mathematical formula question',
	},
	{
		name: 'Hot Spot',
		value: 'hot-spot',
		description: 'Click on an image region',
	},
	{
		name: 'Matching',
		value: 'matching',
		description: 'Match items from two lists',
	},
	{
		name: 'Multi-Answer',
		value: 'multi-answer',
		description: 'Select multiple correct answers',
	},
	{
		name: 'Numeric',
		value: 'numeric',
		description: 'Enter a numeric value',
	},
	{
		name: 'Ordering',
		value: 'ordering',
		description: 'Arrange items in correct order',
	},
	{
		name: 'Rich Fill in the Blank',
		value: 'rich-fill-blank',
		description: 'Fill in blanks within rich text',
	},
	{
		name: 'True/False',
		value: 'true-false',
		description: 'Select true or false',
	},
];

/** The scoring algorithms of the New Quizzes API and the question types they belong to. */
const scoringAlgorithms = [
	{ name: 'All or Nothing', value: 'AllOrNothing', description: 'Multi-Answer' },
	{ name: 'Categorization', value: 'Categorization', description: 'Categorization questions' },
	{ name: 'Deep Equals', value: 'DeepEquals', description: 'Matching, Ordering' },
	{ name: 'Equivalence', value: 'Equivalence', description: 'True/False, Choice' },
	{ name: 'Hot Spot', value: 'HotSpot', description: 'Hot Spot questions' },
	{ name: 'Multiple Methods', value: 'MultipleMethods', description: 'Rich Fill in the Blank' },
	{ name: 'None', value: 'None', description: 'Essay, File Upload (graded manually)' },
	{ name: 'Numeric', value: 'Numeric', description: 'Numeric, Formula' },
	{ name: 'Partial Deep', value: 'PartialDeep', description: 'Matching with partial credit' },
	{ name: 'Partial Score', value: 'PartialScore', description: 'Multi-Answer with partial credit' },
	{
		name: 'Vary Points by Answer',
		value: 'VaryPointsByAnswer',
		description: 'Choice with points per answer',
	},
];

/**
 * Optional fields accepted by both "Create" and "Update". The handler puts them
 * where the API expects them: item[...] for points and position, item[entry][...]
 * for everything that describes the question.
 */
const itemSettings: INodeProperties[] = [
	{
		displayName: 'Answer Feedback',
		name: 'answer_feedback',
		type: 'json',
		default: '{}',
		description:
			'JSON object with feedback per answer (rich content), keyed by the ID of the choice. Only for the Choice type.',
	},
	{
		displayName: 'Calculator Type',
		name: 'calculator_type',
		type: 'options',
		options: [
			{ name: 'None', value: 'none' },
			{ name: 'Basic', value: 'basic' },
			{ name: 'Scientific', value: 'scientific' },
		],
		default: 'none',
		description: 'Which calculator students can use for this question',
	},
	{
		displayName: 'Feedback (Correct)',
		name: 'feedback_correct',
		type: 'string',
		default: '',
		description: 'Feedback shown when the question is answered correctly (rich content)',
	},
	{
		displayName: 'Feedback (Incorrect)',
		name: 'feedback_incorrect',
		type: 'string',
		default: '',
		description: 'Feedback shown when the question is answered incorrectly (rich content)',
	},
	{
		displayName: 'Feedback (Neutral)',
		name: 'feedback_neutral',
		type: 'string',
		default: '',
		description: 'General feedback shown regardless of the answer (rich content)',
	},
	{
		displayName: 'Points Possible',
		name: 'points_possible',
		type: 'number',
		default: 1,
		description: 'Points available for this item. Must be positive.',
	},
	{
		displayName: 'Position',
		name: 'position',
		type: 'number',
		typeOptions: {
			minValue: 1,
		},
		default: 1,
		description: 'Position of the item within the quiz. The first item has position 1.',
	},
	{
		displayName: 'Properties',
		name: 'properties',
		type: 'json',
		default: '{}',
		description:
			'JSON object with additional properties some question types use (for example shuffleRules or varyPointsByAnswer for Choice)',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		description: 'The question title',
	},
];

const sortedByDisplayName = (fields: INodeProperties[]): INodeProperties[] =>
	[...fields].sort((a, b) => a.displayName.localeCompare(b.displayName));

export const newQuizItemFields: INodeProperties[] = [
	// ----------------------------------
	//         newQuizItem: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['newQuizItem'],
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
				resource: ['newQuizItem'],
			},
		},
		description:
			'The ID of the assignment linked to the quiz. New Quizzes are addressed by the ID of their assignment.',
	},

	// ----------------------------------
	//         newQuizItem: get, update, delete
	// ----------------------------------
	{
		displayName: 'Item ID',
		name: 'itemId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['newQuizItem'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The ID of the quiz item',
	},

	// ----------------------------------
	//         newQuizItem: create
	// ----------------------------------
	{
		displayName: 'Item Body',
		name: 'itemBody',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['newQuizItem'],
				operation: ['create'],
			},
		},
		description: 'The question stem/body (supports HTML/rich content)',
	},
	{
		displayName: 'Interaction Type',
		name: 'interactionType',
		type: 'options',
		required: true,
		default: 'choice',
		displayOptions: {
			show: {
				resource: ['newQuizItem'],
				operation: ['create'],
			},
		},
		options: interactionTypes,
		description: 'The type of question/interaction',
	},
	{
		displayName: 'Interaction Data',
		name: 'interactionData',
		type: 'json',
		required: true,
		default: '{}',
		displayOptions: {
			show: {
				resource: ['newQuizItem'],
				operation: ['create'],
			},
		},
		description:
			'JSON object with the question data. Its structure depends on the interaction type (see "Appendix: Question Types" of the New Quiz Items API); Numeric and Formula questions take an empty object.',
	},
	{
		displayName: 'Scoring Data',
		name: 'scoringData',
		type: 'json',
		required: true,
		default: '{}',
		displayOptions: {
			show: {
				resource: ['newQuizItem'],
				operation: ['create'],
			},
		},
		description:
			'JSON object describing how to score the question, usually {"value": ...}. Its structure depends on the interaction type.',
	},
	{
		displayName: 'Scoring Algorithm',
		name: 'scoringAlgorithm',
		type: 'options',
		required: true,
		default: 'Equivalence',
		displayOptions: {
			show: {
				resource: ['newQuizItem'],
				operation: ['create'],
			},
		},
		options: scoringAlgorithms,
		description:
			'The algorithm used to score the question. Which ones are valid depends on the interaction type.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['newQuizItem'],
				operation: ['create'],
			},
		},
		options: itemSettings,
	},

	// ----------------------------------
	//         newQuizItem: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['newQuizItem'],
				operation: ['update'],
			},
		},
		options: sortedByDisplayName([
			...itemSettings,
			{
				displayName: 'Interaction Data',
				name: 'interaction_data',
				type: 'json',
				default: '{}',
				description:
					'JSON object with the question data. Its structure depends on the interaction type.',
			},
			{
				displayName: 'Interaction Type',
				name: 'interaction_type_slug',
				type: 'options',
				options: interactionTypes,
				default: 'choice',
				description: 'The type of question/interaction',
			},
			{
				displayName: 'Item Body',
				name: 'item_body',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The question stem/body (supports HTML/rich content)',
			},
			{
				displayName: 'Scoring Algorithm',
				name: 'scoring_algorithm',
				type: 'options',
				options: scoringAlgorithms,
				default: 'Equivalence',
				description: 'The algorithm used to score the question',
			},
			{
				displayName: 'Scoring Data',
				name: 'scoring_data',
				type: 'json',
				default: '{}',
				description: 'JSON object describing how to score the question',
			},
		]),
	},
];
