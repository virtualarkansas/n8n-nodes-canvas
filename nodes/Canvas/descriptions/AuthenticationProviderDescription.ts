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
				operation: ['create', 'delete', 'get', 'getAll', 'getSsoSettings', 'restore', 'update', 'updateSsoSettings'],
			},
		},
		description: 'The ID of the account',
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
		description: 'The ID of the authentication provider',
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
			{ name: 'Twitter', value: 'twitter' },
		],
		default: 'saml',
		description: 'The type of authentication provider',
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
		options: [
			{
				displayName: 'Auth Base',
				name: 'auth_base',
				type: 'string',
				default: '',
				description: 'The LDAP auth base for LDAP providers',
			},
			{
				displayName: 'Auth Filter',
				name: 'auth_filter',
				type: 'string',
				default: '',
				description: 'The LDAP auth filter for LDAP providers',
			},
			{
				displayName: 'Auth Host',
				name: 'auth_host',
				type: 'string',
				default: '',
				description: 'The host for CAS/LDAP providers',
			},
			{
				displayName: 'Auth Over TLS',
				name: 'auth_over_tls',
				type: 'options',
				options: [
					{ name: 'Simple TLS', value: 'simple_tls' },
					{ name: 'Start TLS', value: 'start_tls' },
				],
				default: 'start_tls',
				description: 'The TLS mode for LDAP providers',
			},
			{
				displayName: 'Auth Port',
				name: 'auth_port',
				type: 'number',
				default: 389,
				description: 'The port for CAS/LDAP providers',
			},
			{
				displayName: 'Auth Username',
				name: 'auth_username',
				type: 'string',
				default: '',
				description: 'The LDAP auth username for LDAP providers',
			},
			{
				displayName: 'Authorize URL',
				name: 'authorize_url',
				type: 'string',
				default: '',
				description: 'The authorization URL for OpenID Connect providers',
			},
			{
				displayName: 'Certificate Fingerprint',
				name: 'certificate_fingerprint',
				type: 'string',
				default: '',
				description: 'The certificate fingerprint for SAML providers',
			},
			{
				displayName: 'Client ID',
				name: 'client_id',
				type: 'string',
				default: '',
				description: 'The client ID for OAuth providers',
			},
			{
				displayName: 'Client Secret',
				name: 'client_secret',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				description: 'The client secret for OAuth providers',
			},
			{
				displayName: 'End Session Endpoint',
				name: 'end_session_endpoint',
				type: 'string',
				default: '',
				description: 'The end session endpoint for OpenID Connect providers',
			},
			{
				displayName: 'Federated Attributes',
				name: 'federated_attributes',
				type: 'json',
				default: '{}',
				description: 'A JSON object mapping Canvas user attributes to provider attributes',
			},
			{
				displayName: 'Identifier Format',
				name: 'identifier_format',
				type: 'string',
				default: '',
				description: 'The SAML identifier format',
			},
			{
				displayName: 'IdP Entity ID',
				name: 'idp_entity_id',
				type: 'string',
				default: '',
				description: 'The IdP entity ID for SAML providers',
			},
			{
				displayName: 'Issuer',
				name: 'issuer',
				type: 'string',
				default: '',
				description: 'The issuer for OpenID Connect providers',
			},
			{
				displayName: 'JIT Provisioning',
				name: 'jit_provisioning',
				type: 'boolean',
				default: false,
				description: 'Whether to enable just-in-time provisioning',
			},
			{
				displayName: 'JWKS URI',
				name: 'jwks_uri',
				type: 'string',
				default: '',
				description: 'The JWKS URI for OpenID Connect providers',
			},
			{
				displayName: 'Log In URL',
				name: 'log_in_url',
				type: 'string',
				default: '',
				description: 'The log in URL for SAML/CAS providers',
			},
			{
				displayName: 'Log Out URL',
				name: 'log_out_url',
				type: 'string',
				default: '',
				description: 'The log out URL for SAML providers',
			},
			{
				displayName: 'Login Attribute',
				name: 'login_attribute',
				type: 'string',
				default: '',
				description: 'The attribute to use for login identification',
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'string',
				default: '',
				description: 'The SAML metadata XML',
			},
			{
				displayName: 'Metadata URI',
				name: 'metadata_uri',
				type: 'string',
				default: '',
				description: 'The SAML metadata URI',
			},
			{
				displayName: 'MFA Required',
				name: 'mfa_required',
				type: 'boolean',
				default: false,
				description: 'Whether MFA is required for this provider',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 1,
				description: 'The position of the provider in the list',
			},
			{
				displayName: 'Requested Authn Context',
				name: 'requested_authn_context',
				type: 'string',
				default: '',
				description: 'The requested authentication context for SAML providers',
			},
			{
				displayName: 'Scopes',
				name: 'scopes',
				type: 'string',
				default: '',
				description: 'Comma-separated list of OAuth scopes',
			},
			{
				displayName: 'Sig Alg',
				name: 'sig_alg',
				type: 'options',
				options: [
					{ name: 'RSA-SHA1', value: 'RSA-SHA1' },
					{ name: 'RSA-SHA256', value: 'RSA-SHA256' },
				],
				default: 'RSA-SHA256',
				description: 'The signature algorithm for SAML providers',
			},
			{
				displayName: 'Skip Internal Lookup',
				name: 'skip_internal_lookup',
				type: 'boolean',
				default: false,
				description: 'Whether to skip internal lookup and rely only on provider response',
			},
			/* eslint-disable n8n-nodes-base/node-param-type-options-password-missing */
			{
				displayName: 'Token URL',
				name: 'token_url',
				type: 'string',
				default: '',
				description: 'The token URL for OpenID Connect providers',
			},
			/* eslint-enable n8n-nodes-base/node-param-type-options-password-missing */
			{
				displayName: 'User Info Endpoint',
				name: 'user_info_endpoint',
				type: 'string',
				default: '',
				description: 'The user info endpoint for OpenID Connect providers',
			},
		],
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
		options: [
			{
				displayName: 'Auth Base',
				name: 'auth_base',
				type: 'string',
				default: '',
				description: 'The LDAP auth base for LDAP providers',
			},
			{
				displayName: 'Auth Filter',
				name: 'auth_filter',
				type: 'string',
				default: '',
				description: 'The LDAP auth filter for LDAP providers',
			},
			{
				displayName: 'Auth Host',
				name: 'auth_host',
				type: 'string',
				default: '',
				description: 'The host for CAS/LDAP providers',
			},
			{
				displayName: 'Auth Over TLS',
				name: 'auth_over_tls',
				type: 'options',
				options: [
					{ name: 'Simple TLS', value: 'simple_tls' },
					{ name: 'Start TLS', value: 'start_tls' },
				],
				default: 'start_tls',
				description: 'The TLS mode for LDAP providers',
			},
			{
				displayName: 'Auth Port',
				name: 'auth_port',
				type: 'number',
				default: 389,
				description: 'The port for CAS/LDAP providers',
			},
			{
				displayName: 'Auth Username',
				name: 'auth_username',
				type: 'string',
				default: '',
				description: 'The LDAP auth username for LDAP providers',
			},
			{
				displayName: 'Authorize URL',
				name: 'authorize_url',
				type: 'string',
				default: '',
				description: 'The authorization URL for OpenID Connect providers',
			},
			{
				displayName: 'Certificate Fingerprint',
				name: 'certificate_fingerprint',
				type: 'string',
				default: '',
				description: 'The certificate fingerprint for SAML providers',
			},
			{
				displayName: 'Client ID',
				name: 'client_id',
				type: 'string',
				default: '',
				description: 'The client ID for OAuth providers',
			},
			{
				displayName: 'Client Secret',
				name: 'client_secret',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				description: 'The client secret for OAuth providers',
			},
			{
				displayName: 'End Session Endpoint',
				name: 'end_session_endpoint',
				type: 'string',
				default: '',
				description: 'The end session endpoint for OpenID Connect providers',
			},
			{
				displayName: 'Federated Attributes',
				name: 'federated_attributes',
				type: 'json',
				default: '{}',
				description: 'A JSON object mapping Canvas user attributes to provider attributes',
			},
			{
				displayName: 'Identifier Format',
				name: 'identifier_format',
				type: 'string',
				default: '',
				description: 'The SAML identifier format',
			},
			{
				displayName: 'IdP Entity ID',
				name: 'idp_entity_id',
				type: 'string',
				default: '',
				description: 'The IdP entity ID for SAML providers',
			},
			{
				displayName: 'Issuer',
				name: 'issuer',
				type: 'string',
				default: '',
				description: 'The issuer for OpenID Connect providers',
			},
			{
				displayName: 'JIT Provisioning',
				name: 'jit_provisioning',
				type: 'boolean',
				default: false,
				description: 'Whether to enable just-in-time provisioning',
			},
			{
				displayName: 'JWKS URI',
				name: 'jwks_uri',
				type: 'string',
				default: '',
				description: 'The JWKS URI for OpenID Connect providers',
			},
			{
				displayName: 'Log In URL',
				name: 'log_in_url',
				type: 'string',
				default: '',
				description: 'The log in URL for SAML/CAS providers',
			},
			{
				displayName: 'Log Out URL',
				name: 'log_out_url',
				type: 'string',
				default: '',
				description: 'The log out URL for SAML providers',
			},
			{
				displayName: 'Login Attribute',
				name: 'login_attribute',
				type: 'string',
				default: '',
				description: 'The attribute to use for login identification',
			},
			{
				displayName: 'Metadata',
				name: 'metadata',
				type: 'string',
				default: '',
				description: 'The SAML metadata XML',
			},
			{
				displayName: 'Metadata URI',
				name: 'metadata_uri',
				type: 'string',
				default: '',
				description: 'The SAML metadata URI',
			},
			{
				displayName: 'MFA Required',
				name: 'mfa_required',
				type: 'boolean',
				default: false,
				description: 'Whether MFA is required for this provider',
			},
			{
				displayName: 'Position',
				name: 'position',
				type: 'number',
				default: 1,
				description: 'The position of the provider in the list',
			},
			{
				displayName: 'Requested Authn Context',
				name: 'requested_authn_context',
				type: 'string',
				default: '',
				description: 'The requested authentication context for SAML providers',
			},
			{
				displayName: 'Scopes',
				name: 'scopes',
				type: 'string',
				default: '',
				description: 'Comma-separated list of OAuth scopes',
			},
			{
				displayName: 'Sig Alg',
				name: 'sig_alg',
				type: 'options',
				options: [
					{ name: 'RSA-SHA1', value: 'RSA-SHA1' },
					{ name: 'RSA-SHA256', value: 'RSA-SHA256' },
				],
				default: 'RSA-SHA256',
				description: 'The signature algorithm for SAML providers',
			},
			{
				displayName: 'Skip Internal Lookup',
				name: 'skip_internal_lookup',
				type: 'boolean',
				default: false,
				description: 'Whether to skip internal lookup and rely only on provider response',
			},
			/* eslint-disable n8n-nodes-base/node-param-type-options-password-missing */
			{
				displayName: 'Token URL',
				name: 'token_url',
				type: 'string',
				default: '',
				description: 'The token URL for OpenID Connect providers',
			},
			/* eslint-enable n8n-nodes-base/node-param-type-options-password-missing */
			{
				displayName: 'User Info Endpoint',
				name: 'user_info_endpoint',
				type: 'string',
				default: '',
				description: 'The user info endpoint for OpenID Connect providers',
			},
		],
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
			maxValue: 100,
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
		options: [
			{
				displayName: 'Auth Discovery URL',
				name: 'auth_discovery_url',
				type: 'string',
				default: '',
				description: 'A URL to redirect users for authentication discovery',
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
				description: 'The label to use for the login handle field',
			},
		],
	},
];
