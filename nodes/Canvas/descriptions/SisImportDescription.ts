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
				description: 'Abort every SIS import of the account that has not started yet',
				action: 'Abort all pending SIS imports',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Import SIS data from CSV text or a zip file',
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
				description: 'Get the SIS imports that are being processed right now',
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
				description:
					'Undo the state changes of a SIS import (for example deletions). Returns a progress object.',
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
		description: 'The ID of the root account. SIS imports only exist on root accounts.',
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
		displayName: 'File Content',
		name: 'fileContent',
		type: 'string',
		typeOptions: {
			rows: 6,
		},
		required: true,
		default: '',
		placeholder: 'user_id,login_id,first_name,last_name,email,status',
		displayOptions: {
			show: {
				resource: ['sisImport'],
				operation: ['create'],
			},
		},
		description:
			'The import file: the text of one SIS CSV file including its header row (Canvas recognises the kind of file by its columns), or the Base64 content of a zip file with several CSV files',
	},
	{
		displayName: 'File Content Encoding',
		name: 'fileEncoding',
		type: 'options',
		options: [
			{
				name: 'Base64',
				value: 'base64',
				description: 'File Content is a Base64 string, e.g. a zip file converted with the Extract From File node',
			},
			{
				name: 'Text',
				value: 'text',
				description: 'File Content is the CSV (or XML) text itself',
			},
		],
		default: 'text',
		displayOptions: {
			show: {
				resource: ['sisImport'],
				operation: ['create'],
			},
		},
		description: 'How File Content is encoded',
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
				description:
					'Whether the imported values count as changed by hand, so later imports leave them alone (requires Override SIS Stickiness)',
			},
			{
				displayName: 'Batch Mode',
				name: 'batch_mode',
				type: 'boolean',
				default: false,
				description:
					'Whether to enable batch mode, which DELETES everything in the batch mode term that was created by SIS and is not in this import. Requires Batch Mode Term ID.',
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
				description:
					'A percentage (1-100). In batch mode nothing is deleted when more than this share of the records would be removed; with diffing no diff is made when the file changed by more than this share. 0 means no threshold.',
			},
			{
				displayName: 'Clear SIS Stickiness',
				name: 'clear_sis_stickiness',
				type: 'boolean',
				default: false,
				description:
					'Whether to make the imported fields ordinary again, so later imports may change them (requires Override SIS Stickiness)',
			},
			{
				displayName: 'Diff Row Count Threshold',
				name: 'diff_row_count_threshold',
				type: 'number',
				default: 0,
				description:
					'With diffing: do not apply the diff when it would have more rows than this (the import is then flagged as "diffing threshold exceeded"). 0 means no threshold.',
			},
			{
				displayName: 'Diffing Data Set Identifier',
				name: 'diffing_data_set_identifier',
				type: 'string',
				default: '',
				description:
					'A name for a series of imports. Canvas compares this import with the previous one of the same series and only applies the difference; records missing from the new file are removed. Cannot be combined with batch mode.',
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
				description:
					'Whether to apply this import in full and make it the new baseline of its series instead of diffing it',
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
				description:
					'The kind of file in File Content. Defaults to CSV for text and ZIP for Base64 content.',
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
				description:
					'Whether to run batch mode for every term in the terms file of the import: everything in those terms that is not in the import is DELETED. Requires Batch Mode and Change Threshold.',
			},
			{
				displayName: 'Override SIS Stickiness',
				name: 'override_sis_stickiness',
				type: 'boolean',
				default: false,
				description:
					'Whether the import may overwrite values that were changed by hand in Canvas ("sticky" fields), which it otherwise leaves alone',
			},
			{
				displayName: 'Skip Deletes',
				name: 'skip_deletes',
				type: 'boolean',
				default: false,
				description:
					'Whether to ignore rows that would delete something (status "deleted", and the removals of batch mode and diffing)',
			},
			{
				displayName: 'Update SIS ID If Login Claimed',
				name: 'update_sis_id_if_login_claimed',
				type: 'boolean',
				default: false,
				description:
					'Whether a user whose login already exists under another (or no) SIS ID gets the SIS ID of the file, instead of the row being refused',
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
				description: 'Whether to restore only the items that the batch mode of the import deleted',
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
