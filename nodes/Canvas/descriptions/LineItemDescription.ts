import type { INodeProperties } from 'n8n-workflow';

export const lineItemOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['lineItem'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a line item',
				action: 'Create a line item',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a line item',
				action: 'Delete a line item',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single line item',
				action: 'Get a line item',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many line items',
				action: 'Get many line items',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a line item',
				action: 'Update a line item',
			},
		],
		default: 'getAll',
	},
];

export const lineItemFields: INodeProperties[] = [
	// ----------------------------------
	//         lineItem: shared
	// ----------------------------------
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['lineItem'],
				operation: ['create', 'delete', 'get', 'getAll', 'update'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Line Item ID',
		name: 'lineItemId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['lineItem'],
				operation: ['delete', 'get', 'update'],
			},
		},
		description: 'The ID of the line item',
	},

	// ----------------------------------
	//         lineItem: create
	// ----------------------------------
	{
		displayName: 'Label',
		name: 'label',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['lineItem'],
				operation: ['create'],
			},
		},
		description: 'The label for the line item',
	},
	{
		displayName: 'Score Maximum',
		name: 'scoreMaximum',
		type: 'number',
		required: true,
		default: 100,
		typeOptions: {
			minValue: 0,
		},
		displayOptions: {
			show: {
				resource: ['lineItem'],
				operation: ['create'],
			},
		},
		description: 'The maximum score for the line item',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['lineItem'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'End Date Time',
				name: 'endDateTime',
				type: 'dateTime',
				default: '',
				description: 'The submission deadline in ISO 8601 format',
			},
			{
				displayName: 'Resource ID',
				name: 'resourceId',
				type: 'string',
				default: '',
				description: 'Tool provider specified identifier for the resource',
			},
			{
				displayName: 'Resource Link ID',
				name: 'resourceLinkId',
				type: 'string',
				default: '',
				description: 'The ID of the associated LTI assignment',
			},
			{
				displayName: 'Start Date Time',
				name: 'startDateTime',
				type: 'dateTime',
				default: '',
				description: 'The availability date in ISO 8601 format',
			},
			{
				displayName: 'Submission Type',
				name: 'submissionType',
				type: 'json',
				default: '{}',
				description: 'Submission type configuration (Canvas extension)',
			},
			{
				displayName: 'Tag',
				name: 'tag',
				type: 'string',
				default: '',
				description: 'A tag for qualifying the line item',
			},
		],
	},

	// ----------------------------------
	//         lineItem: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['lineItem'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'End Date Time',
				name: 'endDateTime',
				type: 'dateTime',
				default: '',
				description: 'The submission deadline in ISO 8601 format',
			},
			{
				displayName: 'Label',
				name: 'label',
				type: 'string',
				default: '',
				description: 'The label for the line item',
			},
			{
				displayName: 'Resource ID',
				name: 'resourceId',
				type: 'string',
				default: '',
				description: 'Tool provider specified identifier for the resource',
			},
			{
				displayName: 'Score Maximum',
				name: 'scoreMaximum',
				type: 'number',
				default: 100,
				typeOptions: {
					minValue: 0,
				},
				description: 'The maximum score for the line item',
			},
			{
				displayName: 'Start Date Time',
				name: 'startDateTime',
				type: 'dateTime',
				default: '',
				description: 'The availability date in ISO 8601 format',
			},
			{
				displayName: 'Tag',
				name: 'tag',
				type: 'string',
				default: '',
				description: 'A tag for qualifying the line item',
			},
		],
	},

	// ----------------------------------
	//         lineItem: getAll
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['lineItem'],
				operation: ['getAll'],
			},
		},
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
		},
		displayOptions: {
			show: {
				resource: ['lineItem'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
		description: 'Max number of results to return',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['lineItem'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include Launch URL',
				name: 'include',
				type: 'boolean',
				default: false,
				description: 'Whether to include the launch URL extension in the response',
			},
			{
				displayName: 'Resource ID',
				name: 'resource_id',
				type: 'string',
				default: '',
				description: 'Filter by resource ID',
			},
			{
				displayName: 'Resource Link ID',
				name: 'resource_link_id',
				type: 'string',
				default: '',
				description: 'Filter by resource link ID',
			},
			{
				displayName: 'Tag',
				name: 'tag',
				type: 'string',
				default: '',
				description: 'Filter by tag',
			},
		],
	},

	// ----------------------------------
	//         lineItem: get
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['lineItem'],
				operation: ['get'],
			},
		},
		options: [
			{
				displayName: 'Include Launch URL',
				name: 'include',
				type: 'boolean',
				default: false,
				description: 'Whether to include the launch URL extension in the response',
			},
		],
	},
];
