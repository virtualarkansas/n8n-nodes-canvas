import type * as StateModule from '../../lib/state';

/**
 * In-memory additions to the test state (extra Canvas tokens and n8n credentials
 * created by a test file for its own users), layered over the state file so the
 * harness (`runNode({ persona })`) and `new CanvasClient(persona)` can use them
 * without anything being written to the shared state file.
 *
 * A test file opts in with:
 *
 *   vi.mock('../lib/state', async (original) =>
 *     (await import('./support/state-overlay')).overlayState(await original()));
 */
const extraTokens: Record<string, string> = {};
const extraCredentials: Record<string, { id: string; name: string; type: string }> = {};

export function addOverlay(
	persona: string,
	token: string | undefined,
	credential: { id: string; name: string; type: string },
): void {
	if (token !== undefined) extraTokens[persona] = token;
	extraCredentials[persona] = credential;
}

export function removeOverlay(persona: string): { id: string; name: string; type: string } | undefined {
	const credential = extraCredentials[persona];
	delete extraTokens[persona];
	delete extraCredentials[persona];
	return credential;
}

export function overlayState(actual: typeof StateModule): typeof StateModule {
	return {
		...actual,
		loadState: () => {
			const state = actual.loadState();
			return {
				...state,
				n8n: { ...state.n8n, credentials: { ...state.n8n.credentials, ...extraCredentials } },
				canvas: { ...state.canvas, tokens: { ...state.canvas.tokens, ...extraTokens } },
			};
		},
	};
}
