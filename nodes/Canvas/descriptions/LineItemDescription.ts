import type { INodeProperties } from 'n8n-workflow';

/**
 * Line items belong to the LTI Advantage Assignment and Grade Services
 * (`/api/lti/courses/:course_id/line_items`). Canvas only accepts an LTI
 * Advantage access token there, never a user's API or OAuth2 token.
 */
const LTI_TOKEN_NOTE =
	'Needs Authentication > LTI Advantage (the key of an LTI 1.3 developer key with the AGS line item scope); a personal Canvas API token is rejected with 401';

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
				description: `Create a line item (gradebook column) for an LTI 1.3 tool. ${LTI_TOKEN_NOTE}.`,
				action: 'Create a line item',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: `Delete a line item. ${LTI_TOKEN_NOTE}.`,
				action: 'Delete a line item',
			},
			{
				name: 'Get',
				value: 'get',
				description: `Get a single line item. ${LTI_TOKEN_NOTE}.`,
				action: 'Get a line item',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: `Get the line items the tool of the access token owns in a course. ${LTI_TOKEN_NOTE}.`,
				action: 'Get many line items',
			},
			{
				name: 'Update',
				value: 'update',
				description: `Update a line item. ${LTI_TOKEN_NOTE}.`,
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
		displayName:
			'Line items are part of the LTI Advantage services, which Canvas only opens to an LTI 1.3 tool. Choose Authentication > LTI Advantage and a Canvas LTI Advantage API credential (client ID and private key of the tool\'s developer key); the tool must be installed in the course. A personal API token or OAuth2 login is answered with 401 "Invalid access token format".',
		name: 'lineItemNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['lineItem'],
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
				resource: ['lineItem'],
				operation: ['create', 'delete', 'get', 'getAll', 'update'],
			},
		},
		description: 'The numeric ID of the course (SIS IDs are not accepted by the LTI services)',
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
		description:
			'The numeric ID of the line item, or the "ID" Canvas returns for it (the line item URL ending in /line_items/&lt;number&gt;)',
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
		description:
			'The label for the line item. Without a Resource Link ID it is also the name of the assignment Canvas creates for the line item.',
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
		description: 'The maximum score for the line item (the points possible of its assignment)',
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
				description:
					'When the line item stops receiving submissions (the due date of its assignment)',
			},
			{
				displayName: 'Resource ID',
				name: 'resourceId',
				type: 'string',
				default: '',
				description:
					'A tool-specified ID for the line item. Several line items may share one resource ID.',
			},
			{
				displayName: 'Resource Link ID',
				name: 'resourceLinkId',
				type: 'string',
				default: '',
				description:
					'The LTI resource link ID (the "lti_context_id" of an external tool assignment of this tool) to attach the line item to. Without it Canvas creates a new assignment.',
			},
			{
				displayName: 'Start Date Time',
				name: 'startDateTime',
				type: 'dateTime',
				default: '',
				description: 'When the line item becomes available (the unlock date of its assignment)',
			},
			{
				displayName: 'Submission External Tool URL',
				name: 'submissionExternalToolUrl',
				type: 'string',
				default: '',
				description:
					'The launch URL of the assignment when Submission Type is "External Tool". Must match the tool of the access token.',
			},
			{
				displayName: 'Submission Type',
				name: 'submissionType',
				type: 'options',
				options: [
					{ name: 'External Tool', value: 'external_tool' },
					{ name: 'None', value: 'none' },
				],
				default: 'none',
				description:
					'Canvas extension: the submission type of the assignment created for the line item',
			},
			{
				displayName: 'Tag',
				name: 'tag',
				type: 'string',
				default: '',
				description:
					'A value to qualify the line item beyond its IDs. Line items can be filtered by tag in Get Many.',
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
				description:
					'When the line item stops receiving submissions (the due date of its assignment)',
			},
			{
				displayName: 'Label',
				name: 'label',
				type: 'string',
				default: '',
				description: 'The label for the line item (also renames its assignment)',
			},
			{
				displayName: 'Resource ID',
				name: 'resourceId',
				type: 'string',
				default: '',
				description: 'A tool-specified ID for the line item',
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
				description: 'When the line item becomes available (the unlock date of its assignment)',
			},
			{
				displayName: 'Tag',
				name: 'tag',
				type: 'string',
				default: '',
				description: 'A value to qualify the line item beyond its IDs',
			},
		],
	},

	// ----------------------------------
	//         lineItem: getAll
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
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include Launch URL',
				name: 'include',
				type: 'boolean',
				default: false,
				description: 'Whether to include the launch URL of each line item in the response',
			},
			{
				displayName: 'Resource ID',
				name: 'resource_id',
				type: 'string',
				default: '',
				description: 'Return only line items with this resource ID',
			},
			{
				displayName: 'Resource Link ID',
				name: 'resource_link_id',
				type: 'string',
				default: '',
				description: 'Return only line items attached to this LTI resource link ID',
			},
			{
				displayName: 'Tag',
				name: 'tag',
				type: 'string',
				default: '',
				description: 'Return only line items with this tag',
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
				description: 'Whether to include the launch URL of the line item in the response',
			},
		],
	},
];
