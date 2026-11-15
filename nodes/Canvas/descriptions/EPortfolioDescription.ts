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
				description: 'Get the ePortfolios of a user',
				action: 'Get many portfolios',
			},
			{
				name: 'Get Many Pages',
				value: 'getAllPages',
				description: 'Get the pages of an ePortfolio',
				action: 'Get many portfolio pages',
			},
			{
				name: 'Moderate',
				value: 'moderate',
				description: 'Mark an ePortfolio as spam or as safe',
				action: 'Moderate a portfolio',
			},
			{
				name: 'Moderate All',
				value: 'moderateAll',
				description: 'Mark all active ePortfolios of a user as spam or as safe',
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
		description:
			'The user whose ePortfolios to list or moderate: a Canvas user ID, "self", or an SIS ID such as sis_user_id:ABC123',
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
		description:
			'The ID of the ePortfolio (the number in its URL, /eportfolios/123). ePortfolios can only be created in the Canvas web interface.',
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
		description:
			'The spam status to set. Needs an admin who may moderate user content. While an ePortfolio is marked as spam its author cannot edit it or create new ones; "Moderate All" only touches the user\'s active (not deleted) ePortfolios.',
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
				description:
					'Whether to include deleted ePortfolios. Only applies when an admin who may moderate user content lists another user; users never see their own deleted ePortfolios.',
			},
		],
	},
];
