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
				name: 'Expire Mobile Sessions',
				value: 'expireMobileSessions',
				description: 'Log a user out of the Canvas mobile apps: expires their access tokens issued to mobile apps',
				action: 'Expire the mobile sessions of a user',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single user by ID',
				action: 'Get a user',
			},
			{
				name: 'Get Activity Stream',
				value: 'getActivityStream',
				description: 'List the activity stream of the current user (the user of the credential)',
				action: 'Get the activity stream of the current user',
			},
			{
				name: 'Get Activity Stream Summary',
				value: 'getActivityStreamSummary',
				description: 'Count the items in the current user\'s activity stream, total and unread, per type',
				action: 'Get the activity stream summary of the current user',
			},
			{
				name: 'Get Avatars',
				value: 'getAvatars',
				description: 'List the avatars a user can choose from, with the token that selects each one in Update',
				action: 'Get the available avatars of a user',
			},
			{
				name: 'Get Custom Color',
				value: 'getColor',
				description: 'Get the color a user has chosen for a course, group or other context',
				action: 'Get a custom color of a user',
			},
			{
				name: 'Get Custom Colors',
				value: 'getColors',
				description: 'Get all colors a user has chosen for courses, groups and other contexts',
				action: 'Get the custom colors of a user',
			},
			{
				name: 'Get Dashboard Positions',
				value: 'getDashboardPositions',
				description: 'Get the positions a user has given to the cards on their dashboard',
				action: 'Get the dashboard positions of a user',
			},
			{
				name: 'Get Graded Submissions',
				value: 'getGradedSubmissions',
				description: 'List the graded submissions of a user, most recently graded first',
				action: 'Get the graded submissions of a user',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many users from an account',
				action: 'Get many users',
			},
			{
				name: 'Get Missing Submissions',
				value: 'getMissingSubmissions',
				description: 'List the past-due assignments a student has not submitted',
				action: 'Get the missing submissions of a user',
			},
			{
				name: 'Get Page Views',
				value: 'getPageViews',
				description:
					'List the page views of a user, newest first. Needs permission to view usage statistics: users cannot read their own.',
				action: 'Get the page views of a user',
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
				name: 'Get Settings',
				value: 'getSettings',
				description: 'Get the interface settings of a user',
				action: 'Get the settings of a user',
			},
			{
				name: 'Get To-Do Item Count',
				value: 'getTodoItemCount',
				description: 'Count what the current user has to grade and to submit',
				action: 'Get the to do item count of the current user',
			},
			{
				name: 'Get To-Do Items',
				value: 'getTodoItems',
				description: 'List the assignments the current user has to grade or to submit',
				action: 'Get the to do items of the current user',
			},
			{
				name: 'Get Upcoming Events',
				value: 'getUpcomingEvents',
				description: 'List the calendar events and assignments coming up for the current user',
				action: 'Get the upcoming events of the current user',
			},
			{
				name: 'Hide All Stream Items',
				value: 'hideAllStreamItems',
				description: 'Hide every item in the activity stream of the current user',
				action: 'Hide all activity stream items of the current user',
			},
			{
				name: 'Hide Stream Item',
				value: 'hideStreamItem',
				description: 'Hide one item in the activity stream of the current user',
				action: 'Hide an activity stream item of the current user',
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
				name: 'Set Custom Color',
				value: 'setColor',
				description: 'Set the color in which a user sees a course, group or other context',
				action: 'Set a custom color of a user',
			},
			{
				name: 'Set Files UI Version',
				value: 'setFilesUiVersion',
				description: 'Choose which version of the Files page a user gets',
				action: 'Set the files UI version of a user',
			},
			{
				name: 'Set Text Editor Preference',
				value: 'setTextEditorPreference',
				description: 'Choose the editor Canvas opens for a user where it offers a choice',
				action: 'Set the text editor preference of a user',
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
			{
				name: 'Update Dashboard Positions',
				value: 'updateDashboardPositions',
				description: 'Set the positions of cards on the dashboard of a user',
				action: 'Update the dashboard positions of a user',
			},
			{
				name: 'Update Settings',
				value: 'updateSettings',
				description: 'Change the interface settings of a user',
				action: 'Update the settings of a user',
			},
		],
		default: 'getAll',
	},
];

const ASSET_STRING_DESCRIPTION =
	'The context in the form "type_ID", e.g. "course_42", "group_7" or "user_3"';

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
				operation: [
					'get',
					'update',
					'delete',
					'restore',
					'getProfile',
					'split',
					'terminateSessions',
					'expireMobileSessions',
					'getAvatars',
					'getColor',
					'getColors',
					'getDashboardPositions',
					'getGradedSubmissions',
					'getMissingSubmissions',
					'getPageViews',
					'getSettings',
					'setColor',
					'setFilesUiVersion',
					'setTextEditorPreference',
					'updateDashboardPositions',
					'updateSettings',
				],
			},
		},
		description:
			'The ID of the user. "self" selects the current user; SIS IDs work in the form "sis_user_id:ABC".',
	},

	// ----------------------------------
	//         user: custom colors
	// ----------------------------------
	{
		displayName: 'Asset',
		name: 'assetString',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'course_42',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['getColor', 'setColor'],
			},
		},
		description: `${ASSET_STRING_DESCRIPTION}. Canvas answers "not found" when the user has no color for it (Get) or when it does not exist (Set).`,
	},
	{
		displayName: 'Color',
		name: 'hexcode',
		type: 'color',
		required: true,
		default: '',
		placeholder: '#0b874b',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['setColor'],
			},
		},
		description: 'The color as a hex code with three or six digits, with or without the leading "#"',
	},

	// ----------------------------------
	//         user: dashboard positions
	// ----------------------------------
	{
		displayName: 'Positions',
		name: 'positions',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Position',
		default: {},
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['updateDashboardPositions'],
			},
		},
		description:
			'The dashboard cards to place (at least one). Positions of cards that are not listed stay as they are. The user of the credential must be able to see each course or group.',
		options: [
			{
				displayName: 'Position',
				name: 'position',
				values: [
					{
						displayName: 'Asset',
						name: 'assetString',
						type: 'string',
						default: '',
						placeholder: 'course_42',
						description: ASSET_STRING_DESCRIPTION,
					},
					{
						displayName: 'Position',
						name: 'position',
						type: 'number',
						default: 0,
						description: 'The position of the card: a whole number, lowest first (at most 1000)',
					},
				],
			},
		],
	},

	// ----------------------------------
	//         user: interface preferences
	// ----------------------------------
	{
		displayName: 'Text Editor',
		name: 'textEditorPreference',
		type: 'options',
		options: [
			{ name: 'Block Editor', value: 'block_editor' },
			{ name: 'No Preference', value: '', description: 'Clear the preference: Canvas asks the user again' },
			{ name: 'Rich Content Editor', value: 'rce' },
		],
		default: 'rce',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['setTextEditorPreference'],
			},
		},
		description: 'The editor Canvas preselects for the user where it lets them choose between the two',
	},
	{
		displayName: 'Files UI Version',
		name: 'filesUiVersion',
		type: 'options',
		options: [
			{ name: 'Version 1 (Classic)', value: 'v1' },
			{ name: 'Version 2 (New)', value: 'v2' },
		],
		default: 'v2',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['setFilesUiVersion'],
			},
		},
		description: 'The version of the Files page the user gets where the account lets users switch',
	},

	// ----------------------------------
	//         user: activity stream
	// ----------------------------------
	{
		displayName: 'Stream Item ID',
		name: 'streamItemId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['hideStreamItem'],
			},
		},
		description:
			'The ID of the activity stream item to hide (the "ID" of an item from Get Activity Stream). Canvas answers "hidden" for any ID, also for one that is not in the stream.',
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

	// ----------------------------------
	//         user: updateSettings - Update Fields
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Setting',
		default: {},
		displayOptions: {
			show: {
				resource: ['user'],
				operation: ['updateSettings'],
			},
		},
		description: 'The settings to change. Settings that are not added keep their value.',
		options: [
			{
				displayName: 'Collapse Course Navigation',
				name: 'collapseCourseNav',
				type: 'boolean',
				default: true,
				description: 'Whether course pages load with the course navigation collapsed',
			},
			{
				displayName: 'Collapse Global Navigation',
				name: 'collapseGlobalNav',
				type: 'boolean',
				default: true,
				description: 'Whether pages load with the global navigation collapsed',
			},
			{
				displayName: 'Comment Library Suggestions',
				name: 'commentLibrarySuggestionsEnabled',
				type: 'boolean',
				default: true,
				description: 'Whether the comment library shows suggestions while the user types a comment',
			},
			{
				displayName: 'Disable Elementary Dashboard',
				name: 'elementaryDashboardDisabled',
				type: 'boolean',
				default: true,
				description:
					'Whether the user gets the classic dashboard instead of the Canvas for Elementary one',
			},
			{
				displayName: 'Hide Dashboard Card Color Overlays',
				name: 'hideDashcardColorOverlays',
				type: 'boolean',
				default: true,
				description: 'Whether images on course cards are shown without the tint of the course color',
			},
			{
				displayName: 'Hide Release Notes Badge',
				name: 'releaseNotesBadgeDisabled',
				type: 'boolean',
				default: true,
				description: 'Whether to hide the badge that announces new release notes',
			},
			{
				displayName: 'Manual Mark as Read',
				name: 'manualMarkAsRead',
				type: 'boolean',
				default: true,
				description:
					'Whether discussion posts stay unread until the user marks them as read (instead of being marked automatically)',
			},
			{
				displayName: 'Widget Dashboard',
				name: 'widgetDashboardUserPreference',
				type: 'boolean',
				default: true,
				description:
					'Whether the user gets the widget dashboard (only has an effect where the account offers that dashboard)',
			},
			{
				displayName: 'Widget Dashboard Dark Mode',
				name: 'widgetDashboardDarkMode',
				type: 'boolean',
				default: true,
				description: 'Whether the widget dashboard uses its dark color theme',
			},
		],
	},

	// ----------------------------------
	//         user: expireMobileSessions - Additional Fields
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
				operation: ['expireMobileSessions'],
			},
		},
		options: [
			{
				displayName: 'Skip Admins',
				name: 'skipAdmins',
				type: 'boolean',
				default: true,
				description:
					'Whether to leave the mobile sessions alone when the user is an administrator of the root account',
			},
		],
	},

	// ----------------------------------
	//         user: getPageViews - Additional Fields
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
				operation: ['getPageViews'],
			},
		},
		options: [
			{
				displayName: 'End Time',
				name: 'endTime',
				type: 'dateTime',
				default: '',
				description: 'Only return page views up to this time. Must not be before the start time.',
			},
			{
				displayName: 'Start Time',
				name: 'startTime',
				type: 'dateTime',
				default: '',
				description: 'Only return page views from this time on. Must not be in the future.',
			},
		],
	},

	// ----------------------------------
	//         user: getMissingSubmissions - Additional Fields
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
				operation: ['getMissingSubmissions'],
			},
		},
		options: [
			{
				displayName: 'Course IDs',
				name: 'courseIds',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of course IDs. Only assignments of these courses are returned. Required together with "Observed User ID".',
			},
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'multiOptions',
				options: [
					{
						name: 'Current Grading Period',
						value: 'current_grading_period',
						description: 'Only assignments in the current grading period of their course',
					},
					{
						name: 'Submittable',
						value: 'submittable',
						description: 'Only assignments that can still be submitted (not locked)',
					},
				],
				default: [],
				description: 'Restrict the list of missing assignments',
			},
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{ name: 'Course', value: 'course' },
					{
						name: 'Planner Overrides',
						value: 'planner_overrides',
						description: 'The planner override the student has set for the assignment, if any',
					},
				],
				default: [],
				description: 'Additional data to include with each assignment',
			},
			{
				displayName: 'Observed User ID',
				name: 'observedUserId',
				type: 'string',
				default: '',
				description:
					'For observers: return the missing submissions of this observed student ("User ID" is then the observer, usually "self"). The observer must observe the student in the courses given in "Course IDs".',
			},
		],
	},

	// ----------------------------------
	//         user: getGradedSubmissions - Additional Fields
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
				operation: ['getGradedSubmissions'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [{ name: 'Assignment', value: 'assignment' }],
				default: [],
				description: 'Additional data to include with each submission',
			},
			{
				displayName: 'Only Current Enrollments',
				name: 'onlyCurrentEnrollments',
				type: 'boolean',
				default: true,
				description: 'Whether to return only submissions in courses the user is currently enrolled in',
			},
			{
				displayName: 'Only Published Assignments',
				name: 'onlyPublishedAssignments',
				type: 'boolean',
				default: true,
				description: 'Whether to return only submissions for published assignments',
			},
		],
	},

	// ----------------------------------
	//         user: getActivityStream, getActivityStreamSummary - Additional Fields
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
				operation: ['getActivityStream', 'getActivityStreamSummary'],
			},
		},
		options: [
			{
				displayName: 'Only Active Courses',
				name: 'onlyActiveCourses',
				type: 'boolean',
				default: true,
				description:
					'Whether to return only items of courses the user actively takes part in. This also leaves out items that belong to no course, such as conversations.',
			},
		],
	},

	// ----------------------------------
	//         user: getTodoItems, getTodoItemCount - Additional Fields
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
				operation: ['getTodoItems', 'getTodoItemCount'],
			},
		},
		options: [
			{
				displayName: 'Include',
				name: 'include',
				type: 'multiOptions',
				options: [
					{
						name: 'Ungraded Quizzes',
						value: 'ungraded_quizzes',
						description:
							'Practice quizzes and surveys the user still has to take (returned under "quiz" instead of "assignment")',
					},
				],
				default: [],
				description: 'Additional items to include',
			},
		],
	},
];
