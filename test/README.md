# Test battery

Two layers:

| Layer | Command | Needs | What it proves |
|---|---|---|---|
| Unit | `npm test` | nothing | Request layer behaviour (errors, rate limiting, pagination, query strings, uploads), trigger parsing, and the **route audit**: every operation in the UI, for every context value, builds a request for a route that exists in Canvas. |
| Integration | `npm run test:integration` | local Canvas + n8n | Every operation executed by a real n8n instance against a real Canvas, with writes verified by reading the record back from Canvas directly. |

## Environment

See `test/env/`:

- `canvas/up.sh build|start|token|stop` — Canvas LMS (`prod` branch) in Docker with Postgres and Redis.
- `canvas/seed/run.sh` — loads a large, deliberately messy data set and writes persona tokens and fixture IDs to `test/.state.json` (git-ignored).
- `n8n/start.sh`, `n8n/reload.sh`, `n8n/bootstrap.ts` — n8n (the battery targets 2.4.6) with this package installed the way the README tells users to install it; `reload.sh` rebuilds, reinstalls and restarts (never while a test run is in progress); `bootstrap.ts` creates the credentials.
- `dev-worktree.sh up|reload|sync|down` — a private n8n instance for a git worktree, so several people can rebuild independently against the shared Canvas.

Running it:

- `npm run test:integration` runs every file; pass file names to run some. Files run in parallel (`BATTERY_WORKERS`, default 4), the tests inside a file in order.
- Canvas throttles per access token. `bootstrap.ts` therefore gives every parallel worker its own token and n8n credential for each seeded persona (`BATTERY_POOL` sets, default 6), and `runNode` repeats a run the node abandoned on the rate limit quota before it sent anything. On a Canvas shared with other people, `BATTERY_RATE_LIMIT_THRESHOLD=<n>` lowers the node's pre-flight threshold for runs that do not set their own.
- Every request a test makes itself asks Canvas for English (`test/lib/setup-fetch.ts`); Node's default `Accept-Language: *` would make Canvas store an Arabic browser locale for the calling user.

## Writing integration tests

One file per resource in `test/integration/<resource>.test.ts`; `course.test.ts` is the reference. Building blocks:

```ts
import { canvas, CanvasClient, fx, hasFixture, unique } from '../lib/canvas';
import { runNode, runOk, skipOp } from '../lib/harness';

// Run one node operation on n8n and get the Success items (throws with context on failure):
const [created] = await runOk({ resource: 'course', operation: 'create', params: { accountId: fx('accountId'), name: unique('Course') } });

// Full result (success / error / debug outputs, pairedItem, failure) when testing error paths, several items, personas:
const result = await runNode({ resource: 'course', operation: 'get', persona: 'student', items: [{ id: 1 }, { id: 2 }],
  params: { courseId: '={{ $json.id }}', errorHandling: { onError: 'continueWithError' } } });

// Items that carry a file in a binary property (uploads, imports):
await runNode({ resource: 'file', operation: 'upload', params: { contextType: 'course', courseId },
  binary: [{ fileName: 'notes.txt', mimeType: 'text/plain', b64: Buffer.from('hello').toString('base64') }] });

// A user of your own with a token and an n8n credential (never change the seeded personas):
const user = await createUserWithToken('Scratch user');                 // from '../lib/canvas'
const credential = await createCredential(user.token);                    // from '../lib/harness'
await runOk({ resource: 'user', operation: 'getSelf', credential });

// Independent check against Canvas (never through the node):
const actual = await canvas().get(`/api/v1/courses/${created.id}`);
const everything = await canvas().getAll('/api/v1/courses/1/users');      // follows pagination
const asTeacher = new CanvasClient('teacher');
```

`npx tsx test/tools/describe.ts <resource> [operation]` prints every field of an operation, the request the handler builds and whether Canvas has that route. `npx tsx test/tools/describe.ts --list` lists all resources and operations.

### What every operation needs

1. **Happy path with every optional field.** Set every option the UI offers (in as few runs as is practical) and assert, by reading back from Canvas, that each one took effect. A field Canvas silently ignores is a bug in the description or handler (wrong name, wrong nesting, wrong type), not a test to delete.
2. **List operations on big data.** Compare IDs with `canvas().getAll(...)`: default paging (10 x 5), `pagination: { returnAll: true }`, a small `perPage` with `maxPages`, no duplicates, and filters actually filtering. Use the large seeded collections.
3. **Edge cases real data has.** Unicode/emoji/RTL/very long text, HTML bodies, values with quotes and ampersands, SIS IDs (`sis_course_id:...`), numeric IDs arriving as numbers from expressions, records in unusual states (deleted, concluded, unpublished, locked), empty lists, several input items with a mix of success and failure.
4. **Error path.** At least one realistic failure per resource (not found, forbidden for a lesser persona, validation) asserted on the Error output: `errorCode`, `errorType`, Canvas' message.
5. **Every context.** If an operation offers a context dropdown (course/account/user/group), run each value.

Operations that cannot run on a local Canvas (hosted Instructure services such as New Quizzes, plugins that are not open source) are declared with `skipOp(resource, operation, reason)` in the resource's test file; they are still covered by the route audit and are exercised in debug mode against Instructure's documentation.

Node-level behaviour (item processing, error modes, pagination options, rate limiting against Canvas' real throttle, debug mode, odd inputs, personas) is tested once, in `crosscutting.test.ts`; masquerading in `masquerade.test.ts`; the trigger in `trigger.test.ts`; OAuth2 in `oauth2.test.ts`; the LTI Advantage credential in `lineItem.test.ts`.

### Rules

- Never modify or delete seeded fixtures (`fx(...)`). Create your own records for anything destructive and use `unique()` for names so reruns do not collide.
- Do not change instance-wide state without restoring it (root account settings, authentication providers, feature flags on the root account, roles other tests rely on).
- Tests in a file run in order and may depend on each other (create → update → delete).
- Other files change the shared Canvas while yours runs: compare lists by the records you own, or with data read immediately before and after the node ran.
- An unexpected Canvas refusal is information: read Canvas' own error (`docker logs canvas-web`), find out whether the node sent the wrong thing or Canvas legitimately refused, and test the real behaviour.

## Coverage report

Every node execution is appended to `test/.results/ops.jsonl`; `npx tsx test/tools/coverage.ts` turns that into `test/COVERAGE.md`: per operation, whether it was executed successfully, only produced errors, was skipped (with the reason) or was never run.

Other generated reports:

- `npx tsx test/tools/route-gaps.ts` → `test/ROUTE_GAPS.md`: the Canvas API endpoints (documented and undocumented) no operation reaches, from the route table of a real Canvas.
- `npx tsx test/tools/export-workflows.ts` → `test/workflows/`: one importable example workflow per resource, built from the runs the battery executed successfully; `npx tsx test/tools/verify-workflows.ts` imports and runs them.
