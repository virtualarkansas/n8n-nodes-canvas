# Canvas LMS n8n Community Nodes

## Project Overview

n8n community nodes for the Canvas LMS REST API: one "mega-node" with a resource/operation dropdown, and a webhook trigger for Canvas Live Events.

**Repo:** https://github.com/virtualarkansas/n8n-nodes-canvas
**Package:** `@kyancey-va/n8n-nodes-canvas`
**Target n8n:** tested against n8n 2.4.6

The list of resources and operations is not maintained by hand anywhere: `npx tsx test/tools/describe.ts --list` prints it from the node itself, and `test/COVERAGE.md` shows how each operation was tested.

## Quick Reference

### Key Files
- `credentials/CanvasApi.credentials.ts` - API token auth
- `credentials/CanvasOAuth2Api.credentials.ts` - OAuth2 auth (scopes are computed from the visible "Scopes" field; n8n ignores a user-entered `scope`)
- `credentials/CanvasLtiAdvantageApi.credentials.ts` - LTI 1.3 tool auth for `/api/lti` services (client-credentials grant; n8n renews the token on 401)
- `nodes/Canvas/Canvas.node.ts` - Main node: options, execute loop, item/pagination/error plumbing
- `nodes/Canvas/resources.ts` - Registry of every resource (label, value, operations, fields)
- `nodes/Canvas/GenericFunctions.ts` - Requests, rate limiting, pagination, errors, query serialization, uploads
- `nodes/Canvas/descriptions/` - One file per resource: UI definition (`<name>Operations`, `<name>Fields`)
- `nodes/Canvas/handlers/` - One file per resource group: turns parameters into a request (`IRequestConfig`)
- `nodes/Canvas/CanvasTrigger.node.ts`, `CanvasTriggerEvents.ts` - Live Events trigger
- `test/` - Unit tests, integration battery, local Canvas + n8n environment (see `test/README.md`)

### Commands
```bash
npm run dev               # Launch n8n with hot-reload
npm run build             # Compile TypeScript
npm run lint              # Check code style (n8n community node rules)
npm run lint:fix          # Auto-fix style issues
npm run typecheck         # Type-check node, credentials and tests
npm test                  # Unit tests (no Canvas or n8n needed), incl. route audit
npm run test:integration  # Battery against local Canvas + n8n (see test/README.md)
npx tsx test/tools/describe.ts <resource> [operation]   # What an operation offers and sends
npx tsx test/tools/coverage.ts                          # Regenerate test/COVERAGE.md
npx tsx test/tools/export-workflows.ts                  # Regenerate test/workflows/
npx tsx test/tools/route-gaps.ts                        # Regenerate test/ROUTE_GAPS.md
npx tsx test/tools/description-diff.ts [version]        # What changed for saved workflows since a release
```

### Project Commands
```bash
/project:release [version]   # Create and push a release
```

### Releasing
Releases are automated via GitHub Actions: update the version in `package.json` and the heading of its section in `CHANGELOG.md`, commit, tag `vX.Y.Z`, push the tag. The release workflow checks that the tag matches the version, runs the same checks as CI, publishes to npm and creates a GitHub release with that changelog section as notes. `ci.yml` runs lint, build, type check and unit tests on pushes to `main` and on pull requests.

## Architecture

### Adding or changing a resource
1. `descriptions/<Resource>Description.ts` exports `<resource>Operations` and `<resource>Fields`; export them from `descriptions/index.ts`.
2. A handler function `(operation, getParam, getParamObject) => IRequestConfig` in `handlers/<group>.handler.ts`; register it in `handlers/index.ts`.
3. One line in `resources.ts` (alphabetical by label).
4. `test/integration/<resource>.test.ts` (see `test/README.md` for what every operation must be tested for).

Handlers are pure: they only build `{ method, endpoint, qs, body }` plus optional hints:
- `dataKey` - the response wraps its records (`{ "quiz_submissions": [...] }`); unwrap into items (applies to reads and writes)
- `fetchAllPages` + `transform` - always read every page and reshape the full list (summaries Canvas splits across pages)
- `mergePagedArray` - a single record with a paginated embedded array (e.g. date details with overrides)
- `singlePage` - the endpoint answers with its complete list while still announcing pages
- `itemKey` - every entry of a list is wrapped (`[{ "course": {...} }]`)
- `upload` - the request is step 1 of Canvas' three-step file upload (binary property or URL); the node runs the rest
- `download` - after the GET, fetch the file the record points to and attach it as binary data
- `poll` - repeat the GET until the record reports the end of a background job ("Wait for Completion"; `pollUntil` in `handlers/shared.ts`, fields from `waitFields` in `descriptions/shared.ts`)
- `binaryBody` - send a binary property of the input item as the request body (import files); a string or Buffer `body` with `contentType` is sent as it is
- `responseFile` - the answer is a file as text (CSV export): also attach it as binary data
- `checkResponse` - throw when a successful answer actually reports a failure (GraphQL errors, a 204 that means "feature off")
- `encodedParams` - parameters whose value the handler has percent-encoded in the path itself (multi-segment paths)
- `thenGet` - after a write, output the result of this GET instead (writes whose own response is empty or stale)

`getParam` returns strings (numbers coerced, IDs trimmed, plain lists as `a,b,c`, lists of records and lists for JSON fields as JSON text); `getParamObject` returns a copy of a collection. Throw a plain error from a handler for unusable input; it reaches the user as `INVALID_PARAMETERS`. Small helpers shared by handlers live in `handlers/shared.ts`, shared field sets (Wait for Completion, Download File) in `descriptions/shared.ts`.

The hints are documented where they are defined (`IRequestConfig` in `types/Canvas.types.ts`).

Helpers for reading parameters live once in `handlers/shared.ts` (contract pinned by `test/unit/handlerHelpers.test.ts`); import them instead of defining a copy in a handler file: `toList` (separated text or an array to a list), `isBlank` / `isBlankOrWhitespace`, `withoutBlanks`, `takeKeys`, `pickDefined` / `pickFilled`, `mapFields`, `collectionRows` (rows of a fixedCollection), `parseJson` (any JSON value) and `parseJsonObject` with its two message variants `parseJsonObjectOrEmpty` and `parseJsonObjectFor`. They carry the rules for odd input: a JSON field is empty when it is undefined, null, `''` or whitespace; a list entry or a collection row of the wrong kind is refused with a message that names the field, never passed on.

### Requests
- The node serializes query strings itself (`buildCanvasQueryString`): arrays as `key[]=v`, nested objects as `key[sub]=v`. Keys may be written with or without `[]`. Debug mode shows exactly the URL a real run sends.
- Bodies are JSON (or raw text / bytes for import files).
- The credential only ever goes to the configured Canvas host: Link/Location URLs returned by Canvas are re-anchored on it, redirects are never followed by n8n (it would put the Authorization header back on every hop), and the node follows the redirect of a read itself, without the credential once it leaves the Canvas host. Writes are never redirected. Every request gets a fresh options object, because n8n writes the credential into the one it is given.

- Request Options → Act as User ID adds `as_user_id` to every request made for an item (follow-up pages, the GET after a write, upload steps), never to the rate limit probe. It travels in the rate limit options (`asUserId`).

### Rate Limiting
- Canvas throttles with `403 Forbidden (Rate Limit Exceeded)` by default (429 only if the instance opts in); both are recognised.
- The remaining quota (`X-Rate-Limit-Remaining`) is read from every response. Canvas is probed (`GET /api/v1/users/self`) only when nothing is known yet or the last reading was below the threshold (default 300); then the node waits with backoff until it recovers.
- Throttled requests are retried with exponential backoff: 2s → 4s → 8s → 16s → 32s (max 60s), on first and later pages alike.

### Pagination
- Every GET goes through the paginating request and follows `rel="next"` from the Link header (never construct page URLs). A response that is not a list is returned as a single item.
- Defaults: 10 items/page, max 5 pages. `Return All` → pages of 100, no page limit. Operation-level `returnAll`/`limit` fields, where a resource has them, win over the node-level options.

### Output and errors
- Dual outputs (Success, Error) plus Debug in debug mode. Every item carries `pairedItem`.
- Empty response body → `{ success: true }` (never drop an item). Empty list → no items.
- Modes: stop, continueWithError, ignoreAndContinue, retryThenError (retries only throttling, 5xx and network errors; a write only when Canvas cannot have carried it out: throttled, never sent, or 503). n8n's own "Continue On Fail" routes to the Error output.
- Error output: `errorCode` (number, 0 without an HTTP response), `errorType`, `errorMessage` (Canvas' own message), `canvasErrors`, `responseBody` (when Canvas' answer holds more than an error list), `originalItem`, `resource`, `operation`, `endpoint`.

### Batch Processing
- Default: batches of 10 items in parallel with a delay between batches. Option: individual (sequential).

### Trigger
- Canvas cannot be told to call a URL through the API; an admin adds the node's URL in Admin → Data Services (HTTPS, Canvas format).
- Event name is `metadata.event_name`; IDs in events are global IDs (`shard * 10^13 + local`) and are matched against local IDs.
- Events that are filtered out are answered 200 (Canvas retries non-2xx).
- Optional authentication: `?token=` secret, and signed payloads (RS/ES JWT verified against Instructure's JWKS; the key type has to fit the algorithm; unknown key IDs refetch the keys at most once a minute).
- The body is read by the node itself (so signed payloads work whatever their content type), limited to 5 MB before and after decompression.

## Canvas API Notes

- Authentication: API token (Account → Settings → New Access Token) or OAuth2 (Developer Key). A token an admin creates for another user through the API is `pending` until that user activates it.
- IDs can be SIS IDs: `sis_course_id:...`, `sis_user_id:...`.
- Rate limits are quota based (`X-Request-Cost`, `X-Rate-Limit-Remaining`); parallel requests are charged up front.
- Some list endpoints use page numbers, some bookmarks; some "summaries" repeat an entry on every page; some writes answer 204 or with stale data. When Canvas refuses something unexpectedly, read its own log before changing the node.
- Canvas runs several server processes. A changed account setting or feature flag reaches each of them on its own (within about a minute), and writes sent at the same time to one record (the preferences of a user, a page) can overwrite each other: that is why Batch Processing has an Individual mode.
- Lists that page by number shift when records are added while they are read (activity streams, user lists, history: every API request is a page view). Tests compare such lists on records of their own.
- New Quizzes (`/api/quiz/v1`) and the Analytics plugin are not part of open-source Canvas; they are verified against Instructure's docs (see `test/fixtures/extra-routes.json`). LTI Advantage services (`/api/lti`) are tested locally with a tool the battery registers.

## Testing

- **Unit** (`npm test`): request layer, trigger parsing, UI definition integrity, and the route audit, which checks every operation for every context value against the route table dumped from a real Canvas (`test/fixtures/canvas-routes.json`).
- **Integration** (`npm run test:integration`): every operation run by a real n8n instance against a local Canvas seeded with a large, messy data set; writes are verified by reading back from Canvas directly. Environment scripts are in `test/env/`.
- Test against the local instance or a Canvas Free-for-Teacher sandbox, never a production instance.

## Coding Standards

### TypeScript
- Strict mode enabled
- Explicit types for all function parameters and returns
- Use interfaces for complex objects

### n8n Conventions
- Resource descriptions in separate files under `descriptions/`
- Use `INodeProperties` for all node parameters
- Follow n8n naming conventions (camelCase for internal, Title Case for display); `npm run lint` enforces them
- No runtime dependencies (required for community node verification)

### Error Messages
- Always include context: resource, operation, endpoint
- Surface Canvas' own message and error payload
- Make errors actionable

## Resources

- [Canvas Developer Docs](https://developerdocs.instructure.com/services/canvas)
- [Canvas API Resources](https://developerdocs.instructure.com/services/canvas/resources)
- [n8n Node Building](https://docs.n8n.io/integrations/community-nodes/build-community-nodes/)
- [n8n Starter Template](https://github.com/n8n-io/n8n-nodes-starter)
