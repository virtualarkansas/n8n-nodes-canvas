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

*Available once published to npm.*

1. Open your n8n instance
2. Go to **Settings → Community Nodes**
3. Click **Install**
4. Enter `n8n-nodes-canvas`
5. Click **Install**

### Option 2: npm Install

For self-hosted n8n installed via npm:

```bash
# In your n8n installation directory
npm install n8n-nodes-canvas
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
docker exec -it <n8n-container> npm install n8n-nodes-canvas
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

The main node for interacting with the Canvas API. Supports operations across 92 resources including:

**Core Resources:**
- Courses, Sections, Enrollments, Users
- Assignments, Submissions, Grades
- Modules, Pages, Files, Folders
- Quizzes (Classic and New Quizzes)
- Discussions, Announcements, Conversations

**Administrative Resources:**
- Accounts, Roles, Admins
- SIS Imports, Authentication Providers
- Developer Keys, Access Tokens

**And many more...**

### Canvas Trigger

Webhook trigger for Canvas Live Events. Configure the webhook URL in Canvas Admin → Data Services.

**Supported events:**
- Course: created, updated, concluded
- Enrollment: created, updated, concluded
- Assignment: created, updated
- Submission: created, updated, graded
- Discussion: topic created, entry created
- User: created, updated, login
- Quiz: submitted
- Module: created, updated
- Wiki Page: created, updated
- Attachment: created

## Configuration

### API Access Token

1. In Canvas, go to **Account → Settings**
2. Scroll to **Approved Integrations**
3. Click **+ New Access Token**
4. Enter a purpose and expiration (optional)
5. Copy the generated token immediately (it won't be shown again)

### OAuth2

1. In Canvas Admin, go to **Developer Keys**
2. Click **+ Developer Key → API Key**
3. Configure:
   - **Key Name**: Your app name
   - **Redirect URIs**: `https://your-n8n-instance.com/rest/oauth2-credential/callback`
   - **Scopes**: Select required scopes or leave blank for full access
4. Save and copy the **Client ID** (shown as ID number)
5. Click **Show Key** to get the **Client Secret**
6. In n8n credentials, enter:
   - **Canvas URL**: Your Canvas instance URL
   - **Client ID**: The ID number from Developer Keys
   - **Client Secret**: The key you revealed

## Options

### Rate Limiting

Canvas uses a quota-based rate limiting system. The node automatically checks remaining quota before each request.

- **Enable Rate Limit Check**: Pre-flight check before requests (default: enabled)
- **Threshold**: Minimum remaining quota before proceeding (default: 300)
- **Max Retries**: Retry attempts when rate limited (default: 5)

### Pagination

- **Items Per Page**: Results per page, 1-100 (default: 10)
- **Max Pages**: Maximum pages to fetch (default: 5, set to 0 for unlimited)
- **Return All**: Fetch all available pages regardless of max pages setting

### Error Handling

The node has two outputs: **Success** and **Error**.

- **Stop Workflow**: Halt on first error (default)
- **Continue & Output Error**: Route errors to Error output, continue processing remaining items
- **Ignore & Continue**: Skip failed items silently
- **Retry Then Error**: Retry with exponential backoff, then route to Error output

### Batch Processing

- **Batch Mode** (default): Group API calls for efficiency
- **Individual Mode**: One API call per item
- **Batch Size**: Items per batch (default: 10)
- **Batch Delay**: Pause between batches in milliseconds (default: 1000)

## Troubleshooting

### Node not appearing after installation

1. Ensure you've restarted n8n after installation
2. For Docker, verify the volume mount path is correct
3. Check n8n logs for any loading errors:
   ```bash
   docker compose logs n8n | grep -i canvas
   ```

### Authentication errors

1. Verify your Canvas URL doesn't have a trailing slash
2. Ensure your access token hasn't expired
3. Check that the token has appropriate permissions

### Rate limit errors

1. Increase the **Threshold** setting (default 300 may be too low for large requests)
2. Reduce **Batch Size** to spread out requests
3. Increase **Batch Delay** between batches

### "Resource not implemented" errors

Some resources have UI definitions but may not have full endpoint implementations yet. Please [open an issue](https://github.com/virtualarkansas/n8n-nodes-canvas/issues) for specific resources you need.

## Resources

- [Canvas API Documentation](https://developerdocs.instructure.com/services/canvas)
- [Canvas API Resources Reference](https://developerdocs.instructure.com/services/canvas/resources)
- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT
