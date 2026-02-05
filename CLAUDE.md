# Canvas LMS n8n Community Nodes

## Project Overview

Custom n8n community nodes providing full coverage of the Canvas LMS REST API (92 resources implemented). Built for personal use on Hostinger n8n instance.

**Repo:** https://github.com/kyancey/n8n-nodes-canvas
**Version:** 0.1.0-beta.1

## Quick Reference

### Key Files
- `credentials/CanvasApi.credentials.ts` - API token auth
- `credentials/CanvasOAuth2Api.credentials.ts` - OAuth2 auth
- `nodes/Canvas/Canvas.node.ts` - Main mega-node
- `nodes/Canvas/CanvasTrigger.node.ts` - Webhook trigger
- `nodes/Canvas/GenericFunctions.ts` - Rate limiting, pagination, API helpers
- `nodes/Canvas/descriptions/` - Resource/operation definitions (92 files)

### Commands
```bash
npm run dev          # Launch n8n with hot-reload
npm run build        # Compile TypeScript
npm run lint         # Check code style
npm run lint:fix     # Auto-fix style issues
```

### Project Commands
```bash
/project:release [version]   # Create and push a release (e.g., 0.1.0-beta.2)
```

### Releasing
Releases are automated via GitHub Actions. To release:
```bash
# Update version in package.json, commit, tag, and push:
git tag v0.1.0-beta.2
git push origin v0.1.0-beta.2
```
GitHub Actions will build and create a release with the .tgz artifact.

### Testing
Test against Canvas Free-for-Teacher sandbox, not production instances.

## Architecture Decisions

### Single Mega-Node
All 92 Canvas resources in one node with resource/operation dropdowns. Keeps n8n palette clean.

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

### Current: v0.1.0-beta.1

**92 resources implemented** across all waves:

- **Wave 1 - Core:** Course, Section, Tab, CoursePace, CourseReport, User, Login, CommunicationChannel, UserObservee, Enrollment, EnrollmentTerm, Assignment, AssignmentGroup, AssignmentExtension
- **Wave 2 - Content & Grading:** Module, ModuleItem, Page, Submission, SubmissionComment, PeerReview, CustomGradebookColumn, GradingPeriod, GradingPeriodSet, GradingStandard, LatePolicy, ModeratedGrading, File, Folder, MediaObject
- **Wave 3 - Quizzes & Assessments:** Quiz, QuizQuestion, QuizQuestionGroup, QuizSubmission, QuizReport, QuizStatistics, QuizExtension, NewQuiz, NewQuizItem, NewQuizAccommodations, NewQuizReport, Rubric, Outcome, OutcomeGroup, OutcomeImport, OutcomeResult, ProficiencyRating
- **Wave 4 - Communication & Collaboration:** DiscussionTopic, Announcement, AnnouncementExternalFeed, Conversation, CommMessage, NotificationPreference, CalendarEvent, AppointmentGroup, BlackoutDate, Group, GroupCategory, Collaboration, Conference
- **Wave 5 - Admin & Integration:** Account, AccountReport, AccountNotification, AccountCalendar, Admin, Role, AccessToken, ApiTokenScope, AuthenticationProvider, AuthenticationsLog, DeveloperKey, ExternalTool, LtiRegistration, LtiResourceLink, LineItem, SisImport, SisImportError, SisIntegration
- **Wave 6 - Analytics & Misc:** Analytics, Progress, Search, SmartSearch, History, ContentExport, ContentMigration, ContentShare, BlueprintCourse, Favorite, FeatureFlag, Planner, Bookmark, EPortfolio, Poll

### Phases
- [x] Phase 1: Foundation (repo, credentials, GenericFunctions)
- [x] Phase 2: Core node structure
- [x] Phase 3: Resources (92 complete)
- [x] Phase 4: Trigger node
- [ ] Phase 5: Testing & polish (IN PROGRESS)

### Next Steps
1. Test all resources against Canvas Free-for-Teacher sandbox
2. Fix any issues discovered during testing
3. Prepare for npm publishing

### Description File Pattern
Each resource gets a description file in `nodes/Canvas/descriptions/`:

```typescript
// nodes/Canvas/descriptions/CourseDescription.ts
import type { INodeProperties } from 'n8n-workflow';

export const courseOperations: INodeProperties[] = [/* operations */];
export const courseFields: INodeProperties[] = [/* fields */];
```

All description files export operations and fields arrays, then re-exported from `descriptions/index.ts`.

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
