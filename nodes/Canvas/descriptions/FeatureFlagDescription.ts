import type { INodeProperties } from 'n8n-workflow';

export const featureFlagOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['featureFlag'],
			},
		},
		options: [
			{
				name: 'Delete',
				value: 'delete',
				description: 'Remove a feature flag',
				action: 'Delete a feature flag',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a feature flag',
				action: 'Get a feature flag',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many features',
				action: 'Get many features',
			},
			{
				name: 'Get Many Enabled',
				value: 'getAllEnabled',
				description: 'Get many enabled features',
				action: 'Get many enabled features',
			},
			{
				name: 'Get Many Environment',
				value: 'getAllEnvironment',
				description: 'Get many environment features',
				action: 'Get many environment features',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Set a feature flag',
				action: 'Update a feature flag',
			},
		],
		default: 'getAll',
	},
];

export const featureFlagFields: INodeProperties[] = [
	// ----------------------------------
	//         featureFlag: shared - context type
	// ----------------------------------
	{
		displayName: 'Context Type',
		name: 'contextType',
		type: 'options',
		required: true,
		default: 'course',
		displayOptions: {
			show: {
				resource: ['featureFlag'],
				operation: ['get', 'getAll', 'getAllEnabled', 'update', 'delete'],
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
			{
				name: 'User',
				value: 'user',
			},
		],
		description: 'The type of context for the feature flag',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['featureFlag'],
				operation: ['get', 'getAll', 'getAllEnabled', 'update', 'delete'],
				contextType: ['account'],
			},
		},
		description: 'The ID of the account',
	},
	{
		displayName: 'Course ID',
		name: 'courseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['featureFlag'],
				operation: ['get', 'getAll', 'getAllEnabled', 'update', 'delete'],
				contextType: ['course'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['featureFlag'],
				operation: ['get', 'getAll', 'getAllEnabled', 'update', 'delete'],
				contextType: ['user'],
			},
		},
		description: 'The ID of the user',
	},

	// ----------------------------------
	//         featureFlag: get, update, delete - feature name
	// ----------------------------------
	{
		displayName: 'Feature Name',
		name: 'feature',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['featureFlag'],
				operation: ['get', 'update', 'delete'],
			},
		},
		description: 'The name of the feature flag',
	},

	// ----------------------------------
	//         featureFlag: update
	// ----------------------------------
	{
		displayName: 'State',
		name: 'state',
		type: 'options',
		required: true,
		default: 'on',
		displayOptions: {
			show: {
				resource: ['featureFlag'],
				operation: ['update'],
			},
		},
		options: [
			{
				name: 'Allowed',
				value: 'allowed',
			},
			{
				name: 'Off',
				value: 'off',
			},
			{
				name: 'On',
				value: 'on',
			},
		],
		description: 'The state to set for the feature flag',
	},

	// ----------------------------------
	//         featureFlag: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['featureFlag'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Hide Inherited Enabled',
				name: 'hide_inherited_enabled',
				type: 'boolean',
				default: false,
				description:
					'Whether to omit feature flags that are enabled in a higher context and cannot be overridden',
			},
		],
	},
];
