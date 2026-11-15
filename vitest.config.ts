import { defineConfig } from 'vitest/config';

// Unit tests: no network, no n8n instance. Run with `npm test`.
export default defineConfig({
	// n8n-workflow ships source maps that point at files it does not publish.
	logLevel: 'error',
	test: {
		include: ['test/unit/**/*.test.ts'],
		environment: 'node',
	},
});
