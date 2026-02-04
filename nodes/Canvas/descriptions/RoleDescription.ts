import type { INodeProperties } from 'n8n-workflow';

export const roleOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['role'],
			},
		},
		options: [
			{
				name: 'Activate',
				value: 'activate',
				description: 'Re-activate an inactive role',
				action: 'Activate a role',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new role',
				action: 'Create a role',
			},
			{
				name: 'Deactivate',
				value: 'deactivate',
				description: 'Deactivate a role',
				action: 'Deactivate a role',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a single role',
				action: 'Get a role',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many roles',
				action: 'Get many roles',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a role',
				action: 'Update a role',
			},
		],
		default: 'getAll',
	},
];

export const roleFields: INodeProperties[] = [
	// ----------------------------------
	//         role: shared
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['role'],
				operation: ['create', 'get', 'getAll', 'update', 'activate', 'deactivate'],
			},
		},
		description: 'The ID of the account',
	},

	// ----------------------------------
	//         role: get, update, activate, deactivate
	// ----------------------------------
	{
		displayName: 'Role ID',
		name: 'roleId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['role'],
				operation: ['get', 'update', 'activate', 'deactivate'],
			},
		},
		description: 'The ID of the role',
	},

	// ----------------------------------
	//         role: getAll
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['role'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Show Inherited',
				name: 'show_inherited',
				type: 'boolean',
				default: false,
				description: 'Whether to include roles inherited from parent accounts',
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'multiOptions',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Inactive', value: 'inactive' },
				],
				default: [],
				description: 'Filter roles by state',
			},
		],
	},

	// ----------------------------------
	//         role: create
	// ----------------------------------
	{
		displayName: 'Label',
		name: 'label',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['role'],
				operation: ['create'],
			},
		},
		description: 'The label/name for the new role',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['role'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Base Role Type',
				name: 'base_role_type',
				type: 'options',
				options: [
					{ name: 'Account Membership', value: 'AccountMembership' },
					{ name: 'Designer Enrollment', value: 'DesignerEnrollment' },
					{ name: 'Observer Enrollment', value: 'ObserverEnrollment' },
					{ name: 'Student Enrollment', value: 'StudentEnrollment' },
					{ name: 'TA Enrollment', value: 'TaEnrollment' },
					{ name: 'Teacher Enrollment', value: 'TeacherEnrollment' },
				],
				default: 'AccountMembership',
				description: 'The base role type to derive this role from',
			},
			{
				displayName: 'Permissions',
				name: 'permissions',
				type: 'json',
				default: '{}',
				description: 'JSON object defining permission settings. Example: {"read_reports": {"enabled": true, "locked": false}}.',
			},
		],
	},

	// ----------------------------------
	//         role: update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['role'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Label',
				name: 'label',
				type: 'string',
				default: '',
				description: 'The new label/name for the role',
			},
			{
				displayName: 'Permissions',
				name: 'permissions',
				type: 'json',
				default: '{}',
				description: 'JSON object defining permission settings. Example: {"read_reports": {"enabled": true, "explicit": true}}.',
			},
		],
	},
];
