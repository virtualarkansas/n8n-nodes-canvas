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
npm test                  # Unit tests (no Canvas or n8n needed), incl. route audit
npm run test:integration  # Battery against local Canvas + n8n (see test/README.md)
npx tsx test/tools/describe.ts <resource> [operation]   # What an operation offers and sends
npx tsx test/tools/coverage.ts                          # Regenerate test/COVERAGE.md
npx tsx test/tools/export-workflows.ts                  # Regenerate test/workflows/
```

### Project Commands
```bash
/project:release [version]   # Create and push a release
```

### Releasing
Releases are automated via GitHub Actions: update the version in `package.json`, commit, tag `vX.Y.Z`, push the tag. The release workflow builds, publishes to npm and creates a GitHub release. `ci.yml` runs lint, build and unit tests on pushes to `main` and on pull requests.

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
- `thenGet` - after a write, output the result of this GET instead (writes whose own response is empty or stale)

`getParam` returns strings (numbers and arrays are coerced, IDs trimmed); `getParamObject` returns a copy of a collection. Throw a plain error from a handler for unusable input; it reaches the user as `INVALID_PARAMETERS`.

### Requests
- The node serializes query strings itself (`buildCanvasQueryString`): arrays as `key[]=v`, nested objects as `key[sub]=v`. Keys may be written with or without `[]`. Debug mode shows exactly the URL a real run sends.
- Bodies are JSON.
- Link/Location URLs returned by Canvas are re-anchored on the configured Canvas URL, so the token never goes to another host.

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
- Modes: stop, continueWithError, ignoreAndContinue, retryThenError (retries only throttling, 5xx and network errors). n8n's own "Continue On Fail" routes to the Error output.
- Error output: `errorCode` (number, 0 without an HTTP response), `errorType`, `errorMessage` (Canvas' own message), `canvasErrors`, `originalItem`, `resource`, `operation`, `endpoint`.

### Batch Processing
- Default: batches of 10 items in parallel with a delay between batches. Option: individual (sequential).

### Trigger
- Canvas cannot be told to call a URL through the API; an admin adds the node's URL in Admin → Data Services (HTTPS, Canvas format).
- Event name is `metadata.event_name`; IDs in events are global IDs (`shard * 10^13 + local`) and are matched against local IDs.
- Events that are filtered out are answered 200 (Canvas retries non-2xx).
- Optional authentication: `?token=` secret, and signed payloads (RS256 JWT verified against Instructure's JWKS).

## Canvas API Notes

- Authentication: API token (Account → Settings → New Access Token) or OAuth2 (Developer Key). A token an admin creates for another user through the API is `pending` until that user activates it.
- IDs can be SIS IDs: `sis_course_id:...`, `sis_user_id:...`.
- Rate limits are quota based (`X-Request-Cost`, `X-Rate-Limit-Remaining`); parallel requests are charged up front.
- Some list endpoints use page numbers, some bookmarks; some "summaries" repeat an entry on every page; some writes answer 204 or with stale data. When Canvas refuses something unexpectedly, read its own log before changing the node.
- New Quizzes (`/api/quiz/v1`), the Analytics plugin and LTI Advantage services are not part of open-source Canvas; they are verified against Instructure's docs (see `test/fixtures/extra-routes.json`).

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
