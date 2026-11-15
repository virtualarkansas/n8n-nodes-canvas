import type { INodeProperties } from 'n8n-workflow';

export const moderatedGradingOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['moderatedGrading'],
			},
		},
		options: [
			{
				name: 'Bulk Select Provisional Grades',
				value: 'bulkSelectProvisionalGrades',
				description: 'Bulk select provisional grades for students',
				action: 'Bulk select provisional grades',
			},
			{
				name: 'Get Provisional Grade Status',
				value: 'getProvisionalGradeStatus',
				description: 'Check if a submission needs additional provisional grades',
				action: 'Get provisional grade status',
			},
			{
				name: 'List Moderated Students',
				value: 'listModeratedStudents',
				description: 'List students selected for moderated grading',
				action: 'List moderated students',
			},
			{
				name: 'Publish Provisional Grades',
				value: 'publishProvisionalGrades',
				description: 'Publish the selected provisional grades for all submissions',
				action: 'Publish provisional grades',
			},
			{
				name: 'Select Provisional Grade',
				value: 'selectProvisionalGrade',
				description: 'Select which provisional grade a student will receive',
				action: 'Select a provisional grade',
			},
			{
				name: 'Select Students for Moderation',
				value: 'selectStudentsForModeration',
				description: 'Add students to the moderation set',
				action: 'Select students for moderation',
			},
		],
		default: 'listModeratedStudents',
	},
];

export const moderatedGradingFields: INodeProperties[] = [
	// ----------------------------------
	//         moderatedGrading: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moderatedGrading'],
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
				resource: ['moderatedGrading'],
			},
		},
		description: 'The ID of the assignment with moderated grading enabled',
	},

	// ----------------------------------
	//         moderatedGrading: selectStudentsForModeration
	// ----------------------------------
	{
		displayName: 'Student IDs',
		name: 'studentIds',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moderatedGrading'],
				operation: ['selectStudentsForModeration'],
			},
		},
		description: 'Comma-separated list of student user IDs to add to the moderation set',
	},

	// ----------------------------------
	//         moderatedGrading: getProvisionalGradeStatus
	// ----------------------------------
	{
		displayName: 'Identification Method',
		name: 'identificationMethod',
		type: 'options',
		required: true,
		default: 'studentId',
		displayOptions: {
			show: {
				resource: ['moderatedGrading'],
				operation: ['getProvisionalGradeStatus'],
			},
		},
		options: [
			{
				name: 'Student ID',
				value: 'studentId',
				description: 'Identify student by user ID',
			},
			{
				name: 'Anonymous ID',
				value: 'anonymousId',
				description: 'Identify student by anonymous ID',
			},
		],
		description: 'How to identify the student',
	},
	{
		displayName: 'Student ID',
		name: 'studentId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moderatedGrading'],
				operation: ['getProvisionalGradeStatus'],
				identificationMethod: ['studentId'],
			},
		},
		description: 'The ID of the student',
	},
	{
		displayName: 'Anonymous ID',
		name: 'anonymousId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moderatedGrading'],
				operation: ['getProvisionalGradeStatus'],
				identificationMethod: ['anonymousId'],
			},
		},
		description: 'The anonymous ID of the student submission',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['moderatedGrading'],
				operation: ['getProvisionalGradeStatus'],
			},
		},
		options: [
			{
				displayName: 'Last Updated At',
				name: 'last_updated_at',
				type: 'dateTime',
				default: '',
				description:
					'The time the caller last saw the submission change. Canvas only adds the provisional grades (with their IDs, scores and which one is selected) to the result when this is set and differs from the submission\'s current update time, so any older date returns them. Requires the final grader or an admin who may select final grades.',
			},
		],
	},

	// ----------------------------------
	//         moderatedGrading: selectProvisionalGrade
	// ----------------------------------
	{
		displayName: 'Provisional Grade ID',
		name: 'provisionalGradeId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['moderatedGrading'],
				operation: ['selectProvisionalGrade'],
			},
		},
		description: 'The ID of the provisional grade to select',
	},

	// ----------------------------------
	//         moderatedGrading: bulkSelectProvisionalGrades
	// ----------------------------------
	{
		displayName: 'Provisional Grade IDs',
		name: 'provisionalGradeIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: '101,102,107',
		displayOptions: {
			show: {
				resource: ['moderatedGrading'],
				operation: ['bulkSelectProvisionalGrades'],
			},
		},
		description:
			'Comma-separated IDs of the provisional grades to select, one per student. Canvas finds the student of each grade itself and returns only the selections that changed; IDs that do not belong to the assignment are ignored.',
	},
];
