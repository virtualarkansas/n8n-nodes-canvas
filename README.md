# n8n-nodes-canvas

Custom n8n community nodes for **Canvas LMS** by Instructure. Provides full coverage of the Canvas REST API with 130+ resources.

## Features

- **Full API Coverage**: Access all 130 Canvas API resources
- **Dual Authentication**: API Access Token and OAuth2 support
- **Smart Rate Limiting**: Automatic quota checking with configurable thresholds
- **Pagination Handling**: Automatic pagination with configurable limits
- **Error Handling**: Multiple error modes with dedicated error output branch
- **Batch Processing**: Process multiple items efficiently
- **Webhook Trigger**: Listen for Canvas Live Events

## Installation

### On n8n Cloud or Self-Hosted

```bash
npm install n8n-nodes-canvas
```

### For Development

```bash
git clone https://github.com/kyancey/n8n-nodes-canvas.git
cd n8n-nodes-canvas
npm install
npm run dev
```

## Nodes

### Canvas LMS

The main node for interacting with Canvas API. Supports all standard operations:

- **Create**: Create new resources
- **Get**: Retrieve a single resource
- **Get Many**: List resources with pagination
- **Update**: Modify existing resources
- **Delete**: Remove resources

### Canvas Trigger

Webhook trigger for Canvas Live Events. Configure the webhook URL in Canvas Admin → Data Services.

Supported events:
- Course: created, updated, concluded
- Enrollment: created, updated, concluded
- Assignment: created, updated
- Submission: created, updated, graded
- Discussion: topic created, entry created
- User: created, updated, login
- Quiz: submitted
- And more...

## Configuration

### API Access Token

1. In Canvas, go to **Account → Settings**
2. Click **+ New Access Token**
3. Enter a purpose and expiration (optional)
4. Copy the generated token

### OAuth2

1. In Canvas Admin, go to **Developer Keys**
2. Create a new Developer Key
3. Configure the redirect URI to your n8n instance
4. Use the Client ID and Secret in n8n credentials

## Options

### Rate Limiting

- **Threshold**: Minimum remaining quota before proceeding (default: 300)
- **Max Retries**: Retry attempts on rate limit errors (default: 5)

### Pagination

- **Items Per Page**: Results per page (default: 10, max: 100)
- **Max Pages**: Maximum pages to fetch (default: 5, 0 = unlimited)
- **Return All**: Fetch all available pages

### Error Handling

- **Stop Workflow**: Halt on first error
- **Continue & Output Error**: Route errors to Error output, continue processing
- **Ignore & Continue**: Skip failed items silently
- **Retry Then Error**: Retry with backoff before routing to Error output

### Batch Processing

- **Batch Mode**: Group API calls for efficiency
- **Individual Mode**: One API call per item
- **Batch Size**: Items per batch (default: 10)
- **Batch Delay**: Pause between batches in ms (default: 1000)

## Resources

See the [Canvas API Documentation](https://developerdocs.instructure.com/services/canvas) for detailed endpoint information.

## License

MIT
