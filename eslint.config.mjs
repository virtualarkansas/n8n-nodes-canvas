import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';

export default [
	// Git worktrees used for parallel work live here; each is linted from its own root.
	{ ignores: ['.claude/**'] },
	...configWithoutCloudSupport,
	{
		// Test tooling runs from a terminal: console output is the point.
		files: ['test/**/*.ts'],
		rules: { 'no-console': 'off' },
	},
];
