# n8n-nodes-canvas

Custom n8n community nodes for **Canvas LMS** by Instructure. Provides comprehensive coverage of the Canvas REST API with 92 resources and 466+ actions.

## Features

- **Comprehensive API Coverage**: Access 92 Canvas API resources with 466+ actions
- **Dual Authentication**: API Access Token and OAuth2 support
- **Smart Rate Limiting**: Automatic quota checking with configurable thresholds
- **Pagination Handling**: Automatic pagination with configurable limits
- **Error Handling**: Multiple error modes with dedicated error output branch
- **Batch Processing**: Process multiple items efficiently
- **Webhook Trigger**: Listen for 22 Canvas Live Events

## Installation

Choose the installation method that matches your n8n setup:

### Option 1: n8n Community Nodes (Recommended)

1. Open your n8n instance
2. Go to **Settings → Community Nodes**
3. Click **Install**
4. Enter `@kyancey-va/n8n-nodes-canvas`
5. Click **Install**

> ⚠️ **Package name:** this project is published as `@kyancey-va/n8n-nodes-canvas`.
> There is an unrelated package named `n8n-nodes-canvas` on npm — installing that name gives you
> a different, smaller node without the Conversations API.

### Option 2: npm Install

For self-hosted n8n installed via npm:

```bash
# In your n8n installation directory
npm install @kyancey-va/n8n-nodes-canvas
```

Then restart n8n.

### Option 3: Docker with Volume Mount

For Docker-based n8n installations where you want to install the package manually.

#### Step 1: Download and Extract

```bash
# On your server, create the custom nodes directory
mkdir -p /path/to/n8n/custom-nodes/n8n-nodes-canvas
cd /path/to/n8n/custom-nodes/n8n-nodes-canvas

# Option A: Clone from GitHub and build
git clone https://github.com/virtualarkansas/n8n-nodes-canvas.git .
npm install
npm run build

# Option B: Download a release (when available)
# wget https://github.com/virtualarkansas/n8n-nodes-canvas/releases/download/v0.1.0/n8n-nodes-canvas.tar.gz
# tar -xzvf n8n-nodes-canvas.tar.gz
```

#### Step 2: Update Docker Compose

Add the environment variable and volume mount to your `docker-compose.yml`:

```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    environment:
      - N8N_CUSTOM_EXTENSIONS=/custom-nodes
    volumes:
      - ./custom-nodes:/custom-nodes
      # ... your other volumes
```

If you're using n8n workers, add the same to your worker service:

```yaml
  n8n-worker:
    image: docker.n8n.io/n8nio/n8n
    command: worker
    environment:
      - N8N_CUSTOM_EXTENSIONS=/custom-nodes
    volumes:
      - ./custom-nodes:/custom-nodes
      # ... your other volumes
```

#### Step 3: Restart

```bash
docker compose down && docker compose up -d
```

### Option 4: Docker with npm Install

For Docker setups, you can also install via npm inside the container:

```bash
# Enable community packages in your docker-compose.yml
environment:
  - N8N_COMMUNITY_PACKAGES_ENABLED=true

# Then restart and install via n8n UI, or:
docker exec -it <n8n-container> npm install @kyancey-va/n8n-nodes-canvas
docker compose restart
```

### Option 5: Building from Source

For development or customization:

```bash
git clone https://github.com/virtualarkansas/n8n-nodes-canvas.git
cd n8n-nodes-canvas
npm install
npm run build

# For development with hot-reload
npm run dev

# To create a distributable package
npm pack
```

### Option 6: Git Clone (Updatable)

For Docker setups where you want easy updates via `git pull`:

#### Step 1: Clone and Build

```bash
# On your server
cd /path/to/n8n
git clone https://github.com/virtualarkansas/n8n-nodes-canvas.git custom-nodes/n8n-nodes-canvas
cd custom-nodes/n8n-nodes-canvas
npm install
npm run build
```

#### Step 2: Volume Mount

Add to your `docker-compose.yml`:

```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    environment:
      - N8N_CUSTOM_EXTENSIONS=/custom-nodes
    volumes:
      - ./custom-nodes:/custom-nodes
```

#### Step 3: Restart

```bash
docker compose down && docker compose up -d
```

#### Updating

```bash
cd /path/to/n8n/custom-nodes/n8n-nodes-canvas
git pull
npm install
npm run build
docker compose down && docker compose up -d
```

### Verifying Installation

After installation, verify the nodes are loaded:

1. Open n8n
2. Create a new workflow
3. Click **+** to add a node
4. Search for "**Canvas**"

You should see:
- **Canvas LMS** - Main node with 92 resources
- **Canvas Trigger** - Webhook trigger for live events

## Nodes

### Canvas LMS

The main node for the Canvas REST API: pick a **Resource** and an **Operation**. The full list of
resources and operations, and how each one was tested, is in [`test/COVERAGE.md`](test/COVERAGE.md).

**Teaching and learning:** courses, sections, enrollments, users, assignments and assignment groups,
submissions and comments, modules, pages, files and folders, classic quizzes (questions, groups,
submissions, reports, extensions, overrides), discussions, announcements, rubrics, outcomes,
grading periods and standards, late policies, gradebook history, learning object dates.

**Communication and planning:** conversations, calendar events, appointment groups, groups and
group categories, planner, polls, notification preferences.

**Administration:** accounts, account reports and notifications, roles, admins, terms, SIS imports,
authentication providers, developer keys, access tokens, external tools and LTI registrations,
content migrations and exports, blueprint courses, feature flags, CSP settings, audit logs
(grade change log, course audit log).

**Anything else.** Two generic resources cover what has no operation of its own, including
endpoints Instructure does not document and data only the Canvas web interface shows:

- **Custom API Request** sends any method and path to your Canvas instance with the node's rate
  limiting, pagination and error handling. Undocumented endpoints can change without notice.
- **GraphQL** runs a query or mutation against Canvas' GraphQL API (explore the schema at
  `/graphiql` on your instance). Canvas runs one operation per request and reports errors in a
  successful response; the node turns those into failed items unless you ask for partial data.

Some resources call services that only exist on hosted Canvas (New Quizzes, the Analytics plugin).
They are checked against Instructure's documentation rather than against a running instance;
`test/COVERAGE.md` marks them.

**Outputs.** The node has a **Success** and an **Error** output (plus **Debug** when Debug Mode is on):

- A list operation returns one item per record. An operation that returns nothing (for example a
  delete that answers "204 No Content") returns `{ "success": true }`, so no input item is lost.
- Every output item is linked to the input item it came from.
- Lists that Canvas wraps in an object (`{ "quiz_submissions": [...] }`, `{ "events": [...] }`)
  are unwrapped into items.

**IDs.** Wherever an ID is asked for, Canvas also accepts SIS IDs in the form `sis_course_id:ABC123`,
`sis_user_id:...`, `sis_section_id:...` and so on.

### Canvas Trigger

Starts a workflow when Canvas sends a [Live Event](https://developerdocs.instructure.com/services/canvas/data-services/live-events/overview/file.data_service_introduction).
Canvas does not let the node register itself, so a Canvas admin adds the subscription:

1. Activate the workflow and copy the trigger's **Production URL**.
2. In Canvas, open **Admin → Data Services → Add**.
3. Choose **HTTPS** delivery, the **Canvas** message format, paste the URL and select the events.

In the node, select the events that should start the workflow (or **All Events**). Events that are
not selected are acknowledged and ignored, because Canvas retries anything that is not answered
with a 2xx. **Filter by Course ID** and **Filter by Account ID** accept the IDs you see in Canvas
URLs; the global IDs that Canvas puts in events are matched automatically.

The Production URL is public, so restrict who can use it (under **Options**):

| Option | What it does |
|---|---|
| **Secret Token** | Requests must carry `?token=<value>`. Add it to the URL you enter in Data Services. |
| **Require Signed Payload** | Only accepts events delivered with Data Services' **Sign Payload** option. |
| **Verify Signed Payloads** (on by default) | Checks the signature of signed events against the keys Instructure publishes. |
| **JWKS URL** | Where the signing keys are fetched from; the default is Instructure's key set. |

Each event becomes one item: the event's `body` fields, plus `eventType`, `timestamp` and (unless
switched off) `metadata` with who, where and when.

## Configuration

### API Access Token

1. In Canvas, go to **Account → Settings**
2. Scroll to **Approved Integrations**
3. Click **+ New Access Token**
4. Enter a purpose and expiration (optional)
5. Copy the generated token immediately (it won't be shown again)

The node can do whatever the token's user can do in Canvas; for account-wide automation use a
token of an account admin.

### OAuth2

1. In Canvas Admin, go to **Developer Keys**
2. Click **+ Developer Key → API Key**
3. Configure:
   - **Key Name**: Your app name
   - **Redirect URIs**: `https://your-n8n-instance.com/rest/oauth2-credential/callback`
   - **Enforce Scopes**: leave off for full access, or switch on and select the scopes you need
4. Save, switch the key **On**, and copy the **Client ID** (shown as ID number)
5. Click **Show Key** to get the **Client Secret**
6. In n8n credentials, enter:
   - **Canvas URL**: Your Canvas instance URL
   - **Client ID**: The ID number from Developer Keys
   - **Client Secret**: The key you revealed
   - **Scopes**: only if the key enforces scopes — the scopes you need, exactly as Canvas lists
     them on the key (`url:GET|/api/v1/courses`), separated by spaces or new lines

Canvas access tokens obtained this way expire after an hour; n8n refreshes them automatically.

### LTI Advantage

Canvas opens its LTI Advantage services (`/api/lti/...`: line items, scores, results, names and
roles) only to an LTI 1.3 tool, never to a user's token. To use the **Line Item** resource,
**Progress → Get LTI**, or `/api/lti` paths in **Custom API Request**:

1. In Canvas, create an LTI developer key (Admin → Developer Keys → + LTI Key) with a public JWK of
   a key pair you generate, enable the scopes you need, switch the key on and install the tool in the
   course or account (by client ID).
2. In n8n, create a **Canvas LTI Advantage API** credential with the Canvas URL, the key's client ID,
   the private key (PEM or JWK) and the scopes.
3. In the node, set **Authentication** to **LTI Advantage**.

The node obtains the access token itself (it is valid for one hour) and fetches a new one when
Canvas no longer accepts it.

## Options

### Rate Limiting

Canvas gives every token a quota that drains with the cost of each request and refills over time
(`X-Rate-Limit-Remaining`). When it is used up, Canvas answers `403 Forbidden (Rate Limit Exceeded)`.

- The node reads the remaining quota from every response. When it falls below the **Threshold**
  (default 300) it waits, checking with a lightweight request, until the quota has recovered.
- A throttled request is retried with exponential backoff (2 s, 4 s, 8 s, ... up to 60 s),
  **Max Retries** times (default 5).
- **Enable Rate Limit Check** (default on) switches the waiting on or off; throttled requests are
  retried either way.

### Pagination

Applies to every operation that returns a list.

- **Items Per Page**: 1-100 (default 10)
- **Max Pages**: default 5, so by default a list returns at most 50 items; 0 means no limit
- **Return All**: fetch everything (uses pages of 100 unless Items Per Page is set)

A few resources have their own **Return All** / **Limit** fields on the operation; those take
precedence.

### Error Handling

- **Stop Workflow** (default): the node fails with Canvas' message
- **Continue & Output Error**: failed items go to the Error output, the rest continue
- **Ignore & Continue**: failed items are dropped
- **Retry Then Error**: throttling, server errors (5xx) and network errors are retried with
  backoff, then the item goes to the Error output; other errors go there immediately

n8n's own node setting **On Error → Continue** also sends failures to the node's Error output.
Do not use **On Error → Continue (using error output)**: n8n then adds a third output of its own,
which stays empty because the failed items are already on the node's Error output.

An item on the Error output looks like this:

```json
{
  "error": true,
  "errorCode": 404,
  "errorType": "NOT_FOUND",
  "errorMessage": "The specified resource does not exist.",
  "canvasErrors": [{ "message": "The specified resource does not exist." }],
  "originalItem": { "courseId": 123 },
  "resource": "course",
  "operation": "get",
  "endpoint": "/api/v1/courses/123",
  "timestamp": "2026-01-15T12:00:00.000Z"
}
```

`errorType` is one of `VALIDATION_ERROR` (400, 422), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED`, `SERVER_ERROR` (5xx), `INVALID_PARAMETERS`
(the node rejected the input before sending anything; `errorCode` is 0), `NETWORK_ERROR` (no
response; `errorCode` is 0) or `UNKNOWN`.

### Batch Processing

- **Batch Mode** (default): items are sent in parallel groups of **Batch Size** (default 10) with
  **Batch Delay** (default 1000 ms) between groups
- **Individual Mode**: one item after the other

### Request Options

- **Act as User ID**: carry out the request as another user (Canvas calls this masquerading; the
  `as_user_id` parameter). Works with every resource and operation, accepts SIS IDs
  (`sis_user_id:jdoe`) and expressions, so each input item can act as a different user. The user of
  the credential needs the "Become other users" permission, and Canvas records both users in its logs.

### Debug Mode

With **Debug Mode** on, nothing is sent to Canvas. The request the node would send (method, URL,
body and an equivalent `curl` command, with a placeholder instead of the token) appears on the
**Debug** output.

## Troubleshooting

### Node not appearing after installation

1. Ensure you've restarted n8n after installation
2. For Docker, verify the volume mount path is correct
3. Check n8n logs for any loading errors:
   ```bash
   docker compose logs n8n | grep -i canvas
   ```

### Authentication errors

1. Check the Canvas URL: the address of your instance, e.g. `https://school.instructure.com`
2. Ensure your access token hasn't expired or been deleted
3. A 401 that mentions scopes means the developer key enforces scopes: list them in the
   credential's **Scopes** field
4. A 403 or 404 on a record you know exists usually means the token's user may not see it

### Rate limit errors

1. Reduce **Batch Size**: parallel requests are charged up front by Canvas
2. Increase **Batch Delay** between batches
3. Lower the **Threshold** if the node waits too eagerly, or raise it if you share the token with
   other integrations

### A list returns fewer items than expected

By default a list stops after 5 pages of 10 items. Switch on **Pagination → Return All**.

## Development and testing

```bash
npm run build      # compile
npm run lint       # n8n community node lint rules
npm test           # unit tests, including the audit of every operation against Canvas' route table
```

The integration battery runs every operation on a real n8n instance against a real Canvas loaded
with a large, deliberately messy data set. [`test/README.md`](test/README.md) explains how to start
that environment and how to add tests; `test/workflows/` holds importable example workflows
generated from what the battery executed.

## Resources

- [Canvas API Documentation](https://developerdocs.instructure.com/services/canvas)
- [Canvas API Resources Reference](https://developerdocs.instructure.com/services/canvas/resources)
- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests. A change to a
resource should come with a test in `test/integration/` (see `test/README.md`); `npm test` and
`npm run lint` run on every pull request.

## License

MIT
