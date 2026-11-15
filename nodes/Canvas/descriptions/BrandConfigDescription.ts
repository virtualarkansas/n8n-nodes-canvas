import type { INodeProperties } from 'n8n-workflow';

export const brandConfigOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['brandConfig'],
			},
		},
		options: [
			{
				name: 'Share Theme',
				value: 'share',
				description: 'Give a theme (brand config) a name and offer it in the Theme Editor of an account and its sub-accounts. Does not apply the theme to anything.',
				action: 'Share a theme',
			},
			{
				name: 'Unshare Theme',
				value: 'unshare',
				description: 'Remove a shared theme from the Theme Editor. Accounts that already use the theme keep it.',
				action: 'Unshare a theme',
			},
			{
				name: 'Update Shared Theme',
				value: 'updateShared',
				description: 'Rename a shared theme or point it at another brand config',
				action: 'Update a shared theme',
			},
		],
		default: 'share',
	},
];

const brandConfigMd5: INodeProperties = {
	displayName: 'Brand Config MD5',
	name: 'brand_config_md5',
	type: 'string',
	default: '',
	placeholder: 'a1f113321fa024e7a14cb0948597a2a4',
	description:
		'The MD5 that identifies the brand config (theme) to share. Canvas shows it in the address of the Theme Editor ("brand_config=..."); the API has no list of brand configs.',
};

export const brandConfigFields: INodeProperties[] = [
	// ----------------------------------
	//         brandConfig: share, updateShared
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['brandConfig'],
				operation: ['share', 'updateShared'],
			},
		},
		description: 'The ID of the account the theme is shared in (or "sis_account_id:..." for a SIS ID)',
	},
	{
		displayName: 'Shared Theme ID',
		name: 'sharedBrandConfigId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['brandConfig'],
				operation: ['updateShared', 'unshare'],
			},
		},
		description: 'The ID of the shared theme (shared brand config), as returned by Share Theme',
	},

	// ----------------------------------
	//         brandConfig: share
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['brandConfig'],
				operation: ['share'],
			},
		},
		description: 'The name the theme is offered under',
	},
	{
		...brandConfigMd5,
		name: 'brandConfigMd5',
		required: true,
		displayOptions: {
			show: {
				resource: ['brandConfig'],
				operation: ['share'],
			},
		},
	},

	// ----------------------------------
	//         brandConfig: updateShared
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['brandConfig'],
				operation: ['updateShared'],
			},
		},
		options: [
			brandConfigMd5,
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The name the theme is offered under',
			},
		],
	},
];
