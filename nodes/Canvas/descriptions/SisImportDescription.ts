import type { INodeProperties } from 'n8n-workflow';

export const sisImportOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['sisImport'],
			},
		},
		options: [
			{
				name: 'Abort',
				value: 'abort',
				description: 'Abort a SIS import',
				action: 'Abort a SIS import',
			},
			{
				name: 'Abort All Pending',
				value: 'abortAllPending',
				description: 'Abort all pending SIS imports',
				action: 'Abort all pending SIS imports',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Import SIS data from a CSV or ZIP file',
				action: 'Create a SIS import',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the status of a SIS import',
				action: 'Get a SIS import',
			},
			{
				name: 'Get Current',
				value: 'getCurrent',
				description: 'Get the currently processing SIS import',
				action: 'Get current SIS import',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many SIS imports',
				action: 'Get many SIS imports',
			},
			{
				name: 'Restore States',
				value: 'restoreStates',
				description: 'Restore workflow states from a SIS import',
				action: 'Restore states from a SIS import',
			},
		],
		default: 'getAll',
	},
];

export const sisImportFields: INodeProperties[] = [
	// ----------------------------------
	//         sisImport: shared
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['sisImport'],
			},
		},
		description: 'The ID of the account',
	},

	// ----------------------------------
	//         sisImport: get, abort, restoreStates
	// ----------------------------------
	{
		displayName: 'Import ID',
		name: 'importId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['sisImport'],
				operation: ['get', 'abort', 'restoreStates'],
			},
		},
		description: 'The ID of the SIS import',
	},

	// ----------------------------------
	//         sisImport: create
	// ----------------------------------
	{
		displayName: 'Input Data Field Name',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		displayOptions: {
			show: {
				resource: ['sisImport'],
				operation: ['create'],
			},
		},
		description: 'The name of the incoming field containing the binary file data (CSV or ZIP) to import',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['sisImport'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Add SIS Stickiness',
				name: 'add_sis_stickiness',
				type: 'boolean',
				default: false,
				description: 'Whether to process changes as UI changes (requires Override SIS Stickiness)',
			},
			{
				displayName: 'Batch Mode',
				name: 'batch_mode',
				type: 'boolean',
				default: false,
				description: 'Whether to enable batch mode which deletes data not included in the import',
			},
			{
				displayName: 'Batch Mode Enrollment Drop Status',
				name: 'batch_mode_enrollment_drop_status',
				type: 'options',
				options: [
					{ name: 'Completed', value: 'completed' },
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Inactive', value: 'inactive' },
				],
				default: 'deleted',
				description: 'The status to set for enrollments dropped during multi-term batch mode',
			},
			{
				displayName: 'Batch Mode Term ID',
				name: 'batch_mode_term_id',
				type: 'string',
				default: '',
				description: 'Required when batch mode is enabled; limits deletions to this term',
			},
			{
				displayName: 'Change Threshold',
				name: 'change_threshold',
				type: 'number',
				default: 0,
				description: 'Abort the import if the number of deletions exceeds this percentage (0-100)',
			},
			{
				displayName: 'Clear SIS Stickiness',
				name: 'clear_sis_stickiness',
				type: 'boolean',
				default: false,
				description: 'Whether to clear stickiness from fields (requires Override SIS Stickiness)',
			},
			{
				displayName: 'Diff Row Count Threshold',
				name: 'diff_row_count_threshold',
				type: 'number',
				default: 0,
				description: 'Abort diffing if the row count exceeds this threshold',
			},
			{
				displayName: 'Diffing Data Set Identifier',
				name: 'diffing_data_set_identifier',
				type: 'string',
				default: '',
				description: 'Compare against a previous import set; incompatible with batch mode',
			},
			{
				displayName: 'Diffing Drop Status',
				name: 'diffing_drop_status',
				type: 'options',
				options: [
					{ name: 'Completed', value: 'completed' },
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Inactive', value: 'inactive' },
				],
				default: 'deleted',
				description: 'The status to set for enrollments excluded during diffing',
			},
			{
				displayName: 'Diffing Remaster Data Set',
				name: 'diffing_remaster_data_set',
				type: 'boolean',
				default: false,
				description: 'Whether to include this import in the dataset without performing diffing',
			},
			{
				displayName: 'Diffing User Remove Status',
				name: 'diffing_user_remove_status',
				type: 'options',
				options: [
					{ name: 'Deleted', value: 'deleted' },
					{ name: 'Suspended', value: 'suspended' },
				],
				default: 'deleted',
				description: 'The status to set for users removed during diffing',
			},
			{
				displayName: 'Extension',
				name: 'extension',
				type: 'options',
				options: [
					{ name: 'CSV', value: 'csv' },
					{ name: 'XML', value: 'xml' },
					{ name: 'ZIP', value: 'zip' },
				],
				default: 'csv',
				description: 'The file extension of the import file',
			},
			{
				displayName: 'Import Type',
				name: 'import_type',
				type: 'string',
				default: 'instructure_csv',
				description: 'The data format of the import file',
			},
			{
				displayName: 'Multi-Term Batch Mode',
				name: 'multi_term_batch_mode',
				type: 'boolean',
				default: false,
				description: 'Whether to run batch mode across all terms in the file (requires Change Threshold)',
			},
			{
				displayName: 'Override SIS Stickiness',
				name: 'override_sis_stickiness',
				type: 'boolean',
				default: false,
				description: 'Whether to override UI changes and sticky fields',
			},
			{
				displayName: 'Skip Deletes',
				name: 'skip_deletes',
				type: 'boolean',
				default: false,
				description: 'Whether to skip all deletions during the import',
			},
			{
				displayName: 'Update SIS ID If Login Claimed',
				name: 'update_sis_id_if_login_claimed',
				type: 'boolean',
				default: false,
				description: 'Whether to override non-matching SIS ID if a login is found',
			},
		],
	},

	// ----------------------------------
	//         sisImport: getAll - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['sisImport'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Created Before',
				name: 'created_before',
				type: 'dateTime',
				default: '',
				description: 'Filter imports created before this date (ISO 8601 format)',
			},
			{
				displayName: 'Created Since',
				name: 'created_since',
				type: 'dateTime',
				default: '',
				description: 'Filter imports created after this date (ISO 8601 format)',
			},
			{
				displayName: 'Workflow State',
				name: 'workflow_state',
				type: 'multiOptions',
				options: [
					{ name: 'Aborted', value: 'aborted' },
					{ name: 'Cleanup Batch', value: 'cleanup_batch' },
					{ name: 'Created', value: 'created' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'Failed With Messages', value: 'failed_with_messages' },
					{ name: 'Imported', value: 'imported' },
					{ name: 'Imported With Messages', value: 'imported_with_messages' },
					{ name: 'Importing', value: 'importing' },
					{ name: 'Initializing', value: 'initializing' },
					{ name: 'Partially Restored', value: 'partially_restored' },
					{ name: 'Restored', value: 'restored' },
					{ name: 'Restoring', value: 'restoring' },
				],
				default: [],
				description: 'Filter by import workflow state',
			},
		],
	},

	// ----------------------------------
	//         sisImport: restoreStates - options
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['sisImport'],
				operation: ['restoreStates'],
			},
		},
		options: [
			{
				displayName: 'Batch Mode',
				name: 'batch_mode',
				type: 'boolean',
				default: false,
				description: 'Whether to restore only batch-deleted items',
			},
			{
				displayName: 'Unconclude Only',
				name: 'unconclude_only',
				type: 'boolean',
				default: false,
				description: 'Whether to restore only concluded enrollments',
			},
			{
				displayName: 'Undelete Only',
				name: 'undelete_only',
				type: 'boolean',
				default: false,
				description: 'Whether to restore only deleted items',
			},
		],
	},
];
