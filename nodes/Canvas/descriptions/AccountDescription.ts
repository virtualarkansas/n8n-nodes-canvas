import type { INodeProperties } from 'n8n-workflow';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['account'],
			},
		},
		options: [
			{
				name: 'Create Sub-Account',
				value: 'createSubAccount',
				description: 'Create a new sub-account under a parent account',
				action: 'Create a sub account',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single account',
				action: 'Get an account',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many accounts',
				action: 'Get many accounts',
			},
			{
				name: 'Get Sub-Accounts',
				value: 'getSubAccounts',
				description: 'Get sub-accounts of an account',
				action: 'Get sub accounts',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an account',
				action: 'Update an account',
			},
		],
		default: 'getAll',
	},
];

export const accountFields: INodeProperties[] = [
	// ----------------------------------
	//         account: get
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['get', 'update', 'getSubAccounts', 'createSubAccount'],
			},
		},
		description: 'The ID of the account',
	},

	// ----------------------------------
	//         account: getAll
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Course Count', value: 'course_count' },
					{ name: 'LTI GUID', value: 'lti_guid' },
					{ name: 'Registration Settings', value: 'registration_settings' },
					{ name: 'Services', value: 'services' },
					{ name: 'Sub-Account Count', value: 'sub_account_count' },
				],
				default: [],
				description: 'Additional information to include with each account',
			},
		],
	},

	// ----------------------------------
	//         account: getSubAccounts
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['getSubAccounts'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Course Count', value: 'course_count' },
					{ name: 'Sub-Account Count', value: 'sub_account_count' },
				],
				default: [],
				description: 'Additional information to include with each sub-account',
			},
			{
				displayName: 'Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'ID', value: 'id' },
					{ name: 'Name', value: 'name' },
				],
				default: 'id',
				description: 'Sort sub-accounts by this field (direct children only)',
			},
			{
				displayName: 'Recursive',
				name: 'recursive',
				type: 'boolean',
				default: false,
				description: 'Whether to retrieve the entire account tree instead of just direct children',
			},
		],
	},

	// ----------------------------------
	//         account: createSubAccount
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['createSubAccount'],
			},
		},
		description: 'The name of the sub-account',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['createSubAccount'],
			},
		},
		options: [
			{
				displayName: 'Default Group Storage Quota (MB)',
				name: 'default_group_storage_quota_mb',
				type: 'number',
				default: 0,
				description: 'The default group storage quota in megabytes',
			},
			{
				displayName: 'Default Storage Quota (MB)',
				name: 'default_storage_quota_mb',
				type: 'number',
				default: 0,
				description: 'The default course storage quota in megabytes',
			},
			{
				displayName: 'Default User Storage Quota (MB)',
				name: 'default_user_storage_quota_mb',
				type: 'number',
				default: 0,
				description: 'The default user storage quota in megabytes',
			},
			{
				displayName: 'SIS Account ID',
				name: 'sis_account_id',
				type: 'string',
				default: '',
				description: 'The SIS identifier for the sub-account',
			},
		],
	},

	// ----------------------------------
	//         account: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Course Template ID',
				name: 'course_template_id',
				type: 'string',
				default: '',
				description: 'The ID of the template course to use for new courses',
			},
			{
				displayName: 'Default Group Storage Quota (MB)',
				name: 'default_group_storage_quota_mb',
				type: 'number',
				default: 0,
				description: 'The default group storage quota in megabytes',
			},
			{
				displayName: 'Default Storage Quota (MB)',
				name: 'default_storage_quota_mb',
				type: 'number',
				default: 0,
				description: 'The default course storage quota in megabytes',
			},
			{
				displayName: 'Default Time Zone',
				name: 'default_time_zone',
				type: 'string',
				default: '',
				description: 'The default time zone for the account (IANA or Rails format, e.g., "America/New_York")',
			},
			{
				displayName: 'Default User Storage Quota (MB)',
				name: 'default_user_storage_quota_mb',
				type: 'number',
				default: 0,
				description: 'The default user storage quota in megabytes',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The display name of the account',
			},
			{
				displayName: 'Parent Account ID',
				name: 'parent_account_id',
				type: 'string',
				default: '',
				description: 'The ID of the parent account to move this account under',
			},
			{
				displayName: 'SIS Account ID',
				name: 'sis_account_id',
				type: 'string',
				default: '',
				description: 'The SIS identifier for the account (requires manage_sis permission)',
			},
		],
	},
];
