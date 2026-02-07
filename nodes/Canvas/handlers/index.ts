import type { ResourceHandler } from '../types/Canvas.types';

// Courses group
import {
	buildCourseRequest,
	buildSectionRequest,
	buildTabRequest,
	buildCoursePaceRequest,
	buildCourseReportRequest,
} from './courses.handler';

// Users group
import {
	buildUserRequest,
	buildLoginRequest,
	buildCommunicationChannelRequest,
	buildUserObserveeRequest,
} from './users.handler';

// Enrollments group
import {
	buildEnrollmentRequest,
	buildEnrollmentTermRequest,
} from './enrollments.handler';

// Modules group
import {
	handleModuleResource,
	handleModuleItemResource,
	handlePageResource,
} from './modules.handler';

// Assignments group
import {
	handleAssignmentResource,
	handleAssignmentGroupResource,
	handleAssignmentExtensionResource,
} from './assignments.handler';

// Submissions group
import {
	handleSubmissionResource,
	handleSubmissionCommentResource,
	handlePeerReviewResource,
} from './submissions.handler';

// Grades group
import {
	handleCustomGradebookColumnResource,
	handleGradingPeriodResource,
	handleGradingPeriodSetResource,
	handleGradingStandardResource,
	handleLatePolicyResource,
	handleModeratedGradingResource,
} from './grades.handler';

// Files group
import {
	handleFileResource,
	handleFolderResource,
	handleMediaObjectResource,
} from './files.handler';

// Quizzes group
import {
	handleQuizResource,
	handleQuizQuestionResource,
	handleQuizQuestionGroupResource,
	handleQuizSubmissionResource,
	handleQuizReportResource,
	handleQuizStatisticsResource,
	handleQuizExtensionResource,
} from './quizzes.handler';

// New Quizzes group
import {
	buildNewQuizRequest,
	buildNewQuizItemRequest,
	buildNewQuizAccommodationsRequest,
	buildNewQuizReportRequest,
} from './newQuizzes.handler';

// Rubrics & Outcomes group
import {
	handleRubricResource,
	handleOutcomeResource,
	handleOutcomeGroupResource,
	handleOutcomeImportResource,
	handleOutcomeResultResource,
	handleProficiencyRatingResource,
} from './rubrics.handler';

// Discussions group
import {
	buildDiscussionTopicRequest,
	buildAnnouncementRequest,
	buildAnnouncementExternalFeedRequest,
} from './discussions.handler';

// Conversations group
import {
	buildConversationRequest,
	buildCommMessageRequest,
	buildNotificationPreferenceRequest,
} from './conversations.handler';

// Calendar group
import {
	buildCalendarEventRequest,
	buildAppointmentGroupRequest,
	buildBlackoutDateRequest,
} from './calendar.handler';

// Groups group
import {
	buildGroupRequest,
	buildGroupCategoryRequest,
	buildCollaborationRequest,
	buildConferenceRequest,
} from './groups.handler';

// Accounts group
import {
	buildAccountRequest,
	buildAccountReportRequest,
	buildAccountNotificationRequest,
	buildAccountCalendarRequest,
	buildAdminRequest,
	buildRoleRequest,
} from './accounts.handler';

// Auth group
import {
	buildAccessTokenRequest,
	buildApiTokenScopeRequest,
	buildAuthenticationProviderRequest,
	buildAuthenticationsLogRequest,
	buildDeveloperKeyRequest,
} from './auth.handler';

// LTI group
import {
	handleExternalToolResource,
	handleLineItemResource,
	handleLtiRegistrationResource,
	handleLtiResourceLinkResource,
} from './lti.handler';

// SIS group
import {
	buildSisImportRequest,
	buildSisImportErrorRequest,
	buildSisIntegrationRequest,
} from './sis.handler';

// Analytics group
import {
	handleAnalyticsResource,
	handleProgressResource,
	handleSearchResource,
	handleSmartSearchResource,
	handleHistoryResource,
} from './analytics.handler';

// Content group
import {
	handleContentExportResource,
	handleContentMigrationResource,
	handleContentShareResource,
	handleBlueprintCourseResource,
} from './content.handler';

// Misc group
import {
	buildBookmarkRequest,
	buildEPortfolioRequest,
	buildFavoriteRequest,
	buildFeatureFlagRequest,
	buildPlannerRequest,
	buildPollRequest,
} from './misc.handler';

/**
 * Maps every Canvas resource name to its handler function.
 * Each handler takes (operation, getParam, getParamObject) and returns IRequestConfig.
 */
export const resourceHandlers: Record<string, ResourceHandler> = {
	// Courses group
	course: buildCourseRequest,
	section: buildSectionRequest,
	tab: buildTabRequest,
	coursePace: buildCoursePaceRequest,
	courseReport: buildCourseReportRequest,

	// Users group
	user: buildUserRequest,
	login: buildLoginRequest,
	communicationChannel: buildCommunicationChannelRequest,
	userObservee: buildUserObserveeRequest,

	// Enrollments group
	enrollment: buildEnrollmentRequest,
	enrollmentTerm: buildEnrollmentTermRequest,

	// Modules group
	module: handleModuleResource,
	moduleItem: handleModuleItemResource,
	page: handlePageResource,

	// Assignments group
	assignment: handleAssignmentResource,
	assignmentGroup: handleAssignmentGroupResource,
	assignmentExtension: handleAssignmentExtensionResource,

	// Submissions group
	submission: handleSubmissionResource,
	submissionComment: handleSubmissionCommentResource,
	peerReview: handlePeerReviewResource,

	// Grades group
	customGradebookColumn: handleCustomGradebookColumnResource,
	gradingPeriod: handleGradingPeriodResource,
	gradingPeriodSet: handleGradingPeriodSetResource,
	gradingStandard: handleGradingStandardResource,
	latePolicy: handleLatePolicyResource,
	moderatedGrading: handleModeratedGradingResource,

	// Files group
	file: handleFileResource,
	folder: handleFolderResource,
	mediaObject: handleMediaObjectResource,

	// Quizzes group
	quiz: handleQuizResource,
	quizQuestion: handleQuizQuestionResource,
	quizQuestionGroup: handleQuizQuestionGroupResource,
	quizSubmission: handleQuizSubmissionResource,
	quizReport: handleQuizReportResource,
	quizStatistics: handleQuizStatisticsResource,
	quizExtension: handleQuizExtensionResource,

	// New Quizzes group
	newQuiz: buildNewQuizRequest,
	newQuizItem: buildNewQuizItemRequest,
	newQuizAccommodations: buildNewQuizAccommodationsRequest,
	newQuizReport: buildNewQuizReportRequest,

	// Rubrics & Outcomes group
	rubric: handleRubricResource,
	outcome: handleOutcomeResource,
	outcomeGroup: handleOutcomeGroupResource,
	outcomeImport: handleOutcomeImportResource,
	outcomeResult: handleOutcomeResultResource,
	proficiencyRating: handleProficiencyRatingResource,

	// Discussions group
	discussionTopic: buildDiscussionTopicRequest,
	announcement: buildAnnouncementRequest,
	announcementExternalFeed: buildAnnouncementExternalFeedRequest,

	// Conversations group
	conversation: buildConversationRequest,
	commMessage: buildCommMessageRequest,
	notificationPreference: buildNotificationPreferenceRequest,

	// Calendar group
	calendarEvent: buildCalendarEventRequest,
	appointmentGroup: buildAppointmentGroupRequest,
	blackoutDate: buildBlackoutDateRequest,

	// Groups group
	group: buildGroupRequest,
	groupCategory: buildGroupCategoryRequest,
	collaboration: buildCollaborationRequest,
	conference: buildConferenceRequest,

	// Accounts group
	account: buildAccountRequest,
	accountReport: buildAccountReportRequest,
	accountNotification: buildAccountNotificationRequest,
	accountCalendar: buildAccountCalendarRequest,
	admin: buildAdminRequest,
	role: buildRoleRequest,

	// Auth group
	accessToken: buildAccessTokenRequest,
	apiTokenScope: buildApiTokenScopeRequest,
	authenticationProvider: buildAuthenticationProviderRequest,
	authenticationsLog: buildAuthenticationsLogRequest,
	developerKey: buildDeveloperKeyRequest,

	// LTI group
	externalTool: handleExternalToolResource,
	lineItem: handleLineItemResource,
	ltiRegistration: handleLtiRegistrationResource,
	ltiResourceLink: handleLtiResourceLinkResource,

	// SIS group
	sisImport: buildSisImportRequest,
	sisImportError: buildSisImportErrorRequest,
	sisIntegration: buildSisIntegrationRequest,

	// Analytics group
	analytics: handleAnalyticsResource,
	progress: handleProgressResource,
	search: handleSearchResource,
	smartSearch: handleSmartSearchResource,
	history: handleHistoryResource,

	// Content group
	contentExport: handleContentExportResource,
	contentMigration: handleContentMigrationResource,
	contentShare: handleContentShareResource,
	blueprintCourse: handleBlueprintCourseResource,

	// Misc group
	bookmark: buildBookmarkRequest,
	ePortfolio: buildEPortfolioRequest,
	favorite: buildFavoriteRequest,
	featureFlag: buildFeatureFlagRequest,
	planner: buildPlannerRequest,
	poll: buildPollRequest,
};
