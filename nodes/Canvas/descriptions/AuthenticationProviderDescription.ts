import type { INodeProperties } from 'n8n-workflow';

export const authenticationProviderOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['authenticationProvider'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new authentication provider',
				action: 'Create an authentication provider',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an authentication provider',
				action: 'Delete an authentication provider',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single authentication provider',
				action: 'Get an authentication provider',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many authentication providers',
				action: 'Get many authentication providers',
			},
			{
				name: 'Get SSO Settings',
				value: 'getSsoSettings',
				description: 'Get SSO settings for an account',
				action: 'Get SSO settings',
			},
			{
				name: 'Restore',
				value: 'restore',
				description: 'Restore a deleted authentication provider',
				action: 'Restore an authentication provider',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an authentication provider',
				action: 'Update an authentication provider',
			},
			{
				name: 'Update SSO Settings',
				value: 'updateSsoSettings',
				description: 'Update SSO settings for an account',
				action: 'Update SSO settings',
			},
		],
		default: 'getAll',
	},
];

// Provider types, as Canvas names them.
const OAUTH_TYPES = ['apple', 'clever', 'github', 'google', 'linkedin', 'openid_connect'];
const LOGIN_ATTRIBUTE_TYPES = [
	'apple',
	'clever',
	'facebook',
	'github',
	'google',
	'linkedin',
	'microsoft',
	'openid_connect',
	'saml',
];
const JIT_TYPES = [...LOGIN_ATTRIBUTE_TYPES, 'cas', 'ldap'];
const FEDERATED_TYPES = [...LOGIN_ATTRIBUTE_TYPES, 'cas'];
const MFA_TYPES = [...JIT_TYPES, 'canvas'];

/**
 * Every setting Canvas knows for authentication providers, with the provider
 * types that accept it. Canvas silently drops a setting sent to a type that
 * does not know it, so Create only offers the settings of the chosen type.
 */
const providerSettings: Array<{ types: string[]; field: INodeProperties }> = [
	{
		types: ['microsoft'],
		field: {
			displayName: 'Application ID',
			name: 'application_id',
			type: 'string',
			default: '',
			description: 'Microsoft: the application (client) ID',
		},
	},
	{
		types: ['microsoft'],
		field: {
			displayName: 'Application Secret',
			name: 'application_secret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Microsoft: the application secret',
		},
	},
	{
		types: ['facebook'],
		field: {
			displayName: 'App ID',
			name: 'app_id',
			type: 'string',
			default: '',
			description: 'Facebook: the app ID',
		},
	},
	{
		types: ['facebook'],
		field: {
			displayName: 'App Secret',
			name: 'app_secret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Facebook: the app secret',
		},
	},
	{
		types: ['openid_connect'],
		field: {
			displayName: 'Authorize URL',
			name: 'authorize_url',
			type: 'string',
			default: '',
			description: 'OpenID Connect: the URL to send users to for authorization',
		},
	},
	{
		types: ['cas', 'ldap'],
		field: {
			displayName: 'Base',
			name: 'auth_base',
			type: 'string',
			default: '',
			description:
				'CAS: the base URL of the CAS server. LDAP: the base DN for searches (e.g. "ou=people,dc=example,dc=edu").',
		},
	},
	{
		types: ['saml'],
		field: {
			displayName: 'Certificate Fingerprint',
			name: 'certificate_fingerprint',
			type: 'string',
			default: '',
			description: "SAML: the fingerprint of the identity provider's signing certificate",
		},
	},
	{
		types: OAUTH_TYPES,
		field: {
			displayName: 'Client ID',
			name: 'client_id',
			type: 'string',
			default: '',
			description: 'The OAuth client ID registered with the identity provider',
		},
	},
	{
		types: OAUTH_TYPES,
		field: {
			displayName: 'Client Secret',
			name: 'client_secret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'The OAuth client secret registered with the identity provider',
		},
	},
	{
		types: ['saml_idp_discovery'],
		field: {
			displayName: 'Discovery Service URL',
			name: 'discovery_service_url',
			type: 'string',
			default: '',
			description: 'SAML IdP Discovery: the URL of the discovery service',
		},
	},
	{
		types: ['openid_connect'],
		field: {
			displayName: 'Discovery URL',
			name: 'discovery_url',
			type: 'string',
			default: '',
			description:
				'OpenID Connect: the URL of the discovery document (".well-known/openid-configuration"). Canvas downloads it and fills in the endpoints.',
		},
	},
	{
		types: ['clever'],
		field: {
			displayName: 'District ID',
			name: 'district_id',
			type: 'string',
			default: '',
			description: 'Clever: only allow users of this district',
		},
	},
	{
		types: ['github'],
		field: {
			displayName: 'Domain',
			name: 'domain',
			type: 'string',
			default: '',
			description: 'GitHub: the domain of a GitHub Enterprise installation (leave empty for github.com)',
		},
	},
	{
		types: ['canvas'],
		field: {
			displayName: 'Enable Captcha',
			name: 'enable_captcha',
			type: 'boolean',
			default: true,
			description: 'Whether self-registration requires a captcha (Canvas authentication)',
		},
	},
	{
		types: ['openid_connect'],
		field: {
			displayName: 'End Session Endpoint',
			name: 'end_session_endpoint',
			type: 'string',
			default: '',
			description: 'OpenID Connect: the URL to send users to when they log out',
		},
	},
	{
		types: FEDERATED_TYPES,
		field: {
			displayName: 'Federated Attributes',
			name: 'federated_attributes',
			type: 'json',
			default: '{}',
			description:
				'JSON object mapping Canvas user attributes to attributes of the identity provider, e.g. {"email": "mail", "display_name": {"attribute": "name", "provisioning_only": true}}',
		},
	},
	{
		types: ['ldap'],
		field: {
			displayName: 'Filter',
			name: 'auth_filter',
			type: 'string',
			default: '',
			description: 'LDAP: the search filter; "{{login}}" is replaced with the login name',
		},
	},
	{
		types: ['ldap'],
		field: {
			displayName: 'Host',
			name: 'auth_host',
			type: 'string',
			default: '',
			description: 'LDAP: the host name of the server',
		},
	},
	{
		types: ['google'],
		field: {
			displayName: 'Hosted Domain',
			name: 'hosted_domain',
			type: 'string',
			default: '',
			description: 'Google: only allow accounts of this Google Workspace domain',
		},
	},
	{
		types: ['ldap', 'saml'],
		field: {
			displayName: 'Identifier Format',
			name: 'identifier_format',
			type: 'string',
			default: '',
			description:
				'SAML: the NameID format to request (e.g. "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"). LDAP: the attribute that holds the login (e.g. "uid").',
		},
	},
	{
		types: ['saml'],
		field: {
			displayName: 'IdP Entity ID',
			name: 'idp_entity_id',
			type: 'string',
			default: '',
			description: 'SAML: the entity ID of the identity provider',
		},
	},
	{
		types: ['openid_connect'],
		field: {
			displayName: 'Issuer',
			name: 'issuer',
			type: 'string',
			default: '',
			description: 'OpenID Connect: the issuer identifier',
		},
	},
	{
		types: JIT_TYPES,
		field: {
			displayName: 'JIT Provisioning',
			name: 'jit_provisioning',
			type: 'boolean',
			default: true,
			description: 'Whether to create users that do not exist yet when they log in',
		},
	},
	{
		types: ['openid_connect'],
		field: {
			displayName: 'JWKS URI',
			name: 'jwks_uri',
			type: 'string',
			default: '',
			description: 'OpenID Connect: the URL of the JSON Web Key Set. Canvas downloads it when saving.',
		},
	},
	{
		types: ['cas', 'saml'],
		field: {
			displayName: 'Log In URL',
			name: 'log_in_url',
			type: 'string',
			default: '',
			description: 'The URL to send users to for logging in (CAS and SAML)',
		},
	},
	{
		types: ['saml'],
		field: {
			displayName: 'Log Out URL',
			name: 'log_out_url',
			type: 'string',
			default: '',
			description: 'SAML: the URL to send users to when they log out',
		},
	},
	{
		types: LOGIN_ATTRIBUTE_TYPES,
		field: {
			displayName: 'Login Attribute',
			name: 'login_attribute',
			type: 'string',
			default: '',
			description:
				'The attribute of the identity provider that is matched against Canvas logins (e.g. "NameID" for SAML, "sub" or "email" for OpenID Connect and Google, "tid+oid" for Microsoft)',
		},
	},
	{
		types: ['saml'],
		field: {
			displayName: 'Metadata',
			name: 'metadata',
			type: 'string',
			typeOptions: { rows: 4 },
			default: '',
			description: 'SAML: the metadata XML of the identity provider. Canvas fills in the other SAML settings from it.',
		},
	},
	{
		types: ['saml'],
		field: {
			displayName: 'Metadata URI',
			name: 'metadata_uri',
			type: 'string',
			default: '',
			description: 'SAML: a URL to download the metadata of the identity provider from',
		},
	},
	{
		types: MFA_TYPES,
		field: {
			displayName: 'MFA Required',
			name: 'mfa_required',
			type: 'boolean',
			default: true,
			description:
				'Whether users of this provider must use multi-factor authentication in Canvas. Only has an effect when multi-factor authentication is set to optional in the account settings.',
		},
	},
	{
		types: MFA_TYPES,
		field: {
			displayName: 'OTP via SMS',
			name: 'otp_via_sms',
			type: 'boolean',
			default: true,
			description: 'Whether one-time passwords for multi-factor authentication may be sent by SMS',
		},
	},
	{
		types: ['saml'],
		field: {
			displayName: 'Parent Registration',
			name: 'parent_registration',
			type: 'boolean',
			default: true,
			description: 'Whether this SAML provider is used for the parent (observer) self-registration',
		},
	},
	{
		types: ['ldap'],
		field: {
			displayName: 'Password',
			name: 'auth_password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'LDAP: the password of the account Canvas binds with',
		},
	},
	{
		types: ['ldap'],
		field: {
			displayName: 'Port',
			name: 'auth_port',
			type: 'number',
			default: 636,
			description: 'LDAP: the port of the server (usually 636 for TLS, 389 for StartTLS)',
		},
	},
	{
		types: [...MFA_TYPES, 'saml_idp_discovery'],
		field: {
			displayName: 'Position',
			name: 'position',
			type: 'number',
			default: 1,
			description:
				'The position of the provider in the list. The first provider is the default one on the login page.',
		},
	},
	{
		types: ['saml'],
		field: {
			displayName: 'Requested Authn Context',
			name: 'requested_authn_context',
			type: 'string',
			default: '',
			description: 'SAML: the authentication context class to request from the identity provider',
		},
	},
	{
		types: ['openid_connect'],
		field: {
			displayName: 'Scope',
			name: 'scope',
			type: 'string',
			default: '',
			description: 'OpenID Connect: space-separated scopes to request in addition to "openid" (e.g. "email profile")',
		},
	},
	{
		types: ['canvas'],
		field: {
			displayName: 'Self Registration',
			name: 'self_registration',
			type: 'options',
			options: [
				{ name: 'All', value: 'all' },
				{ name: 'None', value: 'none' },
				{ name: 'Observers Only', value: 'observer' },
			],
			default: 'none',
			description: 'Who may register themselves (Canvas authentication)',
		},
	},
	{
		types: ['saml'],
		field: {
			displayName: 'Signature Algorithm',
			name: 'sig_alg',
			type: 'options',
			options: [
				{ name: 'RSA-SHA1', value: 'RSA-SHA1' },
				{ name: 'RSA-SHA256', value: 'RSA-SHA256' },
			],
			default: 'RSA-SHA256',
			description: 'SAML: the algorithm Canvas signs its requests with',
		},
	},
	{
		types: MFA_TYPES,
		field: {
			displayName: 'Skip Internal MFA',
			name: 'skip_internal_mfa',
			type: 'boolean',
			default: true,
			description:
				'Whether to skip Canvas multi-factor authentication because the identity provider already enforces it',
		},
	},
	{
		types: ['saml'],
		field: {
			displayName: 'Strip Domain From Login Attribute',
			name: 'strip_domain_from_login_attribute',
			type: 'boolean',
			default: true,
			description: 'Whether to remove "@domain" from the login attribute before matching it (SAML)',
		},
	},
	{
		types: ['microsoft'],
		field: {
			displayName: 'Tenant',
			name: 'tenant',
			type: 'string',
			default: '',
			description:
				'Microsoft: the tenant to allow ("common" for any account, "microsoft" for personal accounts, or a tenant ID)',
		},
	},
	{
		types: ['ldap'],
		field: {
			displayName: 'TLS',
			name: 'auth_over_tls',
			type: 'options',
			options: [
				{ name: 'Simple TLS', value: 'simple_tls' },
				{ name: 'StartTLS', value: 'start_tls' },
			],
			default: 'start_tls',
			description: 'LDAP: how the connection is encrypted',
		},
	},
	{
		types: ['openid_connect'],
		field: {
			displayName: 'Token Endpoint Auth Method',
			name: 'token_endpoint_auth_method',
			type: 'options',
			options: [
				{ name: 'Client Secret Basic', value: 'client_secret_basic' },
				{ name: 'Client Secret Post', value: 'client_secret_post' },
			],
			default: 'client_secret_post',
			description: 'OpenID Connect: how Canvas authenticates against the token endpoint',
		},
	},
	/* eslint-disable n8n-nodes-base/node-param-type-options-password-missing */
	{
		types: ['openid_connect'],
		field: {
			displayName: 'Token URL',
			name: 'token_url',
			type: 'string',
			default: '',
			description: 'OpenID Connect: the URL of the token endpoint',
		},
	},
	/* eslint-enable n8n-nodes-base/node-param-type-options-password-missing */
	{
		types: ['openid_connect'],
		field: {
			displayName: 'Userinfo Endpoint',
			name: 'userinfo_endpoint',
			type: 'string',
			default: '',
			description: 'OpenID Connect: the URL of the userinfo endpoint',
		},
	},
	{
		types: ['ldap'],
		field: {
			displayName: 'Username',
			name: 'auth_username',
			type: 'string',
			default: '',
			description: 'LDAP: the DN of the account Canvas binds with',
		},
	},
];

/** For Create: each setting is only offered for the provider types that accept it. */
const settingsForCreate: INodeProperties[] = providerSettings.map(({ types, field }) => ({
	...field,
	displayOptions: { show: { '/authType': types } },
}));

/** For Update the type is not known up front, so every setting is offered. */
const settingsForUpdate: INodeProperties[] = providerSettings.map(({ field }) => field);

export const authenticationProviderFields: INodeProperties[] = [
	// ----------------------------------
	//         authenticationProvider: shared
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['authenticationProvider'],
				operation: [
					'create',
					'delete',
					'get',
					'getAll',
					'getSsoSettings',
					'restore',
					'update',
					'updateSsoSettings',
				],
			},
		},
		description:
			'The ID of the account. Authentication is configured on root accounts only ("self" for the account of the Canvas URL).',
	},
	{
		displayName: 'Provider ID',
		name: 'providerId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['authenticationProvider'],
				operation: ['delete', 'get', 'restore', 'update'],
			},
		},
		description:
			'The ID of the authentication provider. Get, Update and Delete also accept a provider type (e.g. "saml") to address the first provider of that type.',
	},

	// ----------------------------------
	//         authenticationProvider: create
	// ----------------------------------
	{
		displayName: 'Auth Type',
		name: 'authType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['authenticationProvider'],
				operation: ['create'],
			},
		},
		options: [
			{ name: 'Apple', value: 'apple' },
			{ name: 'Canvas', value: 'canvas' },
			{ name: 'CAS', value: 'cas' },
			{ name: 'Clever', value: 'clever' },
			{ name: 'Facebook', value: 'facebook' },
			{ name: 'GitHub', value: 'github' },
			{ name: 'Google', value: 'google' },
			{ name: 'LDAP', value: 'ldap' },
			{ name: 'LinkedIn', value: 'linkedin' },
			{ name: 'Microsoft', value: 'microsoft' },
			{ name: 'OpenID Connect', value: 'openid_connect' },
			{ name: 'SAML', value: 'saml' },
			{ name: 'SAML IdP Discovery', value: 'saml_idp_discovery' },
		],
		default: 'saml',
		description: 'The type of authentication provider. The type of an existing provider cannot be changed.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['authenticationProvider'],
				operation: ['create'],
			},
		},
		description: 'The settings of the chosen provider type',
		options: settingsForCreate,
	},

	// ----------------------------------
	//         authenticationProvider: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['authenticationProvider'],
				operation: ['update'],
			},
		},
		description:
			'The settings to change. Canvas ignores settings that do not belong to the type of the provider.',
		options: settingsForUpdate,
	},

	// ----------------------------------
	//         authenticationProvider: getAll - options
	// ----------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['authenticationProvider'],
				operation: ['getAll'],
			},
		},
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
		},
		displayOptions: {
			show: {
				resource: ['authenticationProvider'],
				operation: ['getAll'],
				returnAll: [false],
			},
		},
		description: 'Max number of results to return',
	},

	// ----------------------------------
	//         authenticationProvider: updateSsoSettings
	// ----------------------------------
	{
		displayName: 'SSO Settings',
		name: 'ssoSettings',
		type: 'collection',
		placeholder: 'Add Setting',
		default: {},
		displayOptions: {
			show: {
				resource: ['authenticationProvider'],
				operation: ['updateSsoSettings'],
			},
		},
		description:
			'Settings that are left out stay as they are. A setting that is added but left empty is cleared.',
		options: [
			{
				displayName: 'Auth Discovery URL',
				name: 'auth_discovery_url',
				type: 'string',
				default: '',
				description:
					'A URL Canvas redirects every login to, so users can choose how to authenticate. Setting it changes the login page for everyone.',
			},
			/* eslint-disable n8n-nodes-base/node-param-type-options-password-missing */
			{
				displayName: 'Change Password URL',
				name: 'change_password_url',
				type: 'string',
				default: '',
				description: 'A URL where users can change their password',
			},
			/* eslint-enable n8n-nodes-base/node-param-type-options-password-missing */
			{
				displayName: 'Login Handle Name',
				name: 'login_handle_name',
				type: 'string',
				default: '',
				description: 'The label to use for the login field on the login page (e.g. "Student ID")',
			},
			{
				displayName: 'Login Help URL',
				name: 'login_help_url',
				type: 'string',
				default: '',
				description: 'A URL with help for users who cannot log in',
			},
			{
				displayName: 'Unknown User URL',
				name: 'unknown_user_url',
				type: 'string',
				default: '',
				description:
					'A URL to send users to who authenticated with the identity provider but do not exist in Canvas',
			},
		],
	},
];
