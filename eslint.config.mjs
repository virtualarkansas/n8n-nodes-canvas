import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';

export default [
	...configWithoutCloudSupport,
	{
		// Test tooling runs from a terminal: console output is the point.
		files: ['test/**/*.ts'],
		rules: { 'no-console': 'off' },
	},
];
