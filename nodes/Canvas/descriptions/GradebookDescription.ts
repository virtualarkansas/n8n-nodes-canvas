import type { INodeProperties } from 'n8n-workflow';

export const gradebookOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['gradebook'],
			},
		},
		options: [
			{
				name: 'Apply Score to Ungraded',
				value: 'applyScoreToUngraded',
				description:
					'Give every ungraded submission of the chosen assignments and students the same score, or excuse it, in one background job (returns a Progress)',
				action: 'Apply a score to ungraded submissions',
			},
			{
				name: 'Update Final Grade Overrides',
				value: 'updateFinalGradeOverrides',
				description:
					'Set or remove the final grade override of many students in one background job (returns a Progress)',
				action: 'Update final grade overrides',
			},
		],
		default: 'applyScoreToUngraded',
	},
];

export const gradebookFields: INodeProperties[] = [
	{
		displayName:
			'Canvas grades in a background job: the output is its Progress object, which the Progress resource can poll. Problems with single students are listed in the "results" of the finished Progress.',
		name: 'gradebookNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['gradebook'],
			},
		},
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['gradebook'],
			},
		},
		description: 'The ID of the course. Also accepts SIS IDs in the form "sis_course_id:XYZ".',
	},

	// ----------------------------------
	//         gradebook: applyScoreToUngraded
	// ----------------------------------
	{
		displayName: 'Assignment IDs',
		name: 'assignmentIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: '101,102',
		displayOptions: {
			show: {
				resource: ['gradebook'],
				operation: ['applyScoreToUngraded'],
			},
		},
		description:
			'Comma-separated list of the assignments whose ungraded submissions are graded. Assignments that are not graded are skipped.',
	},
	{
		displayName: 'Student IDs',
		name: 'studentIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: '2001,2002',
		displayOptions: {
			show: {
				resource: ['gradebook'],
				operation: ['applyScoreToUngraded'],
			},
		},
		description: 'Comma-separated list of the user IDs of the students whose ungraded submissions are graded',
	},
	{
		displayName: 'Grade',
		name: 'grade',
		type: 'options',
		options: [
			{
				name: 'Excused',
				value: 'excused',
				description: 'Excuse the ungraded submissions',
			},
			{
				name: 'Percent Score',
				value: 'percent',
				description: "Give each ungraded submission a percentage of its assignment's points",
			},
		],
		default: 'percent',
		displayOptions: {
			show: {
				resource: ['gradebook'],
				operation: ['applyScoreToUngraded'],
			},
		},
		description:
			'What to give the ungraded submissions. Submissions that already have a grade or are excused are never changed.',
	},
	{
		displayName: 'Percent',
		name: 'percent',
		type: 'number',
		typeOptions: {
			minValue: 0,
			maxValue: 100,
			numberPrecision: 2,
		},
		required: true,
		default: 0,
		displayOptions: {
			show: {
				resource: ['gradebook'],
				operation: ['applyScoreToUngraded'],
				grade: ['percent'],
			},
		},
		description:
			'The score as a percentage (0-100) of the points each assignment is worth: 50 gives 5 points on an assignment worth 10',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['gradebook'],
				operation: ['applyScoreToUngraded'],
			},
		},
		options: [
			{
				displayName: 'Mark as Missing',
				name: 'mark_as_missing',
				type: 'boolean',
				default: false,
				description: 'Whether to also give the affected submissions the status "Missing"',
			},
			{
				displayName: 'Only Past Due',
				name: 'only_past_due',
				type: 'boolean',
				default: false,
				description:
					'Whether to leave out submissions that are not due yet (and those of assignments without a due date)',
			},
		],
	},

	// ----------------------------------
	//         gradebook: updateFinalGradeOverrides
	// ----------------------------------
	{
		displayName:
			'Final grade overrides need the "Final Grade Override" feature of the course to be on and the course setting "Allow Final Grade Override" to be enabled (Course > Update Settings); otherwise Canvas refuses with 403.',
		name: 'finalGradeOverrideNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['gradebook'],
				operation: ['updateFinalGradeOverrides'],
			},
		},
	},
	{
		displayName: 'Override Scores',
		name: 'overrideScores',
		type: 'fixedCollection',
		placeholder: 'Add Override Score',
		required: true,
		default: {},
		displayOptions: {
			show: {
				resource: ['gradebook'],
				operation: ['updateFinalGradeOverrides'],
			},
		},
		typeOptions: {
			multipleValues: true,
		},
		options: [
			{
				displayName: 'Override Score',
				name: 'score',
				values: [
					{
						displayName: 'Student ID',
						name: 'student_id',
						type: 'string',
						required: true,
						default: '',
						description: 'The user ID of the student. Students who are not enrolled in the course are skipped.',
					},
					{
						displayName: 'Override Score',
						name: 'override_score',
						type: 'number',
						typeOptions: {
							numberPrecision: 2,
						},
						default: 0,
						description:
							'The final grade to show instead of the calculated one, as a percentage (87.5 for 87.5%)',
					},
					{
						displayName: 'Remove Override',
						name: 'remove',
						type: 'boolean',
						default: false,
						description:
							'Whether to remove the override of this student, so that the calculated grade applies again (the Override Score is ignored)',
					},
				],
			},
		],
		description: 'The final grade overrides to set, one entry per student',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['gradebook'],
				operation: ['updateFinalGradeOverrides'],
			},
		},
		options: [
			{
				displayName: 'Grading Period ID',
				name: 'grading_period_id',
				type: 'string',
				default: '',
				description:
					'Override the grades of this grading period. Without this option the total grades of the course are overridden.',
			},
		],
	},
];
