import type { IDataObject, IHttpRequestMethods } from 'n8n-workflow';

/**
 * Request configuration returned by resource handlers.
 * Uses Record<string, unknown> for body/qs since handlers build objects
 * that TypeScript cannot narrow to IDataObject at compile time.
 */
export interface IRequestConfig {
	endpoint: string;
	method: IHttpRequestMethods;
	body?: Record<string, unknown>;
	qs?: Record<string, unknown>;
}

/**
 * Helper function type for getting a single string parameter
 */
export type GetParam = (name: string, defaultValue?: string) => string;

/**
 * Helper function type for getting a collection/object parameter
 */
export type GetParamObject = (name: string) => Record<string, unknown>;

/**
 * Resource handler function signature
 */
export type ResourceHandler = (
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
) => IRequestConfig;

/**
 * Rate limit configuration options
 */
export interface IRateLimitOptions {
	/** Whether rate limit checking is enabled (default: true) */
	enabled: boolean;
	/** Minimum X-Rate-Limit-Remaining before proceeding (default: 300) */
	threshold: number;
	/** Maximum retries when rate limited or below threshold (default: 5) */
	maxRetries: number;
	/** Base delay in ms for exponential backoff (default: 2000) */
	baseDelayMs: number;
	/** Maximum delay cap in ms (default: 60000) */
	maxDelayMs: number;
}

/**
 * Pagination configuration options
 */
export interface IPaginationOptions {
	/** Whether pagination is enabled (default: true) */
	enabled: boolean;
	/** Items per page (default: 10, Canvas max: 100) */
	perPage: number;
	/** Maximum pages to fetch (default: 5, 0 = unlimited) */
	maxPages: number;
}

/**
 * Error handling mode options
 */
export type ErrorHandlingMode =
	| 'stop' // Stop workflow on first error
	| 'continueWithError' // Output to error branch, continue processing
	| 'ignoreAndContinue' // Skip failed items silently
	| 'retryThenError'; // Retry with backoff, then error branch

/**
 * Error handling configuration options
 */
export interface IErrorHandlingOptions {
	/** How to handle errors */
	onError: ErrorHandlingMode;
	/** Max retries for retryThenError mode (default: 3) */
	maxRetries: number;
}

/**
 * Batch processing configuration options
 */
export interface IBatchOptions {
	/** Processing mode: 'batch' or 'individual' */
	mode: 'batch' | 'individual';
	/** Items per batch when in batch mode (default: 10) */
	batchSize: number;
	/** Delay between batches in ms (default: 1000) */
	batchDelay: number;
}

/**
 * Canvas API error categories
 */
export type CanvasErrorType =
	| 'UNAUTHORIZED' // 401
	| 'FORBIDDEN' // 403
	| 'NOT_FOUND' // 404
	| 'VALIDATION_ERROR' // 422
	| 'RATE_LIMITED' // 429
	| 'SERVER_ERROR' // 500+
	| 'UNKNOWN'; // Other

/**
 * Structured error output for error branch
 */
export interface ICanvasErrorOutput {
	error: true;
	errorCode: number;
	errorType: CanvasErrorType;
	errorMessage: string;
	canvasErrorCode?: string;
	originalItem: IDataObject;
	resource: string;
	operation: string;
	endpoint: string;
	timestamp: string;
}

/**
 * Rate limit status from Canvas API headers
 */
export interface IRateLimitStatus {
	remaining: number;
	cost?: number;
}

/**
 * Parsed Link header for pagination
 */
export interface IParsedLinkHeader {
	current?: string;
	next?: string;
	prev?: string;
	first?: string;
	last?: string;
}

/**
 * Canvas API request options
 */
export interface ICanvasRequestOptions {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	endpoint: string;
	body?: IDataObject;
	query?: IDataObject;
	/** Additional include[] parameters */
	include?: string[];
}

/**
 * Canvas API response with headers
 */
export interface ICanvasResponse<T = IDataObject | IDataObject[]> {
	data: T;
	rateLimitStatus: IRateLimitStatus;
	linkHeader: IParsedLinkHeader;
}

/**
 * Result of paginated request
 */
export interface IPaginatedResult<T = IDataObject> {
	items: T[];
	totalPages: number;
	rateLimitStatus: IRateLimitStatus;
}

/**
 * Canvas resource categories for mega-node
 */
export type CanvasResource =
	// Account & Admin
	| 'accessToken'
	| 'account'
	| 'accountCalendar'
	| 'accountDomainLookup'
	| 'accountNotification'
	| 'accountReport'
	| 'admin'
	| 'apiTokenScope'
	| 'brandConfig'
	| 'role'
	| 'sandbox'
	| 'service'
	// Users & Identity
	| 'user'
	| 'login'
	| 'authenticationProvider'
	| 'authenticationsLog'
	| 'communicationChannel'
	| 'userObservee'
	| 'temporaryEnrollmentPairing'
	// Courses & Structure
	| 'course'
	| 'section'
	| 'coursePace'
	| 'courseAuditLog'
	| 'courseReport'
	| 'tab'
	| 'module'
	| 'moduleItem'
	| 'page'
	| 'favorite'
	| 'blueprintCourse'
	| 'contentExport'
	| 'contentMigration'
	// Enrollments & Groups
	| 'enrollment'
	| 'enrollmentTerm'
	| 'group'
	| 'groupCategory'
	| 'contentShare'
	// Assignments & Grading
	| 'assignment'
	| 'assignmentExtension'
	| 'assignmentGroup'
	| 'submission'
	| 'submissionComment'
	| 'customGradebookColumn'
	| 'gradeChangeLog'
	| 'gradebookHistory'
	| 'gradingPeriod'
	| 'gradingPeriodSet'
	| 'gradingStandard'
	| 'latePolicy'
	| 'moderatedGrading'
	| 'peerReview'
	// Quizzes
	| 'quiz'
	| 'quizQuestion'
	| 'quizQuestionGroup'
	| 'quizSubmission'
	| 'quizReport'
	| 'quizStatistics'
	| 'quizExtension'
	| 'newQuiz'
	| 'newQuizItem'
	// Rubrics & Outcomes
	| 'rubric'
	| 'outcome'
	| 'outcomeGroup'
	| 'outcomeImport'
	| 'outcomeResult'
	| 'proficiencyRating'
	| 'originalityReport'
	// Calendar
	| 'calendarEvent'
	| 'appointmentGroup'
	| 'blackoutDate'
	// Communication
	| 'announcement'
	| 'announcementExternalFeed'
	| 'conversation'
	| 'notificationPreference'
	// Discussions & Collaboration
	| 'discussionTopic'
	| 'conference'
	| 'collaboration'
	// Files & Media
	| 'file'
	| 'folder'
	| 'mediaObject'
	| 'ePortfolio'
	// LTI & External Tools
	| 'externalTool'
	| 'developerKey'
	| 'ltiRegistration'
	// Analytics & Reporting
	| 'analytics'
	| 'progress'
	| 'search'
	// SIS
	| 'sisImport'
	// Other
	| 'featureFlag'
	| 'planner'
	| 'bookmark';

/**
 * Common Canvas API operations
 */
export type CanvasOperation =
	| 'create'
	| 'get'
	| 'getAll'
	| 'update'
	| 'delete'
	| 'list'
	// Specialized operations
	| 'enroll'
	| 'conclude'
	| 'copy'
	| 'grade'
	| 'submit'
	| 'upload';
