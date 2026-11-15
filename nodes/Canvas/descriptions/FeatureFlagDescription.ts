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
		description: 'The ID of the account (or sub-account), or an SIS ID such as sis_account_id:ABC',
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
		description: 'The ID of the course, or an SIS ID such as sis_course_id:ABC',
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
		description: 'The ID of the user, "self", or an SIS ID such as sis_user_id:ABC',
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
		description:
			'The symbolic name of the feature, e.g. epub_export (the "feature" value returned by Get Many). The feature must apply to the chosen context type.',
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
				name: 'Allowed (Off by Default)',
				value: 'allowed',
				description:
					'Accounts only: off here, but sub-accounts and courses may turn the feature on',
			},
			{
				name: 'Allowed (On by Default)',
				value: 'allowed_on',
				description:
					'Accounts only: on here, but sub-accounts and courses may turn the feature off',
			},
			{
				name: 'Off',
				value: 'off',
				description: 'Off for this context and everything below it',
			},
			{
				name: 'On',
				value: 'on',
				description: 'On for this context and everything below it',
			},
		],
		description:
			'The state to set. Canvas refuses the change when a parent account has locked the flag (set it to On or Off), and refuses states the feature does not allow in this context.',
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
