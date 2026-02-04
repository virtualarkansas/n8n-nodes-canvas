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
		description: 'The ID of the assignment linked to the quiz',
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
		options: [
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
		],
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
		description: 'Question-specific data structure (JSON object). Structure varies by interaction type.',
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
		description: 'Scoring configuration (JSON object). Defines correct answers and scoring rules.',
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
		options: [
			{
				name: 'All or Nothing',
				value: 'AllOrNothing',
				description: 'Full points only if completely correct',
			},
			{
				name: 'Equivalence',
				value: 'Equivalence',
				description: 'Standard scoring based on correct answer',
			},
			{
				name: 'Partial Credit',
				value: 'PartialCredit',
				description: 'Partial points for partially correct answers',
			},
		],
		description: 'The algorithm used for scoring responses',
	},

	// ----------------------------------
	//         newQuizItem: create - additional fields
	// ----------------------------------
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
		options: [
			{
				displayName: 'Points Possible',
				name: 'points_possible',
				type: 'number',
				default: 1,
				description: 'The point value for this item (must be positive)',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				description: 'The position of the item within the quiz',
			},
		],
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
		options: [
			{
				displayName: 'Interaction Data',
				name: 'interaction_data',
				type: 'json',
				default: '{}',
				description: 'Question-specific data structure (JSON object)',
			},
			{
				displayName: 'Interaction Type',
				name: 'interaction_type_slug',
				type: 'options',
				options: [
					{ name: 'Categorization', value: 'categorization' },
					{ name: 'Choice (Multiple Choice)', value: 'choice' },
					{ name: 'Essay', value: 'essay' },
					{ name: 'File Upload', value: 'file-upload' },
					{ name: 'Formula', value: 'formula' },
					{ name: 'Hot Spot', value: 'hot-spot' },
					{ name: 'Matching', value: 'matching' },
					{ name: 'Multi-Answer', value: 'multi-answer' },
					{ name: 'Numeric', value: 'numeric' },
					{ name: 'Ordering', value: 'ordering' },
					{ name: 'Rich Fill in the Blank', value: 'rich-fill-blank' },
					{ name: 'True/False', value: 'true-false' },
				],
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
				displayName: 'Points Possible',
				name: 'points_possible',
				type: 'number',
				default: 1,
				description: 'The point value for this item (must be positive)',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				description: 'The position of the item within the quiz',
			},
			{
				displayName: 'Scoring Algorithm',
				name: 'scoring_algorithm',
				type: 'options',
				options: [
					{ name: 'All or Nothing', value: 'AllOrNothing' },
					{ name: 'Equivalence', value: 'Equivalence' },
					{ name: 'Partial Credit', value: 'PartialCredit' },
				],
				default: 'Equivalence',
				description: 'The algorithm used for scoring responses',
			},
			{
				displayName: 'Scoring Data',
				name: 'scoring_data',
				type: 'json',
				default: '{}',
				description: 'Scoring configuration (JSON object)',
			},
		],
	},
];
