import type { INodeProperties } from 'n8n-workflow';

const READ_OPERATIONS = ['get', 'getAll', 'getUsedLocations'];
/** Operations that work on the rubrics of a course or of an account. */
const CONTEXT_OPERATIONS = [...READ_OPERATIONS, 'import', 'getImportStatus', 'listImportedRubrics'];
const COURSE_ONLY_OPERATIONS = [
	'create',
	'update',
	'delete',
	'createAssociation',
	'updateAssociation',
	'deleteAssociation',
	'createAssessment',
	'updateAssessment',
	'deleteAssessment',
];

export const rubricOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['rubric'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a rubric in a course',
				action: 'Create a rubric',
			},
			{
				name: 'Create Assessment',
				value: 'createAssessment',
				description: 'Assess a student with a rubric that is attached to an assignment',
				action: 'Create a rubric assessment',
			},
			{
				name: 'Create Association',
				value: 'createAssociation',
				description: 'Attach a rubric to an assignment, or bookmark it in a course',
				action: 'Create a rubric association',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a rubric from a course, together with its associations',
				action: 'Delete a rubric',
			},
			{
				name: 'Delete Assessment',
				value: 'deleteAssessment',
				description: 'Delete a rubric assessment',
				action: 'Delete a rubric assessment',
			},
			{
				name: 'Delete Association',
				value: 'deleteAssociation',
				description: 'Detach a rubric from an assignment or course',
				action: 'Delete a rubric association',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single rubric',
				action: 'Get a rubric',
			},
			{
				name: 'Get Import Status',
				value: 'getImportStatus',
				description: 'Get the state of a rubric import, with the errors Canvas found in the file. An import whose file is not valid CSV stays in the state "importing": look at the error count as well.',
				action: 'Get the status of a rubric import',
			},
			{
				name: 'Get Import Template',
				value: 'getImportTemplate',
				description: 'Get the CSV template Canvas offers for rubric imports: the header row and two example rows. The node outputs the CSV text in the field "value".',
				action: 'Get the rubric import template',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the rubrics of a course or an account',
				action: 'Get many rubrics',
			},
			{
				name: 'Get Used Locations',
				value: 'getUsedLocations',
				description: 'Get the courses and assignments that use a rubric',
				action: 'Get rubric used locations',
			},
			{
				name: 'Import',
				value: 'import',
				description: 'Create rubrics in a course or an account from CSV. Canvas works in the background and the node outputs the import record: poll it with Get Import Status. The rubrics are created as drafts.',
				action: 'Import rubrics from CSV',
			},
			{
				name: 'List Imported Rubrics',
				value: 'listImportedRubrics',
				description: 'List the rubrics an import created. Imported rubrics are drafts, which Get Many leaves out, so this is where their IDs come from.',
				action: 'List the rubrics of an import',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Replace the title and criteria of a rubric',
				action: 'Update a rubric',
			},
			{
				name: 'Update Assessment',
				value: 'updateAssessment',
				description: 'Change an existing rubric assessment',
				action: 'Update a rubric assessment',
			},
			{
				name: 'Update Association',
				value: 'updateAssociation',
				description: 'Change how a rubric is used by an assignment or course',
				action: 'Update a rubric association',
			},
		],
		default: 'getAll',
	},
];

/** The Criteria collection of Create and Update. */
function criteriaField(): INodeProperties {
	return {
		displayName: 'Criteria',
		name: 'criteria',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		required: true,
		default: {},
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['create', 'update'],
			},
		},
		placeholder: 'Add Criterion',
		description: 'The criteria (rows) of the rubric',
		options: [
			{
				displayName: 'Criterion',
				name: 'criterion',
				values: [
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						required: true,
						default: '',
						description: 'Short description (the name) of the criterion',
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						default: '',
						description:
							'ID of an existing criterion to keep (rubric update), so assessments that refer to it stay valid. Leave empty to let Canvas create one.',
					},
					{
						displayName: 'Ignore for Scoring',
						name: 'ignore_for_scoring',
						type: 'boolean',
						default: false,
						description:
							'Whether an outcome criterion is left out of the total points of the rubric (only with a Learning Outcome ID)',
					},
					{
						displayName: 'Learning Outcome ID',
						name: 'learning_outcome_id',
						type: 'string',
						default: '',
						description:
							'ID of an outcome to align the criterion with. Assessments of the criterion then count as results of the outcome. When the account uses mastery scales Canvas replaces the ratings by the proficiency ratings.',
					},
					{
						displayName: 'Long Description',
						name: 'long_description',
						type: 'string',
						default: '',
						description: 'Longer description of the criterion',
					},
					{
						displayName: 'Points',
						name: 'points',
						type: 'number',
						required: true,
						default: 0,
						description:
							'The points of the criterion when no ratings are given: the ratings "Full Marks" (these points) and "No Marks" (0) are created. With ratings, Canvas uses the highest rating as the points of the criterion.',
					},
					{
						displayName: 'Ratings',
						name: 'ratings',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						placeholder: 'Add Rating',
						description: 'The levels of the criterion. Canvas sorts them from most to fewest points.',
						options: [
							{
								displayName: 'Rating',
								name: 'rating',
								values: [
									{
										displayName: 'Description',
										name: 'description',
										type: 'string',
										default: '',
										description: 'Name of the rating, for example "Excellent"',
									},
									{
										displayName: 'Points',
										name: 'points',
										type: 'number',
										default: 0,
										description: 'Points awarded for this rating',
									},
									{
										displayName: 'Long Description',
										name: 'long_description',
										type: 'string',
										default: '',
										description: 'What a student has to show to earn this rating',
									},
									{
										displayName: 'ID',
										name: 'id',
										type: 'string',
										default: '',
										description:
											'ID of an existing rating to keep (rubric update). Leave empty to let Canvas create one.',
									},
								],
							},
						],
					},
					{
						displayName: 'Use Range',
						name: 'criterion_use_range',
						type: 'boolean',
						default: false,
						description: 'Whether each rating covers a range of points instead of a single value',
					},
				],
			},
		],
	};
}

/** Association settings shared by Create (additional fields) and Update (options). */
const associationOptions: INodeProperties[] = [
	{
		displayName: 'Association ID',
		name: 'rubric_association_association_id',
		type: 'string',
		default: '',
		description:
			'ID of the assignment (or course or account) to associate the rubric with. Leave empty to use the course itself.',
	},
	{
		displayName: 'Association Type',
		name: 'rubric_association_association_type',
		type: 'options',
		options: [
			{ name: 'Account', value: 'Account' },
			{ name: 'Assignment', value: 'Assignment' },
			{ name: 'Course', value: 'Course' },
		],
		default: 'Assignment',
		description: 'What the Association ID refers to',
	},
	{
		displayName: 'Free Form Criterion Comments',
		name: 'free_form_criterion_comments',
		type: 'boolean',
		default: false,
		description: 'Whether graders write free-form comments instead of picking ratings',
	},
	{
		displayName: 'Hide Score Total',
		name: 'rubric_association_hide_score_total',
		type: 'boolean',
		default: false,
		description: 'Whether the total score of the rubric is hidden from students',
	},
	{
		displayName: 'Purpose',
		name: 'rubric_association_purpose',
		type: 'options',
		options: [
			{
				name: 'Bookmark',
				value: 'bookmark',
				description: 'Keep the rubric in the rubric list of the course',
			},
			{
				name: 'Grading',
				value: 'grading',
				description: 'Use the rubric to assess the assignment',
			},
		],
		default: 'grading',
		description:
			'What the association is for. Defaults to Grading for an assignment and Bookmark otherwise.',
	},
	{
		displayName: 'Use for Grading',
		name: 'rubric_association_use_for_grading',
		type: 'boolean',
		default: false,
		description: 'Whether the rubric score becomes the grade of the assignment',
	},
];

/** The assessed criteria of Create Assessment and Update Assessment. */
function criterionAssessmentsField(): INodeProperties {
	return {
		displayName: 'Criteria',
		name: 'criterionAssessments',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['createAssessment', 'updateAssessment'],
			},
		},
		placeholder: 'Add Criterion',
		description: 'The points and comments per criterion. Criteria that are not listed stay unassessed.',
		options: [
			{
				displayName: 'Criterion',
				name: 'criterion',
				values: [
					{
						displayName: 'Comments',
						name: 'comments',
						type: 'string',
						default: '',
						description: 'Comment on the criterion',
					},
					{
						displayName: 'Criterion ID',
						name: 'criterion_id',
						type: 'string',
						required: true,
						default: '',
						description: 'The ID of the criterion as returned by the Get operation (for example "_1234")',
					},
					{
						displayName: 'Points',
						name: 'points',
						type: 'number',
						default: 0,
						description: 'Points awarded for the criterion',
					},
					{
						displayName: 'Rating ID',
						name: 'rating_id',
						type: 'string',
						default: '',
						description:
							'ID of the selected rating. Leave empty to let Canvas pick the rating that matches the points.',
					},
					{
						displayName: 'Save Comment',
						name: 'save_comment',
						type: 'boolean',
						default: false,
						description: 'Whether to keep the comment for reuse on other assessments of the rubric',
					},
				],
			},
		],
	};
}

export const rubricFields: INodeProperties[] = [
	// ----------------------------------
	//         rubric: context selection (read operations)
	// ----------------------------------
	{
		displayName: 'Context',
		name: 'context',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: CONTEXT_OPERATIONS,
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
		default: 'course',
		description:
			'Whether the rubrics belong to a course or to an account. Account rubrics can be read and imported from CSV; Canvas has no API to create them one by one, change or delete them.',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: CONTEXT_OPERATIONS,
				context: ['account'],
			},
		},
		description: 'ID of the account',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: CONTEXT_OPERATIONS,
				context: ['course'],
			},
		},
		description: 'ID of the course',
	},

	// ----------------------------------
	//         rubric: import
	// ----------------------------------
	{
		displayName: 'CSV Data',
		name: 'csvData',
		type: 'string',
		typeOptions: {
			rows: 10,
		},
		required: true,
		default: '',
		placeholder:
			'Rubric Name,Criteria Name,Criteria Description,Criteria Enable Range,Rating Name,Rating Description,Rating Points',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['import'],
			},
		},
		description:
			'The rubrics to import, as CSV text in the Canvas rubric format: one row per criterion with the columns Rubric Name, Criteria Name, Criteria Description, Criteria Enable Range, followed by Rating Name, Rating Description, Rating Points once per rating (see Get Import Template). Rows with the same Rubric Name form one rubric. For a CSV file from a previous node, use Extract From File first.',
	},
	{
		displayName: 'Import ID',
		name: 'importId',
		type: 'string',
		required: true,
		default: 'latest',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['getImportStatus'],
			},
		},
		description: 'The ID of the rubric import, or "latest" for the most recent import of the course or account',
	},
	{
		displayName: 'Import ID',
		name: 'importId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['listImportedRubrics'],
			},
		},
		description: 'The ID of the rubric import (see Import and Get Import Status). An ID Canvas does not know in the course or account gives an empty list.',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: COURSE_ONLY_OPERATIONS,
			},
		},
		description: 'ID of the course',
	},

	// ----------------------------------
	//         rubric: rubric ID
	// ----------------------------------
	{
		displayName: 'Rubric ID',
		name: 'rubricId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['delete', 'get', 'getUsedLocations', 'update', 'createAssociation'],
			},
		},
		description: 'ID of the rubric',
	},

	// ----------------------------------
	//         rubric: create / update
	// ----------------------------------
	{
		displayName:
			'Canvas replaces the whole rubric on update: send the title and every criterion that should remain. A rubric that is used in more than one place is not changed; Canvas creates a copy with the changes and returns that copy.',
		name: 'updateNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['update'],
			},
		},
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['create', 'update'],
			},
		},
		description: 'Title of the rubric',
	},
	criteriaField(),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['create'],
			},
		},
		description:
			'Unless an association is set here, the rubric is bookmarked in its course so that it shows up in the rubric list of the course',
		options: associationOptions,
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['update'],
			},
		},
		options: [
			...associationOptions.slice(0, 5),
			{
				displayName: 'Rubric Association ID',
				name: 'rubric_association_id',
				type: 'string',
				default: '',
				description:
					'ID of an existing association of the rubric to update with the association options. When Canvas creates a copy of a shared rubric, this association is pointed at the copy.',
			},
			{
				displayName: 'Skip Updating Points Possible',
				name: 'skip_updating_points_possible',
				type: 'boolean',
				default: false,
				description:
					'Whether to leave the points of the associated assignment as they are when the rubric is used for grading',
			},
			associationOptions[5],
		],
	},

	// ----------------------------------
	//         rubric: get
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include Assessments',
				name: 'include_assessments',
				type: 'options',
				options: [
					{ name: 'All Assessments', value: 'assessments' },
					{ name: 'Graded Assessments', value: 'graded_assessments' },
					{ name: 'None', value: 'none' },
					{ name: 'Peer Assessments', value: 'peer_assessments' },
				],
				default: 'assessments',
				description: 'Which assessments made with the rubric to return with it',
			},
			{
				displayName: 'Include Associations',
				name: 'include_associations',
				type: 'options',
				options: [
					{ name: 'Account Associations', value: 'account_associations' },
					{ name: 'All Associations', value: 'associations' },
					{ name: 'Assignment Associations', value: 'assignment_associations' },
					{ name: 'Course Associations', value: 'course_associations' },
					{ name: 'None', value: 'none' },
				],
				default: 'associations',
				description: 'Which associations (uses) of the rubric to return with it',
			},
			{
				displayName: 'Style',
				name: 'style',
				type: 'options',
				options: [
					{
						name: 'Comments Only',
						value: 'comments_only',
						description: 'Included assessments carry only their comments',
					},
					{
						name: 'Full',
						value: 'full',
						description: 'Included assessments carry all their data',
					},
				],
				default: 'full',
				description: 'How much of the included assessments to return (applies with Include Assessments)',
			},
		],
	},

	// ----------------------------------
	//         rubric: associations
	// ----------------------------------
	{
		displayName: 'Rubric Association ID',
		name: 'rubricAssociationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: [
					'updateAssociation',
					'deleteAssociation',
					'createAssessment',
					'updateAssessment',
					'deleteAssessment',
				],
			},
		},
		description:
			'ID of the rubric association (returned by Create Association, by Create, or by Get with Include Associations)',
	},
	{
		displayName: 'Association Type',
		name: 'associationType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['createAssociation'],
			},
		},
		options: [
			{
				name: 'Assignment',
				value: 'Assignment',
				description: 'Attach the rubric to an assignment of the course',
			},
			{
				name: 'Course',
				value: 'Course',
				description: 'Bookmark the rubric in the rubric list of the course',
			},
		],
		default: 'Assignment',
		description: 'What to associate the rubric with',
	},
	{
		displayName: 'Association ID',
		name: 'associationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['createAssociation'],
			},
		},
		description: 'Numeric ID of the assignment or course to associate the rubric with',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['createAssociation'],
			},
		},
		options: [
			{
				displayName: 'Bookmarked',
				name: 'bookmarked',
				type: 'boolean',
				default: true,
				description: 'Whether the rubric shows up in the rubric list of the course',
			},
			{
				displayName: 'Hide Score Total',
				name: 'hide_score_total',
				type: 'boolean',
				default: false,
				description: 'Whether the total score of the rubric is hidden from students',
			},
			{
				displayName: 'Purpose',
				name: 'purpose',
				type: 'options',
				options: [
					{
						name: 'Bookmark',
						value: 'bookmark',
						description: 'Keep the rubric in the rubric list of the course',
					},
					{
						name: 'Grading',
						value: 'grading',
						description: 'Use the rubric to assess the assignment',
					},
				],
				default: 'grading',
				description: 'What the association is for',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'Title of the association (Canvas shows the name of the assignment by default)',
			},
			{
				displayName: 'Use for Grading',
				name: 'use_for_grading',
				type: 'boolean',
				default: false,
				description: 'Whether the rubric score becomes the grade of the assignment',
			},
		],
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['updateAssociation'],
			},
		},
		options: [
			{
				displayName: 'Bookmarked',
				name: 'bookmarked',
				type: 'boolean',
				default: true,
				description: 'Whether the rubric shows up in the rubric list of the course',
			},
			{
				displayName: 'Hide Score Total',
				name: 'hide_score_total',
				type: 'boolean',
				default: false,
				description: 'Whether the total score of the rubric is hidden from students',
			},
			{
				displayName: 'Purpose',
				name: 'purpose',
				type: 'options',
				options: [
					{
						name: 'Bookmark',
						value: 'bookmark',
						description: 'Keep the rubric in the rubric list of the course',
					},
					{
						name: 'Grading',
						value: 'grading',
						description: 'Use the rubric to assess the assignment',
					},
				],
				default: 'grading',
				description: 'What the association is for',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'Title of the association',
			},
			{
				displayName: 'Use for Grading',
				name: 'use_for_grading',
				type: 'boolean',
				default: false,
				description: 'Whether the rubric score becomes the grade of the assignment',
			},
		],
	},

	// ----------------------------------
	//         rubric: assessments
	// ----------------------------------
	{
		displayName: 'Rubric Assessment ID',
		name: 'rubricAssessmentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['updateAssessment', 'deleteAssessment'],
			},
		},
		description: 'ID of the rubric assessment',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['createAssessment', 'updateAssessment'],
			},
		},
		description: 'ID of the student who is assessed',
	},
	{
		displayName: 'Assessment Type',
		name: 'assessmentType',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['createAssessment', 'updateAssessment'],
			},
		},
		options: [
			{
				name: 'Grading',
				value: 'grading',
				description: 'An assessment by a grader. Sets the grade when the rubric is used for grading.',
			},
			{
				name: 'Peer Review',
				value: 'peer_review',
				description: 'An assessment by a student who was asked to review the submission',
			},
			{
				name: 'Provisional Grade',
				value: 'provisional_grade',
				description: 'An assessment of a moderated assignment (set the Provisional option as well)',
			},
		],
		default: 'grading',
		description: 'The kind of assessment',
	},
	criterionAssessmentsField(),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['rubric'],
				operation: ['createAssessment', 'updateAssessment'],
			},
		},
		options: [
			{
				displayName: 'Final',
				name: 'final',
				type: 'boolean',
				default: false,
				description: 'Whether a provisional assessment is the final grader\'s own assessment',
			},
			{
				displayName: 'Graded Anonymously',
				name: 'graded_anonymously',
				type: 'boolean',
				default: false,
				description: 'Whether the assessment was made without knowing who the student is',
			},
			{
				displayName: 'Provisional',
				name: 'provisional',
				type: 'boolean',
				default: false,
				description: 'Whether this is a provisional assessment of a moderated assignment',
			},
		],
	},
];
