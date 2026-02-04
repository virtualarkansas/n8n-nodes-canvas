# Canvas LMS n8n Community Nodes

## Project Overview

Custom n8n community nodes providing full coverage of the Canvas LMS REST API (130 resources). Built for personal use on Hostinger n8n instance with npm publishing planned.

**Repo:** https://github.com/kyancey/n8n-nodes-canvas

## Quick Reference

### Key Files
- `credentials/CanvasApi.credentials.ts` - API token auth
- `credentials/CanvasOAuth2.credentials.ts` - OAuth2 auth
- `nodes/Canvas/Canvas.node.ts` - Main mega-node
- `nodes/Canvas/CanvasTrigger.node.ts` - Webhook trigger
- `nodes/Canvas/GenericFunctions.ts` - Rate limiting, pagination, API helpers
- `nodes/Canvas/descriptions/` - Resource/operation definitions

### Commands
```bash
npm run dev          # Launch n8n with hot-reload
npm run build        # Compile TypeScript
npm run lint         # Check code style
npm run lint:fix     # Auto-fix style issues
```

### Testing
Test against Canvas Free-for-Teacher sandbox, not production instances.

## Architecture Decisions

### Single Mega-Node
All 130 Canvas resources in one node with resource/operation dropdowns. Keeps n8n palette clean.

### Rate Limiting
- Pre-flight probe: GET /api/v1/users/self before each request
- Default threshold: 300 (X-Rate-Limit-Remaining)
- Exponential backoff on 429: 2s → 4s → 8s → 16s → 32s (max 60s)
- Configurable by user

### Pagination
- Default: 10 items/page, max 5 pages (50 items)
- User can configure: unlimited pages, custom page size
- Parse Link header for rel="next" (handles bookmarks automatically)

### Error Handling
- Dual outputs: Success and Error branches
- Modes: stop, continueWithError, ignoreAndContinue, retryThenError
- Error output includes: errorCode, errorType, errorMessage, originalItem

### Batch Processing
- Default: batched (groups API calls for efficiency)
- Option: individual (one call per item)
- Always 1:1 input/output mapping

## Canvas API Notes

### Authentication
- API Token: User generates at Canvas → Account → Settings → New Access Token
- OAuth2: Requires Developer Key setup in Canvas admin

### Rate Limits
- Quota-based, not request-count-based
- X-Request-Cost: floating-point cost per request
- X-Rate-Limit-Remaining: remaining quota
- Parallel requests have pre-flight penalty

### Pagination
- Link header with opaque URLs
- Some endpoints use page numbers, some use bookmarks
- Always parse Link header, never construct URLs manually

## Implementation Status

See `docs/plans/2025-02-04-canvas-n8n-nodes-design.md` for full design.
See `docs/plans/resource-implementation-plan.md` for resource development plan.

### Phases
- [x] Phase 1: Foundation (repo, credentials, GenericFunctions)
- [x] Phase 2: Core node structure
- [ ] Phase 3: Resources (130 total) - IN PROGRESS
- [x] Phase 4: Trigger node
- [ ] Phase 5: Testing & polish

## Parallel Development Workflow

Resources are developed in parallel using feature branches:

### Branch Strategy
```bash
# Create feature branch from main
git checkout main && git pull
git checkout -b feature/resource-name

# After completing work
git push -u origin feature/resource-name

# Merge back to main (after review)
git checkout main && git merge feature/resource-name
git push
```

### Current Branches
- `feature/courses` - Courses, Sections, Tabs, Course Pace, Reports
- `feature/users` - Users, Logins, Communication Channels, Observees
- `feature/enrollments` - Enrollments, Enrollment Terms
- `feature/assignments` - Assignments, Assignment Groups, Extensions
- `feature/modules` - Modules, Module Items, Pages
- `feature/submissions` - Submissions, Comments, Peer Reviews
- `feature/grades` - Gradebook columns, Grading periods, Standards
- `feature/files` - Files, Folders, Media Objects

### Description File Pattern
Each resource gets a description file in `nodes/Canvas/descriptions/`:

```typescript
// nodes/Canvas/descriptions/CourseDescription.ts
import type { INodeProperties } from 'n8n-workflow';

export const courseOperations: INodeProperties[] = [/* operations */];
export const courseFields: INodeProperties[] = [/* fields */];
```

## Coding Standards

### TypeScript
- Strict mode enabled
- Explicit types for all function parameters and returns
- Use interfaces for complex objects

### n8n Conventions
- Resource descriptions in separate files under `descriptions/`
- Use `INodeProperties` for all node parameters
- Follow n8n naming conventions (camelCase for internal, Title Case for display)

### Error Messages
- Always include context: resource, operation, endpoint
- Include Canvas error codes when available
- Make errors actionable

## Resources

- [Canvas Developer Docs](https://developerdocs.instructure.com/services/canvas)
- [Canvas API Resources](https://developerdocs.instructure.com/services/canvas/resources)
- [n8n Node Building](https://docs.n8n.io/integrations/community-nodes/build-community-nodes/)
- [n8n Starter Template](https://github.com/n8n-io/n8n-nodes-starter)
