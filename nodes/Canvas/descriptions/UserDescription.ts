import type { INodeProperties } from 'n8n-workflow';

export const userOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['user'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new user in an account',
				action: 'Create a user',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a user from a root account: removes their logins there and takes them off the account',
				action: 'Delete a user',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single user by ID',
				action: 'Get a user',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many users from an account',
				action: 'Get many users',
			},
			{
				name: 'Get Profile',
				value: 'getProfile',
				description: 'Get the profile of a user (bio, title, primary email, login ID, time zone)',
				action: 'Get a user profile',
			},
			{
				name: 'Get Self',
				value: 'getSelf',
				description: 'Get the currently authenticated user',
				action: 'Get current user',
			},
			{
				name: 'Merge',
				value: 'merge',
				description: 'Merge one user into another',
				action: 'Merge users',
			},
			{
				name: 'Restore',
				value: 'restore',
				description: 'Restore a deleted user and their most recently deleted login',
				action: 'Restore a user',
			},
			{
				name: 'Split',
				value: 'split',
				description: 'Split a merged user back into separate users (within 180 days of the merge)',
				action: 'Split a merged user',
			},
			{
				name: 'Terminate Sessions',
				value: 'terminateSessions',
				description: 'End all browser sessions of a user and expire all of their access tokens',
				action: 'Terminate all sessions of a user',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an existing user',
				action: 'Update a user',
			},
		],
		default: 'getAll',
	},
];

export const userFields: INodeProperties[] = [
	// ----------------------------------
	//         user: account
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['getAll', 'create', 'delete', 'restore'],
			},
		},
		description:
			'The ID of the account. Deleting and restoring users only works on a root account ("self" selects the root account of the Canvas URL).',
	},

	// ----------------------------------
	//         user: single user
	// ----------------------------------
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['get', 'update', 'delete', 'restore', 'getProfile', 'split', 'terminateSessions'],
			},
		},
		description:
			'The ID of the user. "self" selects the current user; SIS IDs work in the form "sis_user_id:ABC".',
	},

	// ----------------------------------
	//         user: merge
	// ----------------------------------
	{
		displayName: 'Source User ID',
		name: 'sourceUserId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['merge'],
			},
		},
		description: 'The ID of the user to merge from (will be deleted)',
	},
	{
		displayName: 'Destination User ID',
		name: 'destinationUserId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['merge'],
			},
		},
		description: 'The ID of the user to merge into (will be preserved)',
	},
	{
		displayName: 'Destination Account ID',
		name: 'destinationAccountId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['merge'],
			},
		},
		description:
			'The ID or domain of the account the destination user belongs to. Only needed when the destination user is identified by an SIS ID of another account.',
	},

	// ----------------------------------
	//         user: create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['create'],
			},
		},
		description: 'The full name of the user',
	},
	{
		displayName: 'Unique ID',
		name: 'uniqueId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['create'],
			},
		},
		description:
			'The login ID of the user. When it is an email address and no "Email" is given, it also becomes the user\'s email address.',
	},

	// ----------------------------------
	//         user: getAll - Additional Fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Enrollment Type',
				name: 'enrollmentType',
				type: 'options',
				options: [
					{ name: 'Designer', value: 'designer' },
					{ name: 'Observer', value: 'observer' },
					{ name: 'Student', value: 'student' },
					{ name: 'TA', value: 'ta' },
					{ name: 'Teacher', value: 'teacher' },
				],
				default: 'student',
				description: 'Only return users enrolled with this base role in a course of the account',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar URL', value: 'avatar_url' },
					{ name: 'Email', value: 'email' },
					{ name: 'Last Login', value: 'last_login' },
					{ name: 'Time Zone', value: 'time_zone' },
					{ name: 'UUID', value: 'uuid' },
				],
				default: [],
				description: 'Additional data to include in the response',
			},
			{
				displayName: 'Include Deleted Users',
				name: 'includeDeletedUsers',
				type: 'boolean',
				default: false,
				description: 'Whether to include users whose logins in the account have been deleted',
			},
			{
				displayName: 'Search Term',
				name: 'searchTerm',
				type: 'string',
				default: '',
				description:
					'Partial name, login ID, SIS ID or email address, or a full user ID (minimum 3 characters). A numeric term is matched against the user ID first.',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Email', value: 'email' },
					{ name: 'ID', value: 'id' },
					{ name: 'Integration ID', value: 'integration_id' },
					{ name: 'Last Login', value: 'last_login' },
					{ name: 'SIS ID', value: 'sis_id' },
					{ name: 'Username', value: 'username' },
				],
				default: 'username',
				description: 'Field to sort by. "ID" is the most efficient choice when fetching many pages.',
			},
			{
				displayName: 'Sort Order',
				name: 'order',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'asc',
			},
		],
	},

	// ----------------------------------
	//         user: get - Additional Fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['get', 'getSelf'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Avatar State', value: 'avatar_state' },
					{ name: 'Last Login', value: 'last_login' },
					{ name: 'UUID', value: 'uuid' },
				],
				default: [],
				description:
					'Additional data to include in the response. Email, locale, avatar URL and permissions are always returned.',
			},
		],
	},

	// ----------------------------------
	//         user: create - Additional Fields
	// ----------------------------------
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Authentication Provider ID',
				name: 'authenticationProviderId',
				type: 'string',
				default: '',
				description:
					'The authentication provider the login belongs to: its ID or its type (e.g. "canvas", "saml")',
			},
			{
				displayName: 'Destination',
				name: 'destination',
				type: 'string',
				default: '',
				description:
					'A URL on this Canvas instance. When a password is set, the response contains this URL with a session token that logs the new user in.',
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'The email address of the user (their first communication channel)',
			},
			{
				displayName: 'Enable SIS Reactivation',
				name: 'enableSisReactivation',
				type: 'boolean',
				default: false,
				description:
					'Whether to first try to reactivate a deleted user with the same SIS User ID instead of creating a new one',
			},
			{
				displayName: 'Force Self Registration',
				name: 'forceSelfRegistration',
				type: 'boolean',
				default: false,
				description: 'Whether to send the user a self-registration email',
			},
			{
				displayName: 'Force Validations',
				name: 'forceValidations',
				type: 'boolean',
				default: false,
				description:
					'Whether to apply the validations of self-registration (name required, terms accepted, login ID must be an email address) even for an admin request',
			},
			{
				displayName: 'Integration ID',
				name: 'integrationId',
				type: 'string',
				default: '',
				description: 'Integration ID for the login (requires the "manage SIS" permission)',
			},
			{
				displayName: 'Locale',
				name: 'locale',
				type: 'string',
				default: '',
				description: 'The user\'s preferred language/locale (e.g., en, es, fr)',
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'User\'s initial password',
			},
			{
				displayName: 'Return Confirmation URL',
				name: 'confirmationUrl',
				type: 'boolean',
				default: false,
				description:
					'Whether to return the URL with which the new user confirms their email address (requires an email address)',
			},
			{
				displayName: 'Send Confirmation',
				name: 'sendConfirmation',
				type: 'boolean',
				default: true,
				description: 'Whether to send a confirmation email to the user',
			},
			{
				displayName: 'Short Name',
				name: 'shortName',
				type: 'string',
				default: '',
				description: 'User\'s display name (shown in discussions, etc.)',
			},
			{
				displayName: 'SIS User ID',
				name: 'sisUserId',
				type: 'string',
				default: '',
				description: 'SIS ID for the user (requires the "manage SIS" permission)',
			},
			{
				displayName: 'Skip Confirmation',
				name: 'skipConfirmation',
				type: 'boolean',
				default: false,
				description:
					'Whether to mark the email address as confirmed right away instead of sending a confirmation message',
			},
			{
				displayName: 'Skip Registration',
				name: 'skipRegistration',
				type: 'boolean',
				default: false,
				description:
					'Whether to mark the user as registered right away, so they do not have to complete the registration process',
			},
			{
				displayName: 'Sortable Name',
				name: 'sortableName',
				type: 'string',
				default: '',
				description: 'Name used for sorting (e.g., "Doe, John")',
			},
			{
				displayName: 'Terms of Use',
				name: 'termsOfUse',
				type: 'boolean',
				default: false,
				description: 'Whether the user has accepted terms of use',
			},
			{
				displayName: 'Time Zone',
				name: 'timeZone',
				type: 'string',
				default: '',
				description: 'User\'s time zone (e.g., America/Denver)',
			},
		],
	},

	// ----------------------------------
	//         user: update - Update Fields
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Avatar Token',
				name: 'avatarToken',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description:
					'Token of one of the avatars offered by Canvas for this user (from the user\'s avatar list). Takes precedence over "Avatar URL".',
			},
			{
				displayName: 'Avatar URL',
				name: 'avatarUrl',
				type: 'string',
				default: '',
				description: 'URL of an external avatar image',
			},
			{
				displayName: 'Bio',
				name: 'bio',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description:
					'User\'s biography. Profiles must be enabled on the root account, otherwise Canvas refuses the whole update.',
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'The default email address of the user',
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{ name: 'Suspend', value: 'suspend' },
					{ name: 'Unsuspend', value: 'unsuspend' },
				],
				default: 'suspend',
				description: 'Suspend or unsuspend all logins of the user',
			},
			{
				displayName: 'Locale',
				name: 'locale',
				type: 'string',
				default: '',
				description: 'User\'s preferred language/locale (e.g., en, es, fr)',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'User\'s full name',
			},
			{
				displayName: 'Override SIS Stickiness',
				name: 'overrideSisStickiness',
				type: 'boolean',
				default: true,
				description:
					'Whether to change fields that an SIS import may later overwrite (Canvas default: true). When turned off, fields marked as changed in Canvas ("sticky") are left alone.',
			},
			{
				displayName: 'Pronouns',
				name: 'pronouns',
				type: 'string',
				default: '',
				description:
					'User\'s pronouns. Must be one of the pronouns configured on the root account, where pronouns must be enabled; otherwise Canvas refuses the whole update.',
			},
			{
				displayName: 'Short Name',
				name: 'shortName',
				type: 'string',
				default: '',
				description: 'User\'s display name',
			},
			{
				displayName: 'Sortable Name',
				name: 'sortableName',
				type: 'string',
				default: '',
				description: 'Name used for sorting (e.g., "Doe, John")',
			},
			{
				displayName: 'Time Zone',
				name: 'timeZone',
				type: 'string',
				default: '',
				description: 'User\'s time zone (e.g., America/Denver)',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description:
					'User\'s title (e.g., Dr., Professor). Profiles must be enabled on the root account, otherwise Canvas refuses the whole update.',
			},
		],
	},
];
