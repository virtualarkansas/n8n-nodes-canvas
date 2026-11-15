import type { INodeProperties } from 'n8n-workflow';

export const cspSettingOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['cspSetting'],
			},
		},
		options: [
			{
				name: 'Add Domain',
				value: 'addDomain',
				description: 'Allow a domain in the content security policy of an account',
				action: 'Add an allowed domain',
			},
			{
				name: 'Add Domains',
				value: 'addDomains',
				description: 'Allow several domains in the content security policy of an account',
				action: 'Add allowed domains',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the content security policy settings of an account or course',
				action: 'Get CSP settings',
			},
			{
				name: 'Lock',
				value: 'lock',
				description: 'Lock or unlock the policy of an account for its sub-accounts and courses',
				action: 'Lock CSP settings',
			},
			{
				name: 'Remove Domain',
				value: 'removeDomain',
				description: 'Remove a domain from the allowed domains of an account',
				action: 'Remove an allowed domain',
			},
			{
				name: 'Set Status',
				value: 'setStatus',
				description: 'Enable or disable the content security policy, or go back to the inherited setting',
				action: 'Set CSP status',
			},
		],
		default: 'get',
	},
];

export const cspSettingFields: INodeProperties[] = [
	{
		displayName: 'Context',
		name: 'contextType',
		type: 'options',
		options: [
			{ name: 'Account', value: 'account' },
			{ name: 'Course', value: 'course' },
		],
		default: 'account',
		displayOptions: {
			show: {
				resource: ['cspSetting'],
				operation: ['get', 'setStatus'],
			},
		},
		description: 'Whether to read or change the policy of an account or of a course',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['cspSetting'],
				operation: ['get', 'setStatus'],
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
				resource: ['cspSetting'],
				operation: ['get', 'setStatus'],
				contextType: ['course'],
			},
		},
		description: 'The ID of the course',
	},
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['cspSetting'],
				operation: ['addDomain', 'addDomains', 'lock', 'removeDomain'],
			},
		},
		description: 'The ID of the account',
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		required: true,
		options: [
			{ name: 'Disabled', value: 'disabled' },
			{ name: 'Enabled', value: 'enabled' },
			{ name: 'Inherited', value: 'inherited' },
		],
		default: 'enabled',
		displayOptions: {
			show: {
				resource: ['cspSetting'],
				operation: ['setStatus'],
			},
		},
		description: 'Enabled or Disabled sets the policy explicitly; Inherited removes the explicit setting so the parent account decides',
	},
	{
		displayName: 'Settings Locked',
		name: 'settingsLocked',
		type: 'boolean',
		required: true,
		default: true,
		displayOptions: {
			show: {
				resource: ['cspSetting'],
				operation: ['lock'],
			},
		},
		description: 'Whether sub-accounts and courses are prevented from overriding the policy of this account',
	},
	{
		displayName: 'Domain',
		name: 'domain',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'example.com',
		displayOptions: {
			show: {
				resource: ['cspSetting'],
				operation: ['addDomain', 'removeDomain'],
			},
		},
		description: 'The domain to allow or to remove, e.g. example.com or *.example.com',
	},
	{
		displayName: 'Domains',
		name: 'domains',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'example.com, *.example.org',
		displayOptions: {
			show: {
				resource: ['cspSetting'],
				operation: ['addDomains'],
			},
		},
		description: 'The domains to allow, separated by commas',
	},
];
