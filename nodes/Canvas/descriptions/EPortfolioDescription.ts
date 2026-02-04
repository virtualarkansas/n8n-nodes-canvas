import type { INodeProperties } from 'n8n-workflow';

export const ePortfolioOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['ePortfolio'],
			},
		},
		options: [
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an ePortfolio',
				action: 'Delete a portfolio',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get an ePortfolio',
				action: 'Get a portfolio',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many ePortfolios',
				action: 'Get many portfolios',
			},
			{
				name: 'Get Many Pages',
				value: 'getAllPages',
				description: 'Get many ePortfolio pages',
				action: 'Get many portfolio pages',
			},
			{
				name: 'Moderate',
				value: 'moderate',
				description: 'Moderate an ePortfolio',
				action: 'Moderate a portfolio',
			},
			{
				name: 'Moderate All',
				value: 'moderateAll',
				description: 'Moderate all ePortfolios for a user',
				action: 'Moderate all portfolios for a user',
			},
			{
				name: 'Restore',
				value: 'restore',
				description: 'Restore a deleted ePortfolio',
				action: 'Restore a portfolio',
			},
		],
		default: 'getAll',
	},
];

export const ePortfolioFields: INodeProperties[] = [
	// ----------------------------------
	//         ePortfolio: getAll, moderateAll
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['ePortfolio'],
				operation: ['getAll', 'moderateAll'],
			},
		},
		description: 'The ID of the user whose ePortfolios to retrieve',
	},

	// ----------------------------------
	//         ePortfolio: get, delete, moderate, restore, getAllPages
	// ----------------------------------
	{
		displayName: 'EPortfolio ID',
		name: 'ePortfolioId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['ePortfolio'],
				operation: ['get', 'delete', 'moderate', 'restore', 'getAllPages'],
			},
		},
		description: 'The ID of the ePortfolio',
	},

	// ----------------------------------
	//         ePortfolio: moderate, moderateAll
	// ----------------------------------
	{
		displayName: 'Spam Status',
		name: 'spamStatus',
		type: 'options',
		required: true,
		default: 'marked_as_safe',
		displayOptions: {
			show: {
				resource: ['ePortfolio'],
				operation: ['moderate', 'moderateAll'],
			},
		},
		options: [
			{
				name: 'Marked As Safe',
				value: 'marked_as_safe',
			},
			{
				name: 'Marked As Spam',
				value: 'marked_as_spam',
			},
		],
		description: 'The spam status to set for the ePortfolio(s)',
	},

	// ----------------------------------
	//         ePortfolio: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['ePortfolio'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Include Deleted',
				name: 'include',
				type: 'boolean',
				default: false,
				description: 'Whether to include deleted ePortfolios (admin only)',
			},
		],
	},
];
