/**
 * Node's fetch sends "Accept-Language: *" unless told otherwise. Canvas reads that as
 * "any locale", picks the first one alphabetically (Arabic) and stores it as the user's
 * browser locale, after which that user's error messages arrive in Arabic. Every request
 * a test makes itself therefore asks for English unless it sets the header on purpose.
 */
const originalFetch = globalThis.fetch;

globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
	const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
	if (!headers.has('accept-language')) {
		headers.set('accept-language', 'en');
	}
	return originalFetch(input, { ...init, headers });
}) as typeof fetch;
