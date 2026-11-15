import { defineConfig } from 'vitest/config';

// Integration battery: needs the local Canvas + n8n environment (see test/env/README.md).
export default defineConfig({
	logLevel: 'error',
	test: {
		include: ['test/integration/**/*.test.ts'],
		environment: 'node',
		globalSetup: ['test/lib/global-setup.ts'],
		testTimeout: 180_000,
		hookTimeout: 180_000,
		// Scenarios inside one file share Canvas records and run in order; files run in parallel.
		sequence: { concurrent: false },
		maxWorkers: Number(process.env.BATTERY_WORKERS ?? 4),
		minWorkers: 1,
		reporters: ['default', ['json', { outputFile: 'test/.results/integration.json' }]],
	},
});
