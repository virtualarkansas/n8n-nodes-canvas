import type { INodeProperties } from 'n8n-workflow';

export const customGradebookColumnOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['customGradebookColumn'],
			},
		},
		options: [
			{
				name: 'Bulk Update Data',
				value: 'bulkUpdateData',
				description: 'Bulk update column data for multiple students',
				action: 'Bulk update custom gradebook column data',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a custom gradebook column',
				action: 'Create a custom gradebook column',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a custom gradebook column',
				action: 'Delete a custom gradebook column',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single custom gradebook column',
				action: 'Get a custom gradebook column',
			},
			{
				name: 'Get Column Data',
				value: 'getColumnData',
				description: 'Get data entries for a custom gradebook column',
				action: 'Get custom gradebook column data',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many custom gradebook columns',
				action: 'Get many custom gradebook columns',
			},
			{
				name: 'Reorder',
				value: 'reorder',
				description: 'Reorder custom gradebook columns',
				action: 'Reorder custom gradebook columns',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a custom gradebook column',
				action: 'Update a custom gradebook column',
			},
			{
				name: 'Update Column Data',
				value: 'updateColumnData',
				description: 'Update data for a specific student in a column',
				action: 'Update custom gradebook column data',
			},
		],
		default: 'getAll',
	},
];

export const customGradebookColumnFields: INodeProperties[] = [
	// ----------------------------------
	//         customGradebookColumn: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['customGradebookColumn'],
			},
		},
		description: 'The ID of the course',
	},

	// ----------------------------------
	//         customGradebookColumn: get, update, delete, getColumnData, updateColumnData
	// ----------------------------------
	{
		displayName: 'Column ID',
		name: 'columnId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['customGradebookColumn'],
				operation: ['get', 'update', 'delete', 'getColumnData', 'updateColumnData'],
			},
		},
		description: 'The ID of the custom gradebook column',
	},

	// ----------------------------------
	//         customGradebookColumn: updateColumnData
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['customGradebookColumn'],
				operation: ['updateColumnData'],
			},
		},
		description: 'The ID of the user whose data to update',
	},
	{
		displayName: 'Content',
		name: 'content',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['customGradebookColumn'],
				operation: ['updateColumnData'],
			},
		},
		description: 'The content to set for the column data',
	},

	// ----------------------------------
	//         customGradebookColumn: create
	// ----------------------------------
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['customGradebookColumn'],
				operation: ['create'],
			},
		},
		description: 'The title of the custom gradebook column',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['customGradebookColumn'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Hidden',
				name: 'hidden',
				type: 'boolean',
				default: false,
				description: 'Whether the column is hidden from students',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				description: 'The position of the column relative to other custom columns',
			},
			{
				displayName: 'Read Only',
				name: 'read_only',
				type: 'boolean',
				default: false,
				description: 'Whether the column is read-only and cannot be edited by teachers',
			},
			{
				displayName: 'Teacher Notes',
				name: 'teacher_notes',
				type: 'boolean',
				default: false,
				description: 'Whether this is the teacher notes column',
			},
		],
	},

	// ----------------------------------
	//         customGradebookColumn: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['customGradebookColumn'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Hidden',
				name: 'hidden',
				type: 'boolean',
				default: false,
				description: 'Whether the column is hidden from students',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 0,
				description: 'The position of the column relative to other custom columns',
			},
			{
				displayName: 'Read Only',
				name: 'read_only',
				type: 'boolean',
				default: false,
				description: 'Whether the column is read-only and cannot be edited by teachers',
			},
			{
				displayName: 'Teacher Notes',
				name: 'teacher_notes',
				type: 'boolean',
				default: false,
				description: 'Whether this is the teacher notes column',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the custom gradebook column',
			},
		],
	},

	// ----------------------------------
	//         customGradebookColumn: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['customGradebookColumn'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include Hidden',
				name: 'include_hidden',
				type: 'boolean',
				default: false,
				description: 'Whether to include hidden columns in the results',
			},
		],
	},

	// ----------------------------------
	//         customGradebookColumn: getColumnData - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['customGradebookColumn'],
				operation: ['getColumnData'],
			},
		},
		options: [
			{
				displayName: 'Include Hidden',
				name: 'include_hidden',
				type: 'boolean',
				default: false,
				description: 'Whether to include hidden column data in the results',
			},
		],
	},

	// ----------------------------------
	//         customGradebookColumn: reorder
	// ----------------------------------
	{
		displayName: 'Column Order',
		name: 'order',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['customGradebookColumn'],
				operation: ['reorder'],
			},
		},
		description: 'Comma-separated list of column IDs in the desired order',
	},

	// ----------------------------------
	//         customGradebookColumn: bulkUpdateData
	// ----------------------------------
	{
		displayName: 'Column Data',
		name: 'columnData',
		type: 'fixedCollection',
		placeholder: 'Add Column Data',
		required: true,
		default: {},
		displayOptions: {
			show: {
				resource: ['customGradebookColumn'],
				operation: ['bulkUpdateData'],
			},
		},
		typeOptions: {
			multipleValues: true,
		},
		options: [
			{
				displayName: 'Data Entry',
				name: 'dataEntry',
				values: [
					{
						displayName: 'Column ID',
						name: 'column_id',
						type: 'string',
						required: true,
						default: '',
						description: 'The ID of the custom gradebook column',
					},
					{
						displayName: 'User ID',
						name: 'user_id',
						type: 'string',
						required: true,
						default: '',
						description: 'The ID of the user',
					},
					{
						displayName: 'Content',
						name: 'content',
						type: 'string',
						required: true,
						default: '',
						description: 'The content to set for this column/user combination',
					},
				],
			},
		],
		description: 'The column data entries to update',
	},
];
