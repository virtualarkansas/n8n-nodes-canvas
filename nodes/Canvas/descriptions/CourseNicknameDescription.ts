import type { INodeProperties } from 'n8n-workflow';

export const courseNicknameOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['courseNickname'],
			},
		},
		options: [
			{
				name: 'Clear All',
				value: 'clearAll',
				description: 'Remove every course nickname of the current user',
				action: 'Clear all course nicknames',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the nickname the current user gave a course',
				action: 'Get a course nickname',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many course nicknames of the current user',
				action: 'Get many course nicknames',
			},
			{
				name: 'Remove',
				value: 'remove',
				description: 'Remove the nickname the current user gave a course',
				action: 'Remove a course nickname',
			},
			{
				name: 'Set',
				value: 'set',
				description: 'Give a course a nickname for the current user',
				action: 'Set a course nickname',
			},
		],
		default: 'getAll',
	},
];

export const courseNicknameFields: INodeProperties[] = [
	{
		displayName:
			'Course nicknames belong to the user whose token is used. A nickname replaces the name of the course in everything Canvas shows and returns to that user; other users are not affected.',
		name: 'courseNicknameNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['courseNickname'],
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
				resource: ['courseNickname'],
				operation: ['get', 'remove', 'set'],
			},
		},
		description: 'The ID of the course. Also accepts SIS IDs in the form "sis_course_id:XYZ".',
	},
	{
		displayName: 'Nickname',
		name: 'nickname',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['courseNickname'],
				operation: ['set'],
			},
		},
		description: 'The nickname to show instead of the name of the course (at most 59 characters)',
	},
];
