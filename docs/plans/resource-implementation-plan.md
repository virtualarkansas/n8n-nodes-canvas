# Canvas n8n Node - Resource Implementation Plan

## Branch Strategy

Each resource group gets its own feature branch, developed in parallel, then merged to main.

## Resource Groups (Priority Order)

### Wave 1 - Core (Most Used)
| Branch | Resources | Count |
|--------|-----------|-------|
| `feature/courses` | Courses, Sections, Tabs, Course Pace, Course Reports | 5 |
| `feature/users` | Users, Logins, Communication Channels, User Observees | 4 |
| `feature/enrollments` | Enrollments, Enrollment Terms | 2 |
| `feature/assignments` | Assignments, Assignment Groups, Assignment Extensions | 3 |

### Wave 2 - Content & Grading
| Branch | Resources | Count |
|--------|-----------|-------|
| `feature/modules` | Modules, Module Items, Pages | 3 |
| `feature/submissions` | Submissions, Submission Comments, Peer Reviews | 3 |
| `feature/grades` | Custom Gradebook Columns, Grading Periods, Grading Standards, Late Policy, Grade Change Log, Gradebook History | 6 |
| `feature/files` | Files, Folders, Media Objects | 3 |

### Wave 3 - Quizzes & Assessments
| Branch | Resources | Count |
|--------|-----------|-------|
| `feature/quizzes-classic` | Quizzes, Quiz Questions, Quiz Question Groups, Quiz Submissions, Quiz Reports, Quiz Statistics, Quiz Extensions | 7 |
| `feature/quizzes-new` | New Quizzes, New Quiz Items, New Quizzes Accommodations, New Quizzes Reports | 4 |
| `feature/rubrics-outcomes` | Rubrics, Outcomes, Outcome Groups, Outcome Imports, Outcome Results, Proficiency Ratings | 6 |

### Wave 4 - Communication & Collaboration
| Branch | Resources | Count |
|--------|-----------|-------|
| `feature/discussions` | Discussion Topics, Announcements, Announcement External Feeds | 3 |
| `feature/conversations` | Conversations, CommMessages, Notification Preferences | 3 |
| `feature/calendar` | Calendar Events, Appointment Groups, Blackout Dates | 3 |
| `feature/groups` | Groups, Group Categories, Collaborations, Conferences | 4 |

### Wave 5 - Admin & Integration
| Branch | Resources | Count |
|--------|-----------|-------|
| `feature/accounts` | Accounts, Account Reports, Account Notifications, Account Calendars, Admins, Roles | 6 |
| `feature/auth` | Access Tokens, API Token Scopes, Authentication Providers, Authentications Log, Developer Keys | 5 |
| `feature/lti` | External Tools, LTI Registrations, LTI Resource Links, Line Items | 4 |
| `feature/sis` | SIS Imports, SIS Import Errors, SIS Integration | 3 |

### Wave 6 - Analytics & Misc
| Branch | Resources | Count |
|--------|-----------|-------|
| `feature/analytics` | Analytics, Progress, Search, Smart Search, History | 5 |
| `feature/content-mgmt` | Content Exports, Content Migrations, Content Shares, Blueprint Courses | 4 |
| `feature/misc` | Favorites, Feature Flags, Planner, Bookmarks, ePortfolios, Polls | 6 |

## File Structure for Each Resource

```
nodes/Canvas/descriptions/
├── CourseDescription.ts
├── UserDescription.ts
├── EnrollmentDescription.ts
└── ... (one file per resource)
```

Each description file exports:
- `{Resource}Operations` - Available operations for the resource
- `{Resource}Fields` - Fields for each operation

## Implementation Checklist Per Resource

- [ ] Create description file with operations
- [ ] Add all required fields for each operation
- [ ] Add optional fields (additionalFields/updateFields)
- [ ] Add include[] options where applicable
- [ ] Update Canvas.node.ts to import description
- [ ] Update buildEndpoint() function
- [ ] Test with Canvas Free-for-Teacher

## Merge Order

1. Merge Wave 1 branches first (core functionality)
2. Then Wave 2-6 in order
3. Each merge should pass build + lint
