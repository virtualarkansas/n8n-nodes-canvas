# Canvas LMS n8n Community Nodes - Design Document

**Date:** 2025-02-04
**Status:** Approved
**Repo:** n8n-nodes-canvas

## Overview

Custom n8n community nodes providing full coverage of the Canvas LMS REST API (130 resources). Designed for installation on personal n8n instances with future npm publishing in mind.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Coverage | Full - all 130 Canvas API resources |
| Authentication | Both API Access Token and OAuth2 |
| Architecture | Single mega-node with resource/operation dropdowns |
| Canvas URL | User-configured in credentials (multi-tenant) |
| Pagination | Hybrid - default 10/page, max 5 pages; user-configurable |
| Rate Limiting | Pre-flight probe, threshold 300, exponential backoff |
| Error Handling | Dual outputs (Success/Error) with configurable behavior |
| Batch Operations | Default batched, always 1:1 input/output mapping |
| Extras | Webhook trigger, include[] support |
| Testing | Canvas Free-for-Teacher sandbox |
| Publishing | Start private, build to community standards |

## Project Structure

```
n8n-nodes-canvas/
├── .github/
│   └── workflows/
│       └── ci.yml
├── credentials/
│   ├── CanvasApi.credentials.ts
│   └── CanvasOAuth2.credentials.ts
├── nodes/
│   └── Canvas/
│       ├── Canvas.node.ts
│       ├── CanvasTrigger.node.ts
│       ├── GenericFunctions.ts
│       ├── descriptions/
│       │   ├── CourseDescription.ts
│       │   ├── UserDescription.ts
│       │   └── ... (one per resource group)
│       └── types/
│           └── Canvas.types.ts
├── icons/
│   └── canvas.svg
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── CLAUDE.md
└── README.md
```

## Authentication

### API Access Token (CanvasApi.credentials.ts)

```typescript
{
  name: 'canvasApi',
  displayName: 'Canvas API',
  properties: [
    {
      displayName: 'Canvas URL',
      name: 'canvasUrl',
      type: 'string',
      placeholder: 'https://yourschool.instructure.com',
      required: true,
    },
    {
      displayName: 'Access Token',
      name: 'accessToken',
      type: 'string',
      typeOptions: { password: true },
      required: true,
    },
  ],
  test: { request: { baseURL: '={{$credentials.canvasUrl}}/api/v1', url: '/users/self' } },
}
```

### OAuth2 (CanvasOAuth2.credentials.ts)

```typescript
{
  name: 'canvasOAuth2',
  displayName: 'Canvas OAuth2',
  extends: ['oAuth2Api'],
  properties: [
    {
      displayName: 'Canvas URL',
      name: 'canvasUrl',
      type: 'string',
      required: true,
    },
  ],
  // OAuth2 endpoints derived from canvasUrl:
  // authorizationUrl: {{canvasUrl}}/login/oauth2/auth
  // accessTokenUrl: {{canvasUrl}}/login/oauth2/token
}
```

## Rate Limit Management

```typescript
interface RateLimitOptions {
  enabled: boolean;              // Default: true
  threshold: number;             // Default: 300
  maxRetries: number;            // Default: 5
  baseDelayMs: number;           // Default: 2000
  maxDelayMs: number;            // Default: 60000
}
```

**Behavior:**
1. Pre-flight probe: GET /api/v1/users/self
2. Check X-Rate-Limit-Remaining header
3. If remaining < threshold, wait with exponential backoff
4. On 429 failure: backoff (2s → 4s → 8s → 16s → 32s, capped at 60s), re-probe, retry
5. Backoff formula: `delay = min(baseDelayMs * 2^attempt, maxDelayMs)`

## Pagination

```typescript
interface PaginationOptions {
  enabled: boolean;              // Default: true
  perPage: number;               // Default: 10, max: 100
  maxPages: number;              // Default: 5, 0 = unlimited
}
```

**Behavior:**
- Parse Link header for rel="next" (handles page numbers and bookmarks)
- Check rate limit before each page request
- Stop when no "next" link or maxPages reached

## Error Handling

### Dual Outputs
- **Success**: Items that completed successfully
- **Error**: Items that failed (with error details)

### Error Handling Options

```typescript
interface ErrorHandlingOptions {
  onError:
    | 'stop'              // Stop workflow on first error (default)
    | 'continueWithError' // Output to error branch, continue processing
    | 'ignoreAndContinue' // Skip failed items silently
    | 'retryThenError';   // Retry with backoff, then error branch

  maxRetries: number;     // For retryThenError mode (default: 3)
}
```

### Error Output Structure

```typescript
{
  json: {
    error: true,
    errorCode: 403,
    errorType: 'FORBIDDEN',
    errorMessage: 'User not authorized for this action',
    canvasErrorCode: 'unauthorized',
    originalItem: { ... },
    resource: 'course',
    operation: 'get',
    endpoint: '/api/v1/courses/123',
    timestamp: '2025-02-04T...',
  }
}
```

### Error Categories

| Code | Type | Typical Cause |
|------|------|---------------|
| 401 | UNAUTHORIZED | Invalid/expired token |
| 403 | FORBIDDEN | No permission on resource |
| 404 | NOT_FOUND | Resource doesn't exist |
| 422 | VALIDATION_ERROR | Invalid parameters |
| 429 | RATE_LIMITED | Quota exceeded |
| 500 | SERVER_ERROR | Canvas internal error |

## Batch Operations

### Processing Modes

```typescript
{
  displayName: 'Processing Mode',
  name: 'processingMode',
  type: 'options',
  default: 'batch',
  options: [
    { name: 'Batch (Recommended)', value: 'batch' },
    { name: 'Individual', value: 'individual' },
  ],
}
```

### Batch Options

```typescript
{
  batchSize: 10,        // Items per batch
  batchDelay: 1000,     // ms between batches
}
```

**Output Behavior:** Always 1:1 mapping (300 inputs → 300 outputs)

## Resource Coverage (130 Total)

### Account & Admin (14)
Access Tokens, Account Calendars, Account Domain Lookups, Account Notifications, Account Reports, Accounts, Accounts (LTI), Admins, API Token Scopes, Brand Configs, Shared Brand Configs, Roles, Sandboxes, Services

### Users & Identity (10)
Users, Logins, Authentication Providers, Authentications Log, Communication Channels, User Observees, Temporary Enrollment Pairings, InstAccess Tokens, JWTs, Public JWK

### Courses & Structure (12)
Courses, Sections, Course Pace, Course Audit Log, Course Reports, Tabs, Modules, Pages, Favorites, Blueprint Courses, Content Exports, Content Migrations

### Enrollments & Groups (6)
Enrollments, Enrollment Terms, Groups, Group Categories, Names and Role, Content Shares

### Assignments & Grading (15)
Assignments, Assignment Extensions, Assignment Groups, Submissions, Submission Comments, Custom Gradebook Columns, Grade Change Log, Gradebook History, Grading Periods, Grading Period Sets, Grading Standards, Late Policy, Moderated Grading, Peer Reviews, What If Grades

### Quizzes - Classic (14)
Quizzes, Quiz Questions, Quiz Question Groups, Quiz Submissions, Quiz Submission Questions, Quiz Submission Events, Quiz Submission Files, Quiz Submission User List, Quiz Reports, Quiz Statistics, Quiz Extensions, Course Quiz Extensions, Quiz Assignment Overrides, Quiz IP Filters

### Quizzes - New (4)
New Quizzes, New Quiz Items, New Quizzes Accommodations, New Quizzes Reports

### Rubrics & Outcomes (7)
Rubrics, Outcomes, Outcome Groups, Outcome Imports, Outcome Results, Proficiency Ratings, Originality Reports

### Calendar & Scheduling (4)
Calendar Events, Appointment Groups, Blackout Dates, Learning Object Dates

### Communication (5)
Announcements, Announcement External Feeds, Conversations, CommMessages, Notification Preferences

### Discussions & Collaboration (4)
Discussion Topics, Conferences, Collaborations, LiveAssessments

### Files & Media (4)
Files, Media Objects, ePortfolios, ePub Exports

### LTI & External Tools (7)
External Tools, Developer Keys, Developer Key Account Bindings, LTI Registrations, LTI Launch Definitions, LTI Resource Links, Line Items

### Analytics & Reporting (7)
Analytics, History, Progress, Search, Smart Search, Error Reports, SIS Import Errors

### SIS Integration (3)
SIS Imports, SIS Integration, Result

### Polls (4)
Polls, PollChoices, Poll Sessions, PollSubmissions

### AI Features (2)
AI Conversations, AI Experiences

### Planner & Bookmarks (2)
Planner, Bookmarks

### Other (6)
Content Security Policy Settings, Feature Flags, Score, BlockEditorTemplate, Notice Handlers, Canvas Career Experiences

## Trigger Node (CanvasTrigger.node.ts)

### Supported Events
| Category | Events |
|----------|--------|
| Course | created, updated, concluded |
| Enrollment | created, updated, concluded |
| Assignment | created, updated |
| Submission | created, updated, graded |
| Discussion | topic_created, entry_created |
| User | created, updated, login |
| Grade | grade_change |
| Quiz | submitted |

### Properties
- Events (multi-select)
- Filter by Course ID (optional)

## Implementation Phases

### Phase 1 - Foundation
- [x] Design document
- [ ] Initialize repo with n8n starter template
- [ ] Set up git lfs, GitHub repo
- [ ] Create CLAUDE.md
- [ ] Implement credentials (API Token + OAuth2)
- [ ] Build GenericFunctions.ts (rate limiting, pagination, error handling)

### Phase 2 - Core Node Structure
- [ ] Canvas.node.ts skeleton with outputs (Success/Error)
- [ ] Processing mode, batch options, error handling options
- [ ] Common node parameters (Canvas URL inheritance, include[] support)

### Phase 3 - Resources
1. [ ] Users, Courses, Enrollments, Sections (core)
2. [ ] Assignments, Submissions, Grades (grading workflow)
3. [ ] Modules, Pages, Files (content)
4. [ ] Quizzes (Classic + New)
5. [ ] Groups, Discussions, Announcements (collaboration)
6. [ ] All remaining resources (complete coverage)

### Phase 4 - Trigger Node
- [ ] CanvasTrigger.node.ts
- [ ] Webhook endpoint setup
- [ ] Event filtering

### Phase 5 - Testing & Polish
- [ ] Test against Canvas Free-for-Teacher
- [ ] Documentation
- [ ] Prepare for npm publish

## References

- [Canvas Developer Docs](https://developerdocs.instructure.com/services/canvas)
- [Canvas API Resources](https://developerdocs.instructure.com/services/canvas/resources)
- [Canvas Throttling](https://developerdocs.instructure.com/services/canvas/basics/file.throttling)
- [Canvas Pagination](https://canvas.instructure.com/doc/api/file.pagination.html)
- [n8n Node Building Docs](https://docs.n8n.io/integrations/community-nodes/build-community-nodes/)
- [n8n Starter Template](https://github.com/n8n-io/n8n-nodes-starter)
