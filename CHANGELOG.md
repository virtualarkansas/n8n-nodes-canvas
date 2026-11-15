# Changelog

## 0.2.0 (unreleased)

Every operation of the node was executed by a real n8n (2.4.6) against a real Canvas LMS
(open-source `prod` branch, release 2026-04-22) loaded with a large, messy data set, and repaired
where it did not do what it says. `test/COVERAGE.md` lists every operation with how it was verified,
`test/ROUTE_GAPS.md` the Canvas endpoints the node does not reach.

This release changes behaviour that workflows saved with 0.1.0 may rely on. Read
"Upgrading from 0.1.0" before updating a production instance.

### Upgrading from 0.1.0

**Output**

- **Lists are always paginated.** Every operation that reads a list follows Canvas' pagination. With
  the default options an operation returns at most 50 items (5 pages of 10); switch on
  **Pagination → Return All** to get everything. In 0.1.0 about ten list operations (sub-accounts,
  gradebook column data, recipients, outcome rollups ...) returned a single page whatever the options said.
- **Wrapped answers are unwrapped.** Where Canvas answers `{ "quiz_submissions": [ ... ] }`, the node
  now outputs one item per record instead of one item holding the wrapper. Expressions such as
  `{{ $json.quiz_submissions[0].id }}` become `{{ $json.id }}`. Affected: Account Calendar (Get Many),
  Authentications Log, Blackout Date (Create, Get, Update), Collaboration (Delete), Conference,
  Enrollment Term (Get Many), Grading Period, Grading Period Set, Late Policy, LTI Registration
  (Get Many), Notification Preference, Outcome Result, Poll, Quiz Extension, Quiz Question Group, Quiz
  Statistics, Quiz Submission, Rubric (Delete, Delete Assessment, Delete Association), Search (List All
  Courses), SIS Import (Get Current, Get Many), SIS Import Error, Smart Search, Analytics (Department
  Statistics by Subaccount).
- **No item is lost.** An operation whose answer is empty (a delete answered "204 No Content") outputs
  `{ "success": true }`; 0.1.0 output nothing for that item. Every output item is linked to its input
  item (`pairedItem`).
- **Error output.** `errorCode` is a number (0 when there was no HTTP response), `errorType` is one of
  `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`,
  `SERVER_ERROR`, `INVALID_PARAMETERS`, `NETWORK_ERROR`, `TIMEOUT`, `UNKNOWN`, `errorMessage` is
  Canvas' own message, and `canvasErrors` / `responseBody` carry Canvas' payload. In 0.1.0 most errors
  were typed `UNKNOWN` and carried n8n's generic text.
- **Ignore and Continue** drops only the failing items (it also dropped successful ones with an empty
  answer). n8n's own **On Error → Continue** setting now routes failures to the node's Error output
  instead of failing the workflow.

**Requests**

- **Throttling.** Canvas' default throttle answer (`403 Forbidden (Rate Limit Exceeded)`) is recognised
  and retried with backoff; 0.1.0 only recognised 429, which Canvas sends only when an instance opts in.
- **Retry Then Error** retries throttling, server errors and network errors only (it used to retry
  400/404/422 as well), and repeats a write only when Canvas cannot have carried it out.
- **IDs in paths are percent-encoded**, so SIS IDs with spaces, slashes, `#` or `?` work as they are.
  IDs you encoded by hand keep working (a value that already contains `%XX` is not encoded again).
- **Array parameters** (includes, states, IDs) are sent as `key[]=value` everywhere. Several operations
  sent comma-joined strings that Canvas ignored or answered with an error.
- A required ID that resolves to nothing (an expression that is empty for one item) fails that item
  with a clear message instead of sending a request to a path like `/courses//assignments`.

**Operations and parameters that changed**

Operations that called a Canvas route that does not exist, or sent parameters Canvas ignores, were
corrected. Where that changed what you see in the node:

| Resource | Change | What to do |
|---|---|---|
| Account Notification | Update: **Message** is a required field (Canvas rejects an update without it) | Fill in Message |
| Authentication Provider | Type `twitter` and the settings `scopes`, `skip_internal_lookup`, `user_info_endpoint` removed (Canvas knows `scope` and `userinfo_endpoint`); Update SSO Settings sends the settings where Canvas reads them | Re-select the settings |
| Calendar Event | Get Many: `includes` replaced by `include` (the name Canvas reads) | Saved values still work |
| Content Migration | Default migration type is Course Copy; `workflow_state` removed from Update | Choose the type explicitly |
| Content Share | Create, Add Users, Update and Delete no longer take a User ID (Canvas only has these routes for the calling user) | Nothing |
| Course | List Students uses the current roster endpoint: every student once (the old endpoint repeated a student per enrollment), without the test student unless included, and its options now take effect. Sort and include values Canvas cannot serve were removed | Check workflows that counted or de-duplicated students |
| Course Pace | Create: `start_date` removed | Nothing |
| Course Report | Only the report type Canvas offers per course remains (Course Pace) | Use Account Report for provisioning, grade export and the other account reports |
| Custom Gradebook Column | Operation **Get** removed (Canvas has no such route) | Use Get Many |
| Enrollment | Create: `sisEnrollmentId` removed (not an API parameter) | Nothing |
| External Tool | Group context removed (no such routes); Return All / Limit on Get Many replaced by the node's Pagination options | Use Pagination → Return All |
| File | Get Quota: Folder context removed; Initiate Upload takes **File Name** (it never read the binary field) | Fill in File Name |
| Folder | Get by Path and Get Many only offer the contexts Canvas has routes for | Re-select the context |
| Grading Period | Batch Update takes the **Grading Period Set ID** (Canvas has no working course form); Update keeps its values in Update Fields; Delete defaults to the **Account** context (a course can only delete legacy periods of its own) | Re-enter the fields; for Delete in a course, select Context → Course again |
| Grading Period Set | Update: `enrollment_term_ids` moved to where Canvas reads it | Re-select |
| Group | Update: Override SIS Stickiness is sent where Canvas reads it (switched off, it was ignored and sticky fields were overwritten) | Nothing |
| Line Item, LTI Registration, LTI Resource Link | Return All / Limit replaced by the node's Pagination options | Use Pagination → Return All |
| Line Item, Progress → Get LTI | Need **Authentication → LTI Advantage** (see below); they never worked with an API token | Create a Canvas LTI Advantage API credential |
| Moderated Grading | Bulk Select Provisional Grades takes **Provisional Grade IDs** | Re-enter the IDs |
| New Quiz | `access_code`, `multiple_attempts`, `scoring_policy` replaced by the fields the API documents; Update uses PATCH | Re-enter the settings |
| New Quiz Item | Scoring algorithm `PartialCredit` removed (it does not exist); the documented algorithms are offered | Re-select |
| Notification Preference | Get Many: Return All / Limit removed (the list is not paginated); outputs unwrapped | Nothing |
| Outcome | Update: `add_defaults` removed | Nothing |
| Outcome Group | Context `global` removed from Get Many | Nothing |
| Outcome Import | `import_type` removed (Canvas accepts one type) | Nothing |
| Outcome Result | `include` removed from Get Many and Get Rollups (the sideloaded records are lost when the list is unwrapped) | Read the related records with their own operations |
| Page | A **Context** (course or group) is chosen first; Summary Only moved from List Revisions to the new Get Revision | Saved workflows default to Course |
| Quiz Question | `position` and `text_after_answers` removed (ignored by Canvas) | Nothing |
| Quiz Question Group | Update: question bank ID removed (Canvas accepts it on Create only) | Nothing |
| Quiz Report | `include` removed (ignored for these requests; file and progress URL are always returned) | Nothing |
| Quiz Submission | Get Many: `include` removed (lost when unwrapping) | Use Get with Include |
| Rubric | Create, Update and Delete take the course only; Update takes the complete rubric (Title, Criteria); Get: Include is split into Assessments and Associations | Re-enter |
| SIS Import | Create really sends the file now: **File Source** (Binary File, Text or Base64 Text). The binary field of 0.1.0 was never read | Check the File Source |
| Submission | Grade: `score` removed (Canvas ignores it; use Grade); Get Many: Student IDs and Workflow State moved to **Get Many for Students**; Submit a media recording requires the media type | Re-enter |
| Tab | Update: context choice removed (courses only) | Nothing |
| User | Delete takes the **Account ID** (the request needs it; 0.1.0 built an invalid path) | Fill in Account ID |

**Trigger**

- The event name is read from where Canvas puts it (`metadata.event_name`). 0.1.0 looked for
  `metadata.event_type`, which Canvas does not send, so the event selection had no effect: every
  event started the workflow and `eventType` was empty. After the update only the selected events
  start the workflow (select **All Events** to keep the old behaviour). Course and account filters
  compare local IDs with the global IDs Canvas sends.
- Events that are filtered out are answered `200 {"status":"ignored"}` (Canvas retries anything else).
- 84 events can be selected (22 before); `course_concluded` and `enrollment_concluded` were removed
  because Canvas has no such events (a concluded course or enrollment arrives as `course_updated` /
  `enrollment_updated` with its new `workflow_state`).
- **Include Metadata** moved into **Options**; the setting of a saved workflow is still honoured.
- The trigger is no longer offered as an AI tool: the "Canvas Trigger Tool" n8n generated from it
  could not do anything. The Canvas LMS node remains usable as a tool.

**Credentials**

- Canvas OAuth2 API: scopes are entered in a visible **Scopes** field (n8n ignored the hidden one).
  Reconnect the credential after updating.
- Canvas URLs may be entered with or without a trailing slash.

### Added

- **New resources (24):** Brand Config, Course Audit Log, Course Nickname, CSP Setting, Custom API
  Request, Developer Key Account Binding, Error Report, Grade Change Log, Gradebook, Gradebook History,
  GraphQL, Learning Object Date, Live Assessment, Poll Choice, Poll Session, Poll Submission, Question
  Bank, Quiz Assignment Override, Quiz IP Filter, Quiz Submission Event, Quiz Submission Question, User
  Custom Data, Web Zip Export, What-If Grade.
- **About 195 new operations on existing resources.** The node now reaches 680 of the 775 endpoints
  in Canvas' API documentation (`test/ROUTE_GAPS.md` lists the rest and why). Among them:
  - Course: List Users, Get User, settings, permissions, Batch Update, Reset Content, user progress,
    effective due dates, to-do, activity stream, test student, courses of a user.
  - User: settings, custom colors, dashboard positions, avatars, page views, missing and graded
    submissions, activity stream, to-do, upcoming events, expire mobile sessions.
  - Enrollment: Get, Delete, Set Last Attended, Accept / Reject Invitation, Bulk Enroll.
  - Account: courses of an account, settings, permissions, help links, terms of service, sub-account
    delete, restore user.
  - Assignment: overrides (single and batch), Bulk Update Dates, group members.
  - Submission: Get Many for Students, summary, gradeable students, bulk grading (per assignment and
    across assignments), read state, anonymous IDs, Upload File.
  - Submission Comment: Get Many, Upload File. Peer Review: Allocate, section context.
  - File: Download, Copy, Get Public URL, usage rights, licenses, Get by Migration ID, Reset Verifier.
    Folder: Get Media Folder. Media Object: caption tracks.
  - Module and Module Item: overrides, Duplicate, Get Sequence, Mark Read. Page: revisions, front
    page, group wikis.
  - Discussion Topic: entries and replies, read state, ratings, subscriptions.
  - Group: memberships, activity stream, permissions. Group Category: CSV export and import,
    differentiation tags. Calendar Event: course timetable.
  - Quiz: submission users, Message Students, classic and New Quizzes in one list. Quiz Submission:
    own, outstanding, time, Upload File. Quiz Extension: course-wide extensions.
  - Rubric: assessments, associations, CSV import. Outcome Result: mastery distribution, outcome
    order, Learning Mastery Gradebook settings. Outcome: Create. Outcome Group: links.
  - `npx tsx test/tools/describe.ts --list` prints every resource and operation.
- **Custom API Request** (any method and path on your Canvas, with the node's pagination, rate limiting
  and error handling) and **GraphQL**.
- **Request Options → Act as User ID** (masquerading) for every operation, per item.
- **Wait for Completion** for progress objects, SIS imports, account reports and content exports.
- **Files in and out:** File → Download, Download File for finished reports and exports, CSV exports
  attached as files, uploads for submissions, comments and quiz attempts, SIS and CSV imports from a
  binary file.
- **Canvas LTI Advantage API** credential: the node obtains and renews the token of an LTI 1.3 tool
  for the LTI Advantage services (Line Item, Progress → Get LTI, `/api/lti` paths).
- **Trigger:** optional secret token, signed payloads (verified against Instructure's key set),
  compressed bodies, Caliper deliveries, all current Live Events.
- **Debug mode** shows exactly the URL, body and `curl` command a real run sends.
- Codex files for both nodes (categories and search aliases in the n8n editor).

### Fixed

- Core: throttle detection and retries (also on later pages), pagination decided by Canvas' Link
  header instead of the operation's name, items lost on empty answers, missing `pairedItem`, n8n's
  Continue On Fail ignored, error types, redirects on writes, uploads (three steps without a runtime
  dependency, URL uploads, empty files), expression errors swallowed into empty parameters.
- Security: the credential is only ever sent to the configured Canvas host. Link and Location URLs
  are re-anchored on it, and a redirect to another host (file storage, a CDN) is followed without
  the credential; n8n would otherwise have put the Authorization header back on every hop.
- Wrong routes, methods or body shapes in many operations, among them Account Report →
  Abort, Authentication Provider → Restore, ePortfolio moderation, SIS Integration, New Quiz and
  New Quiz Item updates, moderated grading, course `offer` / `enroll_me`, quiz time limits, module
  prerequisites and completion requirements, calendar event series, group category limits,
  notification preferences for other users, developer key inheritance.
- Descriptions and defaults that did not match Canvas' behaviour.
- As an AI agent tool the node answered with nothing when an item failed in one of the "Continue"
  error modes, or in Debug Mode (n8n hands an agent the first output only). Failed items and debug
  requests are now part of the tool's answer.

### Development

- Unit tests (`npm test`): request layer, trigger, credential, description integrity and a route audit
  of every operation against the route table of a real Canvas.
- Integration battery (`npm run test:integration`): every operation on a local Canvas and n8n; see
  `test/README.md`. CI runs lint, build, type check and unit tests.
- The release workflow runs the same checks before it publishes, refuses a tag that does not match
  the version in `package.json`, and takes the release notes from this file.
- README: the manual installation steps were wrong (n8n loads community packages from
  `~/.n8n/nodes`) and are corrected; nodes loaded from a mounted folder are registered under a
  different type name than an installed package.
- No runtime dependencies.
