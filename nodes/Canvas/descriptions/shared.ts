import type { INodeProperties } from 'n8n-workflow';

/**
 * The two fields of a "Wait for Completion" operation: how often to look and
 * when to give up. The handler turns them into a `poll` hint (`pollUntil`).
 */
export function waitFields(resource: string, operation = 'waitForCompletion'): INodeProperties[] {
	const displayOptions = { show: { resource: [resource], operation: [operation] } };
	return [
		{
			displayName: 'Check Every (Seconds)',
			name: 'pollInterval',
			type: 'number',
			typeOptions: { minValue: 1 },
			default: 5,
			displayOptions,
			description: 'How long to wait between two looks at the job',
		},
		{
			displayName: 'Timeout (Seconds)',
			name: 'timeout',
			type: 'number',
			typeOptions: { minValue: 0 },
			default: 600,
			displayOptions,
			description:
				'How long to wait at most. When the job is not finished by then the item fails with the error type TIMEOUT; the job itself keeps running in Canvas.',
		},
	];
}

/**
 * "Download File" and the binary field to put it in, for operations whose record points
 * to a file. The handler turns them into a `download` hint (`downloadIfAsked`).
 */
export function downloadFields(resource: string, operations: string[], what: string): INodeProperties[] {
	return [
		{
			displayName: 'Download File',
			name: 'downloadFile',
			type: 'boolean',
			default: false,
			displayOptions: { show: { resource: [resource], operation: operations } },
			description: `Whether to download ${what} and attach it to the output item as binary data, ready for the next node (Extract From File, Write Files, an upload ...)`,
		},
		{
			displayName: 'Put Output File in Field',
			name: 'binaryPropertyName',
			type: 'string',
			default: 'data',
			required: true,
			displayOptions: { show: { resource: [resource], operation: operations, downloadFile: [true] } },
			hint: 'The name of the output binary field to put the file in',
		},
	];
}
