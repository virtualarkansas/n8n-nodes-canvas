# Canvas battery seed data

Loads the local Canvas instance (see `../up.sh`) with a large, deliberately messy data set so
the n8n node battery runs against something that looks like a real district rather than five
tidy records of each kind. Everything is fake (`example.edu` / `example.com` / `example.org`).

```bash
test/env/canvas/seed/run.sh             # seed (re-runnable), merge fixtures into test/.state.json, print counts
test/env/canvas/seed/run.sh --fixtures  # only re-publish tokens + fixture ids of what is already seeded
test/env/canvas/seed/run.sh --summary   # only print record counts / DB size / disk
SEED_ONLY=quizzes test/env/canvas/seed/run.sh   # run a subset of steps (prefix or glob of the step name)
```

A full run on an empty instance takes roughly 20 minutes. Do not run the battery while the
seed is running: each step is one database transaction and holds row locks (for example on
the persona users) until it commits, so API calls touching the same rows wait.

## How it works

* `seed.rb` loads `lib.rb` and then every `NN_*.rb` phase file in order, inside
  `bundle exec rails runner` in the `canvas-web` container.
* Each phase is made of **steps** (`Seed.step("name") { ... }`). A step is one transaction and
  writes a marker row (table `public.n8n_seed_steps`) in that same transaction, together with
  the fixtures / tokens / internal references it produced. Re-running skips finished steps,
  so nothing is duplicated; a step that failed half-way was rolled back and simply runs again.
  (Persona API tokens only exist in clear text at creation time; they are kept in the marker
  rows so `--fixtures` can re-publish them.)
* All randomness comes from `Seed.rng(label)` (fixed seed `20261115`), dates are relative to
  the hour the seed runs, so the *current* term is always current.
* Records are created through the real models (`course.enroll_user`, `submit_homework`,
  `grade_student`, `generate_submission`, `reply_from`, ...) or, where a background job does
  the work, through the REST API (SIS imports, exports, course copy, blueprint sync, content
  shares, reports, recurring calendar events, 3-step file upload).
* Background work: the loader queues Canvas' `delay_if_production` jobs into its own job
  queue (`n8n_seed`) instead of running them inline, and works that queue off itself after
  every phase. Notifications are silenced (otherwise ~600 users x thousands of events fill the
  `messages` table) except for a small deliberate sample; a few job types that are pure
  overhead here are dropped (see `SKIPPED_JOBS` in `lib.rb`), per-student grade recalculations
  are collapsed into one whole-course job, and activity-stream items for submissions, comments
  and discussion replies are only generated for the personas.
* `run.sh` copies this directory into the container, runs phases 01-05, then two loader
  processes in parallel (06-12 = main course, 13 = all other courses), then 14 + 99, merging
  `canvas.tokens.*` / `canvas.fixtures.*` into `test/.state.json` after every phase.

| File | Creates |
| --- | --- |
| `01_accounts.rb` | sub-account tree, terms, roles + permission overrides, feature flags, grading schemes, grading period sets, developer keys, LTI 1.1 tools, auth providers, account notifications |
| `02_users.rb` | personas + tokens, account admins, ~40 deliberately awkward users, ~436 bulk users |
| `03_courses.rb` | 15 special courses, 78 catalog courses, sections, SIS import #1 (large course) |
| `04_enrollments.rb` | ~3,200 enrollments, observer links, cross-listing, deleted / merged users |
| `05_assignments.rb` | main-course groups, assignment groups, ~100 assignments, overrides, late policies, gradebook columns |
| `06_submissions.rb` | ~2,500 submissions/grades, comments, peer reviews, moderated + anonymous grading |
| `07_outcomes_rubrics.rb` | outcome groups/outcomes, proficiency ratings, rubrics, ~250 rubric assessments -> outcome results |
| `08_content.rb` | ~80 pages, ~320 files in a deep folder tree, user + group files |
| `09_quizzes.rb` | question banks, 26 classic quizzes, ~430 quiz attempts, extensions |
| `10_discussions.rb` | ~65 topics, ~1,200 entries, ~70 announcements, external feeds |
| `11_modules.rb` | 26 modules (+4 in the second course), ~110 items, module progressions |
| `12_comms.rb` | more groups, ~210 conversations, ~170 calendar events, appointment groups, planner, bookmarks, favorites, ePortfolios, polls, blackout dates, notification preferences, collaborations, conferences |
| `13_other_courses.rb` | assignments / grades / pages / modules / discussions in every other course; concludes + deletes courses |
| `14_api.rb` | SIS imports #2 (clean) and #3 (errors) + a failed one, outcome import, exports, course copy, blueprint sync, content shares, reports, recurring events, API upload, page views |
| `99_finish.rb` | final grade recalculation, waits for both job queues to drain, health report |

## What gets created (approximate)

| | |
| --- | --- |
| Sub-accounts | 17 (3 levels deep) + 2 created by SIS import; one deleted |
| Terms | 10: 3 past, current, 2 future, no dates, no SIS id, default, deleted (+1 by SIS import) |
| Users | ~620 (7 personas, 5 extra staff, ~40 special, 436 bulk, ~135 from SIS imports) |
| Courses | ~100: 93 from the models + 6 from SIS imports + 1 course copy (states: available, unpublished, completed, deleted) |
| Enrollments | ~3,300 (all 5 types, custom roles, every state) |
| Main course `courseId` | ~73 active students in 4 sections, ~130 assignments, 26 quizzes, 56 discussions, 37 announcements, 26 modules, 70 pages, ~290 files, 33 groups |
| Large course `largeCourseId` | ~240 active students in 6 SIS sections, 12 assignments, two of them with > 200 submissions |
| Submissions | ~30,000 rows, ~4,500 of them submitted and/or graded |
| Quizzes | 29 with ~125 questions and ~450 quiz submissions |
| Discussion entries | ~1,400 (9 levels deep in one thread) |
| Conversations | ~210 with ~700 messages (teacher persona participates in ~130) |
| Calendar events | ~190 incl. two recurring series, section-specific child events, account calendars |
| Files | ~340 (all tiny; file storage stays around 2 MB) |

`run.sh --summary` prints the exact numbers.

## Personas (`canvas.tokens.*`)

All persona logins use the password in `canvas.fixtures.defaultPassword`; login ids are in
`canvas.fixtures.personaLogins`.

| Token | User | Role |
| --- | --- | --- |
| `admin` | user 1 | root account admin (pre-existing); also enrolled as teacher in `courseId` / `courseId2` so self-scoped endpoints return data |
| `teacher` | Teresa Marlowe (`teacherUserId`) | teacher in 34 courses (published + unpublished, past + current), incl. main, second, large |
| `ta` | `taUserId` | TA in the main course, section-limited TA in the second course |
| `student` | Sam Student (`studentUserId`) | student in ~22 courses (main: Period 1), has data of every kind |
| `student2` | `student2UserId` | student in ~11 courses (main: Period 2), locale `es` |
| `observer` | `observerUserId` | observes `student`, `student2` and one more student |
| `designer` | `designerUserId` | designer in main, second, blueprint and a few others |
| `subaccountAdmin` | `subaccountAdminUserId` | AccountAdmin on `subAccountId` only (not the root account) |

Self-scoped APIs (`/users/self/...`, `/planner_notes`, `/polls`, `/conversations`) only return
the caller's own records. Un-prefixed fixtures for those (`bookmarkId`, `plannerNoteId`,
`plannerOverrideId`, `pollId`, `pollSessionId`, `pollChoiceId`, `ePortfolioId`,
`contentShareId`, `adminCalendarEventId`) belong to the **admin** token; the `teacher...` /
`student...` variants belong to those personas. `conversationId` has admin, teacher and
student as participants and works with all three tokens.

## Fixtures (`canvas.fixtures.*`)

Accounts and admin

| Key | Points to |
| --- | --- |
| `accountId`, `siteAdminAccountId` | root account "Battery Test District" (1), site admin (2) |
| `subAccountId` (+`subAccountSisId`), `midSubAccountId`, `deepSubAccountId` | Riverside High School > Science Department > Biology |
| `secondSubAccountId`, `deletedSubAccountId` | Lakeview Middle School; a deleted sub-account |
| `termId` (+`termSisId`), `pastTermId`, `olderPastTermId`, `futureTermId`, `noDatesTermId`, `defaultTermId`, `deletedTermId` | enrollment terms |
| `customRoleId`, `customStudentRoleId`, `customTeacherRoleId`, `customObserverRoleId`, `accountRoleId`, `inactiveRoleId` | custom roles: Lead TA (course), Auditor, Co-Teacher, Parent Volunteer, Registrar (account), a deactivated role |
| `studentRoleId`, `teacherRoleId`, `taRoleId`, `designerRoleId`, `observerRoleId`, `accountAdminRoleId` | built-in role ids |
| `subaccountAdminAccountUserId`, `registrarUserId`, `registrarAccountUserId` | account admins (`/accounts/:id/admins`) |
| `accountNotificationId`, `pastAccountNotificationId`, `futureAccountNotificationId` | global announcements |
| `gradingStandardId` (= `accountGradingStandardId`), `courseGradingStandardId` | grading schemes |
| `gradingPeriodSetId`, `emptyGradingPeriodSetId`, `gradingPeriodId` (ended, still open), `currentGradingPeriodId` | grading period sets / periods of the current term |
| `featureFlagName`, `rootFeatureFlagName`, `courseFeatureFlagName` | flags toggled on `subAccountId`, the root account, the main course |
| `developerKeyId`, `scopedDeveloperKeyId` (+`scopedDeveloperKeyScopes`), `inactiveDeveloperKeyId` | API keys without / with enforced scopes, an inactive key |
| `oauthDeveloperKeyId`, `oauthDeveloperKeyClientId`, `oauthDeveloperKeySecret`, `oauthRedirectUri` | key for the OAuth2 authorization-code flow (redirect `http://localhost:5678/rest/oauth2-credential/callback`); client id is accepted in both forms |
| `externalToolId` (+`externalToolUrl`), `courseExternalToolId` | LTI 1.1 tools at account / course level |
| `authenticationProviderId` (SAML), `casAuthenticationProviderId`, `canvasAuthenticationProviderId`, `deletedAuthenticationProviderId` (LDAP) | authentication providers |
| `sisImportId`, `secondSisImportId`, `sisImportWithErrorsId` (+`sisImportErrorCount`), `failedSisImportId` | SIS import batches |
| `accountReportType`, `accountReportId`, `accountReportIds` | account reports that were run |
| `accountCalendarAccountId`, `hiddenAccountCalendarAccountId`, `accountCalendarEventId` | account calendars (visible / hidden) and an account-level event |
| `accountBlackoutDateId`, `blackoutDateId` | blackout dates on the root account / the main course |

Users

| Key | Points to |
| --- | --- |
| `adminUserId`, `teacherUserId`, `teacher2UserId`, `taUserId`, `studentUserId`, `student2UserId`, `observerUserId`, `designerUserId`, `subaccountAdminUserId` | personas and supporting cast |
| `teacherSisUserId`, `studentSisUserId`, `studentLoginId`, `personaLogins`, `defaultPassword` | SIS ids / logins |
| `unicodeUserId`, `rtlUserId`, `emojiUserId`, `longNameUserId` (254 chars), `oddSisUserId` (+`oddSisUserSisId` = `S/SLASH:COLON;0018`) | awkward names / SIS ids |
| `noEmailUserId` | username login, no communication channel |
| `multiLoginUserId`, `loginId`, `secondLoginId`, `samlLoginId`, `deletedLoginId` | one user with several logins |
| `multiChannelUserId`, `communicationChannelId`, `secondCommunicationChannelId`, `unconfirmedCommunicationChannelId`, `retiredCommunicationChannelId`, `smsCommunicationChannelId`, `adminCommunicationChannelId` | communication channels in different states |
| `deletedUserId`, `suspendedUserId`, `pendingUserId`, `mergedUserId` -> `mergeTargetUserId`, `testStudentUserId` | lifecycle edge cases |
| `observeeUserId`, `userObservationLinkId` | observer links of the observer persona |
| `sisUserId` (+`sisUserSisId`), `sampleStudentUserIds` | SIS-created user; a few ordinary students |
| `accessTokenId`, `expiredAccessTokenId`, `scopedAccessTokenId` (+`scopedAccessToken`) | spare tokens of the teacher persona (not used for auth by the seed) |
| `notificationPreferenceChannelId`, `notificationPreferenceCategory`, `notificationName` | channel of the student persona with customised preferences |
| `pageViewUserIds` | users with page views / recent history |

Courses, sections, enrollments

| Key | Points to |
| --- | --- |
| `courseId` (+`courseSisId`) | **main course** "Biology 101: Cells to Ecosystems" - almost everything below lives here |
| `courseId2` | second populated course "Algebra II" (`course2SectionId`, `course2AssignmentId`, `course2AssignmentGroupId`, `course2QuizId`, `course2ModuleId`, `course2PageUrl`, `course2FolderId`, `course2FileId`, `course2GroupCategoryId`, `course2GroupId`, `course2OutcomeGroupId`) |
| `emptyCourseId` | unpublished shell without enrollments or content |
| `largeCourseId` (+`largeCourseSisId`, `largeCourseSectionIds`, `largeCourseStudentCount`, `largeCourseAssignmentId`, `largeCourseGroupCategoryId`) | SIS-managed course with ~240 students |
| `concludedCourseId` (+`concludedCourseAssignmentId`), `concludedCourseIds` | hard-concluded courses (with grades) |
| `unpublishedCourseId`, `deletedCourseId`, `deletedCourseIds` | unpublished / deleted |
| `blueprintCourseId`, `blueprintTemplateId`, `blueprintChildCourseId`, `blueprintChildCourseIds`, `blueprintMigrationId`, `blueprintSubscriptionId`, `blueprintAssignmentId`, `blueprintLockedPageUrl` | blueprint with 3 associated courses, one completed sync, locked items, an unsynced change |
| `dateRestrictedCourseId`, `futureDatedCourseId`, `publicCourseId` (+`selfEnrollmentCode`), `pacedCourseId`, `sisManagedCourseId`, `probeCourseId` | other special courses |
| `sectionId` (+`sectionSisId`), `sectionId2`, `dateRestrictedSectionId`, `emptySectionId`, `deletedSectionId` | sections of the main course |
| `crossListedSectionId`, `crossListTargetCourseId`, `crossListSourceCourseId`, `sisCrossListedSectionId` | cross-listed sections |
| `enrollmentId` (student persona), `student2EnrollmentId`, `teacherEnrollmentId`, `taEnrollmentId`, `designerEnrollmentId`, `observerEnrollmentId`, `adminEnrollmentId` | active enrollments in the main course |
| `sectionLimitedEnrollmentId`, `customRoleEnrollmentId`, `customStudentRoleEnrollmentId`, `multiSectionEnrollmentId`, `invitedEnrollmentId`, `inactiveEnrollmentId`, `concludedEnrollmentId`, `deletedEnrollmentId`, `inactiveStudentUserId`, `concludedStudentUserId` | enrollment edge cases in the main course |
| `mainCourseStudentCount`, `course2StudentCount`, `teacherCourseCount` | sizes |

Assignments, submissions, grading (main course)

| Key | Points to |
| --- | --- |
| `assignmentGroupId` (Homework, drop rules), `emptyAssignmentGroupId`, `deletedAssignmentGroupId` | assignment groups (weighted) |
| `assignmentId` | "HW 1" - `online_text_entry`, every submission state exists |
| `urlAssignmentId`, `uploadAssignmentId`, `mediaAssignmentId`, `externalToolAssignmentId`, `onPaperAssignmentId`, `noSubmissionAssignmentId`, `annotationAssignmentId`, `multiAttemptAssignmentId` | one per submission type |
| `letterGradeAssignmentId`, `passFailAssignmentId`, `percentAssignmentId`, `gpaAssignmentId`, `notGradedAssignmentId` | grading types |
| `zeroPointsAssignmentId`, `decimalPointsAssignmentId`, `hugePointsAssignmentId`, `omitFromFinalAssignmentId` | point edge cases |
| `noDueDateAssignmentId`, `futureAssignmentId`, `lockedAssignmentId`, `unpublishedAssignmentId`, `deletedAssignmentId` | dates / states |
| `overrideAssignmentId`, `assignmentOverrideId` (section), `adhocAssignmentOverrideId`, `groupAssignmentOverrideId`, `deletedAssignmentOverrideId`, `sectionOnlyAssignmentId`, `adhocOnlyAssignmentId` | overrides |
| `peerReviewAssignmentId`, `peerReviewId`, `peerReviewerUserId`, `peerRevieweeUserId`, `peerReviewSubmissionId`, `autoPeerReviewAssignmentId` | peer reviews |
| `groupAssignmentId`, `groupSubmissionUserId` | group assignment (graded as a group) |
| `moderatedAssignmentId`, `provisionalGradeId`, `moderatedStudentUserId`, `moderatedPublishedAssignmentId` | moderated grading (unpublished / published) |
| `anonymousAssignmentId`, `manualPostAssignmentId` | anonymous grading, manual post policy (grades hidden) |
| `submissionId`, `submissionUserId`, `submissionCommentId`, `submissionCommentWithFileId`, `draftSubmissionCommentId` | graded submission of the student persona on `assignmentId` with a comment thread |
| `lateSubmissionUserId`, `missingSubmissionUserId`, `excusedSubmissionUserId`, `multiAttemptSubmissionUserId`, `ungradedSubmissionUserId`, `needsRegradeSubmissionUserId`, `lateStatusOverrideUserId` | students with that state on `assignmentId` (the last one on HW 2) |
| `latePolicyId`, `latePolicyCourseIds` | late policies |
| `customGradebookColumnId`, `teacherNotesColumnId`, `hiddenGradebookColumnId` | custom gradebook columns with data |
| `rubricId`, `rubricAssociationId`, `rubricAssignmentId`, `rubricAssessmentId`, `rubricAssessmentUserId`, `paperRubricId`, `accountRubricId`, `accountRubricId2`, `unusedRubricId`, `deletedRubricId` | rubrics / associations / assessments |
| `outcomeId`, `outcomeId2`, `importedOutcomeId`, `outcomeGroupId`, `deepOutcomeGroupId`, `courseRootOutcomeGroupId`, `outcomeLinkId`, `courseOutcomeProficiencyId` | course outcomes (results exist) |
| `accountOutcomeId`, `accountOutcomeGroupId`, `accountDeepOutcomeGroupId`, `rootOutcomeGroupId`, `deletedOutcomeId`, `outcomeProficiencyId`, `proficiencyRatingId`, `outcomeImportId`, `importedOutcomeGroupVendorGuid` | account outcomes, mastery scale, CSV outcome import |
| `mediaObjectId` | a media object row (media id string; no media server behind it) |

Content (main course)

| Key | Points to |
| --- | --- |
| `moduleId`, `moduleItemId` (+`moduleItemAssignmentId`), `firstModuleId`, `sequentialModuleId`, `prerequisiteModuleId`, `unpublishedModuleId`, `scheduledModuleId`, `emptyModuleId`, `deletedModuleId`, `moduleProgressUserId` | modules |
| `pageModuleItemId`, `fileModuleItemId`, `quizModuleItemId`, `discussionModuleItemId`, `externalUrlModuleItemId`, `externalToolModuleItemId`, `subHeaderModuleItemId` | one module item per type |
| `pageUrl` (+`pageId`), `frontPageUrl` (+`frontPageId`), `unpublishedPageUrl`, `pageWithRevisionsUrl` (+`pageRevisionCount`), `longPageUrl`, `unicodePageUrl`, `duplicateTitlePageUrls`, `studentEditablePageUrl`, `deletedPageUrl`, `groupPageUrl` | pages (slugs) |
| `rootFolderId`, `folderId`, `deepFolderId` (+`deepFolderPath`), `hiddenFolderId`, `lockedFolderId`, `emptyFolderId`, `unicodeFolderId`, `bigFolderId` (120 files), `deletedFolderId`, `apiUploadFolderId` | folders |
| `fileId`, `pdfFileId`, `imageFileId`, `hiddenFileId`, `lockedFileId`, `deletedFileId`, `replacedFileId` -> `replacementFileId`, `usageRightsFileId`, `apiUploadedFileId` | files |
| `userFolderId`, `userRootFolderId`, `userFileId` (student persona), `groupFolderId`, `groupFileId` | user / group files |
| `quizId` (+`quizAssignmentId`, `quizQuestionId`), `allQuestionTypesQuizId`, `practiceQuizId`, `gradedSurveyQuizId`, `surveyQuizId`, `unpublishedQuizId`, `lockedQuizId`, `essayQuizId`, `inProgressQuizId`, `moderatedQuizId`, `deletedQuizId` | classic quizzes |
| `quizQuestionGroupId` (bank-linked, in `quizQuestionGroupQuizId`), `inlineQuizQuestionGroupId`, `questionBankId` | question groups / bank |
| `quizSubmissionId` (+`quizSubmissionUserId`, `quizSubmissionAttempt`), `pendingReviewQuizSubmissionId`, `inProgressQuizSubmissionId`, `quizExtensionUserId`, `quizExtensionUserIds`, `quizReportId` | quiz submissions, extensions, report |
| `discussionTopicId` (+`discussionEntryId`, `discussionReplyEntryId`, `nestedDiscussionEntryId`, `entryWithAttachmentId`, `editedDiscussionEntryId`, `deletedDiscussionEntryId`) | "Introduce Yourself" thread |
| `deepDiscussionTopicId` (+`deepDiscussionEntryId`, `deepDiscussionEntryDepth`), `ratedDiscussionTopicId` (+`ratedDiscussionEntryId`), `gradedDiscussionTopicId` (+`discussionAssignmentId`), `groupDiscussionTopicId` (+`groupChildDiscussionTopicId`), `ungradedGroupDiscussionTopicId`, `pinnedDiscussionTopicId`, `lockedDiscussionTopicId`, `delayedDiscussionTopicId`, `unpublishedDiscussionTopicId`, `sectionDiscussionTopicId`, `studentDiscussionTopicId`, `requireInitialPostTopicId`, `anonymousDiscussionTopicId`, `deletedDiscussionTopicId` | other discussion shapes |
| `announcementId`, `latestAnnouncementId`, `delayedAnnouncementId`, `sectionAnnouncementId`, `lockedAnnouncementId`, `announcementWithAttachmentId`, `externalFeedId` | announcements, external feed |

Collaboration and communication

| Key | Points to |
| --- | --- |
| `groupCategoryId` (Lab Teams), `selfSignupGroupCategoryId`, `restrictedGroupCategoryId`, `studentOrganizedGroupCategoryId`, `accountGroupCategoryId`, `sisGroupCategoryId` | group categories |
| `groupId`, `groupId2`, `studentGroupId` (+`groupMembershipId`), `inviteOnlyGroupId`, `requestToJoinGroupId`, `accountGroupId` | groups |
| `conversationId` (+`conversationMessageId`, `conversationParticipantUserIds`), `longConversationId` (60 messages), `groupConversationId`, `archivedConversationId`, `starredConversationId`, `teacherConversationCount` | conversations |
| `calendarEventId`, `sectionCalendarEventId`, `userCalendarEventId` (teacher), `studentCalendarEventId`, `adminCalendarEventId`, `groupCalendarEventId`, `seriesCalendarEventId` (+`calendarSeriesUuid`), `adminSeriesCalendarEventId` | calendar events |
| `appointmentGroupId`, `appointmentId` (reserved by the student persona: `reservationId`), `openAppointmentId`, `groupAppointmentGroupId`, `unpublishedAppointmentGroupId` | appointment groups |
| `plannerNoteId`, `plannerOverrideId` (admin); `studentPlannerNoteId`, `studentPlannerOverrideId`, `teacherPlannerNoteId`, `deletedPlannerNoteId` | planner |
| `bookmarkId` (admin), `teacherBookmarkId`, `studentBookmarkId` | bookmarks |
| `favoriteCourseId`, `favoriteGroupId` | favorites of admin / teacher / student (course) and student (group) |
| `ePortfolioId` (+`ePortfolioUserId`, `ePortfolioPageId`) (admin), `studentEPortfolioId`, `teacherEPortfolioId` | ePortfolios |
| `pollId`, `pollChoiceId`, `pollSessionId` (open), `closedPollSessionId`, `pollSubmissionId` (admin-owned); `teacherPollId`, `teacherPollSessionId` | polls |
| `contentExportId` (+`contentExportCourseId`, `contentExportProgressId`), `qtiContentExportId`, `selectiveContentExportId` | content exports |
| `contentMigrationId` (+`contentMigrationCourseId`, `progressId`, `migrationIssueId`), `pendingContentMigrationId` (`pre_processing`), `selectiveContentMigrationId` (`waiting_for_select`) | content migrations |
| `contentShareId` (sent by admin), `receivedContentShareId` (admin), `teacherContentShareId`, `teacherReceivedContentShareId` | content shares |
| `collaborationId`, `studentCollaborationId` | EtherPad collaborations (fake local plugin config) |
| `conferenceId`, `concludedConferenceId`, `conferenceType` | BigBlueButton conferences (fake local plugin config, never started) |

## Edge cases that are there on purpose

* **Names / ids**: CJK, Arabic and Hebrew (RTL), Cyrillic, Greek, Devanagari, Vietnamese,
  Turkish dotted I, emoji, a 254-character name, apostrophes (straight and curly), hyphens,
  particles ("van der Berg"), a mononym, "Jr." suffix with comma, ALL CAPS, lowercase, padded
  whitespace, HTML / SQL-injection look-alikes, the literal name "Null Undefined" with SIS id
  `null`; SIS ids containing spaces, `/ : ; , . + = % ' " < > &`, Unicode and leading zeros;
  usernames that are not e-mail addresses; ~3 % of users without any e-mail.
* **Users**: deleted, suspended, pre-registered, creation-pending, merged, test student;
  several logins (one on a SAML provider, one deleted); unconfirmed / retired / SMS channels;
  12 locales, 16 time zones, pronouns, avatars in different moderation states.
* **Courses**: unpublished (`created` and `claimed`), hard-concluded, soft-concluded by term
  or course dates, future-dated, deleted, public + self-enrollment, blueprint + children,
  SIS-managed, cross-listed sections, sections with their own dates, SIS ids with spaces / slashes.
* **Enrollments**: invited, creation_pending, inactive, completed, rejected, deleted;
  section-limited staff; one user in two sections; student who is also a TA elsewhere; custom
  roles; observers with and without a linked student; enrollment-level dates.
* **Assignments**: every submission type and grading type; 0, 0.5, 7.25 and 1,000,000
  points; no points; no dates at all; due far in the past / future / exactly at 00:00 UTC;
  locked, not yet unlocked; `only_visible_to_overrides`; unpublished with a past due date;
  duplicate titles; 250-character, emoji and HTML titles; a 100 KB description; allowed
  attempts; restricted extensions; post-to-SIS; important dates; deleted assignments.
* **Submissions**: unsubmitted, submitted, late (with late-policy deductions), missing
  (auto-graded 0 by the missing policy), excused, graded, graded over 100 %, graded 0 without a
  submission, resubmitted after grading, three attempts, explicit late-policy status
  overrides, custom grade status, text / URL / multi-file / media / LTI submissions; comments
  with files, media, drafts, group comments, hidden comments on unposted grades; grades
  hidden by anonymous grading or a manual post policy; provisional grades.
* **Grading periods**: quarter 1 of the current term has ended but is still open; the
  past-term trimesters are *closed* - teachers cannot change grades there (the API answers
  "Grade cannot be changed at this time").
* **Content**: unpublished / deleted / very long (400 KB) pages, seven pages titled some
  variant of "Study Guide", pages edited by students, 13 revisions on one page; files with
  spaces, Unicode, 240-character names, many dots, no extension, leading dot, the same name in
  seven folders, hidden / locked / scheduled files and folders, an overwritten file, a folder
  with 120 files; modules that are locked by prerequisites, sequential, scheduled, unpublished,
  empty, with unpublished items and the same item twice.
* **Quizzes**: all four quiz types, all twelve classic question types, question groups
  (inline and bank-linked), access code, IP filter, time limits, multiple attempts with
  keep-highest / keep-latest, attempts in `complete`, `pending_review`, `untaken` and
  `settings_only` (extension) states.
* **Discussions**: threaded / not threaded / side comments, pinned, closed, lock dates,
  delayed posting, section-specific, group discussions with child topics, anonymous, graded
  (incl. group + peer review), require-initial-post, liking, deleted and edited entries,
  attachments, a reply chain 10 levels deep, mixed read / unread state.
* **SIS**: import #3 deliberately contains unknown users / courses / sections / accounts /
  terms, invalid roles and statuses, missing ids, a login collision and an unknown CSV file;
  another upload is not a CSV at all.

## Not created, and why

* **New Quizzes** (`NewQuiz*` resources): served by Instructure's external Quizzes.Next
  service; not available in a local Canvas.
* **LTI 1.3 registrations, resource links, line items**: need an LTI 1.3 tool that performs
  the OIDC launch / AGS calls with its own client credentials.
* **Smart Search**: needs the embedding service.
* **Analytics** (`/analytics` endpoints): the analytics plugin is not part of open-source Canvas.
* **Course paces**: `pacedCourseId` has modules and assignments but no published pace
  (publishing rewrites due dates through a job; left for the pace tests to create).
* **Media**: there is no Kaltura; media objects / media comments are database rows only
  (`media_id` strings), nothing can be played or downloaded.
* **Conferences / collaborations** are created against a fake plugin configuration
  (BigBlueButton at `bbb.example.invalid`, EtherPad at `etherpad.example.com`). Listing,
  showing, updating and deleting work; *joining* a conference would call the fake host.
* **LDAP** authentication provider exists but is soft-deleted (an active LDAP provider is
  consulted on every password login and would add timeouts).

## Starting over

The seed does not delete anything. To start from scratch, recreate the Canvas database
(`../up.sh stop`, drop the `canvas_pg_data` volume, `../up.sh start`) and run `run.sh` again.
