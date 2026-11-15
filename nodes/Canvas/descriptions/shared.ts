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
