import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeConnectionTypes, ApplicationError } from 'n8n-workflow';

import {
	canvasApiRequest,
	canvasApiRequestAllItems,
	executeWithErrorHandling,
	DEFAULT_RATE_LIMIT_OPTIONS,
	DEFAULT_PAGINATION_OPTIONS,
	DEFAULT_ERROR_HANDLING_OPTIONS,
	sleep,
} from './GenericFunctions';

import type {
	IRateLimitOptions,
	IPaginationOptions,
	IErrorHandlingOptions,
	IBatchOptions,
	ICanvasErrorOutput,
} from './types/Canvas.types';

// Import all resource descriptions
import {
	// Accounts group
	accountOperations,
	accountFields,
	accountReportOperations,
	accountReportFields,
	accountNotificationOperations,
	accountNotificationFields,
	accountCalendarOperations,
	accountCalendarFields,
	adminOperations,
	adminFields,
	roleOperations,
	roleFields,
	// Analytics group
	analyticsOperations,
	analyticsFields,
	progressOperations,
	progressFields,
	searchOperations,
	searchFields,
	smartSearchOperations,
	smartSearchFields,
	historyOperations,
	historyFields,
	// Assignments group
	assignmentOperations,
	assignmentFields,
	assignmentGroupOperations,
	assignmentGroupFields,
	assignmentExtensionOperations,
	assignmentExtensionFields,
	// Auth group
	accessTokenOperations,
	accessTokenFields,
	apiTokenScopeOperations,
	apiTokenScopeFields,
	authenticationProviderOperations,
	authenticationProviderFields,
	authenticationsLogOperations,
	authenticationsLogFields,
	developerKeyOperations,
	developerKeyFields,
	// Calendar group
	calendarEventOperations,
	calendarEventFields,
	appointmentGroupOperations,
	appointmentGroupFields,
	blackoutDateOperations,
	blackoutDateFields,
	// Content Management group
	contentExportOperations,
	contentExportFields,
	contentMigrationOperations,
	contentMigrationFields,
	contentShareOperations,
	contentShareFields,
	blueprintCourseOperations,
	blueprintCourseFields,
	// Conversations group
	conversationOperations,
	conversationFields,
	commMessageOperations,
	commMessageFields,
	notificationPreferenceOperations,
	notificationPreferenceFields,
	// Courses group
	courseOperations,
	courseFields,
	sectionOperations,
	sectionFields,
	tabOperations,
	tabFields,
	coursePaceOperations,
	coursePaceFields,
	courseReportOperations,
	courseReportFields,
	// Discussions group
	discussionTopicOperations,
	discussionTopicFields,
	announcementOperations,
	announcementFields,
	announcementExternalFeedOperations,
	announcementExternalFeedFields,
	// Enrollments group
	enrollmentOperations,
	enrollmentFields,
	enrollmentTermOperations,
	enrollmentTermFields,
	// Files group
	fileOperations,
	fileFields,
	folderOperations,
	folderFields,
	mediaObjectOperations,
	mediaObjectFields,
	// Grades group
	customGradebookColumnOperations,
	customGradebookColumnFields,
	gradingPeriodOperations,
	gradingPeriodFields,
	gradingPeriodSetOperations,
	gradingPeriodSetFields,
	gradingStandardOperations,
	gradingStandardFields,
	latePolicyOperations,
	latePolicyFields,
	moderatedGradingOperations,
	moderatedGradingFields,
	// Groups group
	groupOperations,
	groupFields,
	groupCategoryOperations,
	groupCategoryFields,
	collaborationOperations,
	collaborationFields,
	conferenceOperations,
	conferenceFields,
	// LTI group
	externalToolOperations,
	externalToolFields,
	lineItemOperations,
	lineItemFields,
	ltiRegistrationOperations,
	ltiRegistrationFields,
	ltiResourceLinkOperations,
	ltiResourceLinkFields,
	// Misc group
	bookmarkOperations,
	bookmarkFields,
	ePortfolioOperations,
	ePortfolioFields,
	favoriteOperations,
	favoriteFields,
	featureFlagOperations,
	featureFlagFields,
	plannerOperations,
	plannerFields,
	pollOperations,
	pollFields,
	// Modules group
	moduleOperations,
	moduleFields,
	moduleItemOperations,
	moduleItemFields,
	pageOperations,
	pageFields,
	// Classic Quizzes group
	quizOperations,
	quizFields,
	quizQuestionOperations,
	quizQuestionFields,
	quizQuestionGroupOperations,
	quizQuestionGroupFields,
	quizSubmissionOperations,
	quizSubmissionFields,
	quizReportOperations,
	quizReportFields,
	quizStatisticsOperations,
	quizStatisticsFields,
	quizExtensionOperations,
	quizExtensionFields,
	// New Quizzes group
	newQuizOperations,
	newQuizFields,
	newQuizItemOperations,
	newQuizItemFields,
	newQuizAccommodationsOperations,
	newQuizAccommodationsFields,
	newQuizReportOperations,
	newQuizReportFields,
	// Rubrics & Outcomes group
	rubricOperations,
	rubricFields,
	outcomeOperations,
	outcomeFields,
	outcomeGroupOperations,
	outcomeGroupFields,
	outcomeImportOperations,
	outcomeImportFields,
	outcomeResultOperations,
	outcomeResultFields,
	proficiencyRatingOperations,
	proficiencyRatingFields,
	// SIS group
	sisImportOperations,
	sisImportFields,
	sisImportErrorOperations,
	sisImportErrorFields,
	sisIntegrationOperations,
	sisIntegrationFields,
	// Submissions group
	submissionOperations,
	submissionFields,
	submissionCommentOperations,
	submissionCommentFields,
	peerReviewOperations,
	peerReviewFields,
	// Users group
	userOperations,
	userFields,
	loginOperations,
	loginFields,
	communicationChannelOperations,
	communicationChannelFields,
	userObserveeOperations,
	userObserveeFields,
} from './descriptions';

export class Canvas implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Canvas LMS',
		name: 'canvas',
		icon: 'file:../../icons/canvas.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Canvas LMS API - Full coverage of 92 resources',
		defaults: {
			name: 'Canvas LMS',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main, NodeConnectionTypes.Main],
		outputNames: ['Success', 'Error'],
		credentials: [
			{
				name: 'canvasApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['accessToken'],
					},
				},
			},
			{
				name: 'canvasOAuth2Api',
				required: true,
				displayOptions: {
					show: {
						authentication: ['oAuth2'],
					},
				},
			},
		],
		properties: [
			// Authentication
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'Access Token',
						value: 'accessToken',
					},
					{
						name: 'OAuth2',
						value: 'oAuth2',
					},
				],
				default: 'accessToken',
			},

			// Resource Selection (alphabetized)
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Access Token', value: 'accessToken' },
					{ name: 'Account', value: 'account' },
					{ name: 'Account Calendar', value: 'accountCalendar' },
					{ name: 'Account Notification', value: 'accountNotification' },
					{ name: 'Account Report', value: 'accountReport' },
					{ name: 'Admin', value: 'admin' },
					{ name: 'Analytics', value: 'analytics' },
					{ name: 'Announcement', value: 'announcement' },
					{ name: 'Announcement External Feed', value: 'announcementExternalFeed' },
					{ name: 'API Token Scope', value: 'apiTokenScope' },
					{ name: 'Appointment Group', value: 'appointmentGroup' },
					{ name: 'Assignment', value: 'assignment' },
					{ name: 'Assignment Extension', value: 'assignmentExtension' },
					{ name: 'Assignment Group', value: 'assignmentGroup' },
					{ name: 'Authentication Provider', value: 'authenticationProvider' },
					{ name: 'Authentications Log', value: 'authenticationsLog' },
					{ name: 'Blackout Date', value: 'blackoutDate' },
					{ name: 'Blueprint Course', value: 'blueprintCourse' },
					{ name: 'Bookmark', value: 'bookmark' },
					{ name: 'Calendar Event', value: 'calendarEvent' },
					{ name: 'Collaboration', value: 'collaboration' },
					{ name: 'Comm Message', value: 'commMessage' },
					{ name: 'Communication Channel', value: 'communicationChannel' },
					{ name: 'Conference', value: 'conference' },
					{ name: 'Content Export', value: 'contentExport' },
					{ name: 'Content Migration', value: 'contentMigration' },
					{ name: 'Content Share', value: 'contentShare' },
					{ name: 'Conversation', value: 'conversation' },
					{ name: 'Course', value: 'course' },
					{ name: 'Course Pace', value: 'coursePace' },
					{ name: 'Course Report', value: 'courseReport' },
					{ name: 'Custom Gradebook Column', value: 'customGradebookColumn' },
					{ name: 'Developer Key', value: 'developerKey' },
					{ name: 'Discussion Topic', value: 'discussionTopic' },
					{ name: 'Enrollment', value: 'enrollment' },
					{ name: 'Enrollment Term', value: 'enrollmentTerm' },
					{ name: 'ePortfolio', value: 'ePortfolio' },
					{ name: 'External Tool', value: 'externalTool' },
					{ name: 'Favorite', value: 'favorite' },
					{ name: 'Feature Flag', value: 'featureFlag' },
					{ name: 'File', value: 'file' },
					{ name: 'Folder', value: 'folder' },
					{ name: 'Grading Period', value: 'gradingPeriod' },
					{ name: 'Grading Period Set', value: 'gradingPeriodSet' },
					{ name: 'Grading Standard', value: 'gradingStandard' },
					{ name: 'Group', value: 'group' },
					{ name: 'Group Category', value: 'groupCategory' },
					{ name: 'History', value: 'history' },
					{ name: 'Late Policy', value: 'latePolicy' },
					{ name: 'Line Item', value: 'lineItem' },
					{ name: 'Login', value: 'login' },
					{ name: 'LTI Registration', value: 'ltiRegistration' },
					{ name: 'LTI Resource Link', value: 'ltiResourceLink' },
					{ name: 'Media Object', value: 'mediaObject' },
					{ name: 'Moderated Grading', value: 'moderatedGrading' },
					{ name: 'Module', value: 'module' },
					{ name: 'Module Item', value: 'moduleItem' },
					{ name: 'New Quiz', value: 'newQuiz' },
					{ name: 'New Quiz Accommodation', value: 'newQuizAccommodations' },
					{ name: 'New Quiz Item', value: 'newQuizItem' },
					{ name: 'New Quiz Report', value: 'newQuizReport' },
					{ name: 'Notification Preference', value: 'notificationPreference' },
					{ name: 'Outcome', value: 'outcome' },
					{ name: 'Outcome Group', value: 'outcomeGroup' },
					{ name: 'Outcome Import', value: 'outcomeImport' },
					{ name: 'Outcome Result', value: 'outcomeResult' },
					{ name: 'Page', value: 'page' },
					{ name: 'Peer Review', value: 'peerReview' },
					{ name: 'Planner', value: 'planner' },
					{ name: 'Poll', value: 'poll' },
					{ name: 'Proficiency Rating', value: 'proficiencyRating' },
					{ name: 'Progress', value: 'progress' },
					{ name: 'Quiz', value: 'quiz' },
					{ name: 'Quiz Extension', value: 'quizExtension' },
					{ name: 'Quiz Question', value: 'quizQuestion' },
					{ name: 'Quiz Question Group', value: 'quizQuestionGroup' },
					{ name: 'Quiz Report', value: 'quizReport' },
					{ name: 'Quiz Statistic', value: 'quizStatistics' },
					{ name: 'Quiz Submission', value: 'quizSubmission' },
					{ name: 'Role', value: 'role' },
					{ name: 'Rubric', value: 'rubric' },
					{ name: 'Search', value: 'search' },
					{ name: 'Section', value: 'section' },
					{ name: 'SIS Import', value: 'sisImport' },
					{ name: 'SIS Import Error', value: 'sisImportError' },
					{ name: 'SIS Integration', value: 'sisIntegration' },
					{ name: 'Smart Search', value: 'smartSearch' },
					{ name: 'Submission', value: 'submission' },
					{ name: 'Submission Comment', value: 'submissionComment' },
					{ name: 'Tab', value: 'tab' },
					{ name: 'User', value: 'user' },
					{ name: 'User Observee', value: 'userObservee' },
				],
				default: 'course',
			},

			// All Operations (spread from description files)
			...accessTokenOperations,
			...accountOperations,
			...accountCalendarOperations,
			...accountNotificationOperations,
			...accountReportOperations,
			...adminOperations,
			...analyticsOperations,
			...announcementOperations,
			...announcementExternalFeedOperations,
			...apiTokenScopeOperations,
			...appointmentGroupOperations,
			...assignmentOperations,
			...assignmentExtensionOperations,
			...assignmentGroupOperations,
			...authenticationProviderOperations,
			...authenticationsLogOperations,
			...blackoutDateOperations,
			...blueprintCourseOperations,
			...bookmarkOperations,
			...calendarEventOperations,
			...collaborationOperations,
			...commMessageOperations,
			...communicationChannelOperations,
			...conferenceOperations,
			...contentExportOperations,
			...contentMigrationOperations,
			...contentShareOperations,
			...conversationOperations,
			...courseOperations,
			...coursePaceOperations,
			...courseReportOperations,
			...customGradebookColumnOperations,
			...developerKeyOperations,
			...discussionTopicOperations,
			...enrollmentOperations,
			...enrollmentTermOperations,
			...ePortfolioOperations,
			...externalToolOperations,
			...favoriteOperations,
			...featureFlagOperations,
			...fileOperations,
			...folderOperations,
			...gradingPeriodOperations,
			...gradingPeriodSetOperations,
			...gradingStandardOperations,
			...groupOperations,
			...groupCategoryOperations,
			...historyOperations,
			...latePolicyOperations,
			...lineItemOperations,
			...loginOperations,
			...ltiRegistrationOperations,
			...ltiResourceLinkOperations,
			...mediaObjectOperations,
			...moderatedGradingOperations,
			...moduleOperations,
			...moduleItemOperations,
			...newQuizOperations,
			...newQuizAccommodationsOperations,
			...newQuizItemOperations,
			...newQuizReportOperations,
			...notificationPreferenceOperations,
			...outcomeOperations,
			...outcomeGroupOperations,
			...outcomeImportOperations,
			...outcomeResultOperations,
			...pageOperations,
			...peerReviewOperations,
			...plannerOperations,
			...pollOperations,
			...proficiencyRatingOperations,
			...progressOperations,
			...quizOperations,
			...quizExtensionOperations,
			...quizQuestionOperations,
			...quizQuestionGroupOperations,
			...quizReportOperations,
			...quizStatisticsOperations,
			...quizSubmissionOperations,
			...roleOperations,
			...rubricOperations,
			...searchOperations,
			...sectionOperations,
			...sisImportOperations,
			...sisImportErrorOperations,
			...sisIntegrationOperations,
			...smartSearchOperations,
			...submissionOperations,
			...submissionCommentOperations,
			...tabOperations,
			...userOperations,
			...userObserveeOperations,

			// All Fields (spread from description files)
			...accessTokenFields,
			...accountFields,
			...accountCalendarFields,
			...accountNotificationFields,
			...accountReportFields,
			...adminFields,
			...analyticsFields,
			...announcementFields,
			...announcementExternalFeedFields,
			...apiTokenScopeFields,
			...appointmentGroupFields,
			...assignmentFields,
			...assignmentExtensionFields,
			...assignmentGroupFields,
			...authenticationProviderFields,
			...authenticationsLogFields,
			...blackoutDateFields,
			...blueprintCourseFields,
			...bookmarkFields,
			...calendarEventFields,
			...collaborationFields,
			...commMessageFields,
			...communicationChannelFields,
			...conferenceFields,
			...contentExportFields,
			...contentMigrationFields,
			...contentShareFields,
			...conversationFields,
			...courseFields,
			...coursePaceFields,
			...courseReportFields,
			...customGradebookColumnFields,
			...developerKeyFields,
			...discussionTopicFields,
			...enrollmentFields,
			...enrollmentTermFields,
			...ePortfolioFields,
			...externalToolFields,
			...favoriteFields,
			...featureFlagFields,
			...fileFields,
			...folderFields,
			...gradingPeriodFields,
			...gradingPeriodSetFields,
			...gradingStandardFields,
			...groupFields,
			...groupCategoryFields,
			...historyFields,
			...latePolicyFields,
			...lineItemFields,
			...loginFields,
			...ltiRegistrationFields,
			...ltiResourceLinkFields,
			...mediaObjectFields,
			...moderatedGradingFields,
			...moduleFields,
			...moduleItemFields,
			...newQuizFields,
			...newQuizAccommodationsFields,
			...newQuizItemFields,
			...newQuizReportFields,
			...notificationPreferenceFields,
			...outcomeFields,
			...outcomeGroupFields,
			...outcomeImportFields,
			...outcomeResultFields,
			...pageFields,
			...peerReviewFields,
			...plannerFields,
			...pollFields,
			...proficiencyRatingFields,
			...progressFields,
			...quizFields,
			...quizExtensionFields,
			...quizQuestionFields,
			...quizQuestionGroupFields,
			...quizReportFields,
			...quizStatisticsFields,
			...quizSubmissionFields,
			...roleFields,
			...rubricFields,
			...searchFields,
			...sectionFields,
			...sisImportFields,
			...sisImportErrorFields,
			...sisIntegrationFields,
			...smartSearchFields,
			...submissionFields,
			...submissionCommentFields,
			...tabFields,
			...userFields,
			...userObserveeFields,

			// Error Handling Options
			{
				displayName: 'Error Handling',
				name: 'errorHandling',
				type: 'collection',
				placeholder: 'Add Error Handling Option',
				default: {},
				options: [
					{
						displayName: 'On Error',
						name: 'onError',
						type: 'options',
						options: [
							{
								name: 'Stop Workflow',
								value: 'stop',
								description: 'Stop the workflow on the first error',
							},
							{
								name: 'Continue & Output Error',
								value: 'continueWithError',
								description: 'Continue processing and output errors to the Error branch',
							},
							{
								name: 'Ignore & Continue',
								value: 'ignoreAndContinue',
								description: 'Skip failed items silently and continue',
							},
							{
								name: 'Retry Then Error',
								value: 'retryThenError',
								description: 'Retry with backoff, then output to Error branch',
							},
						],
						default: 'stop',
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						type: 'number',
						default: 3,
						description: 'Maximum retries for "Retry Then Error" mode',
						displayOptions: {
							show: {
								onError: ['retryThenError'],
							},
						},
					},
				],
			},

			// Pagination Options
			{
				displayName: 'Pagination',
				name: 'pagination',
				type: 'collection',
				placeholder: 'Add Pagination Option',
				default: {},
				options: [
					{
						displayName: 'Items Per Page',
						name: 'perPage',
						type: 'number',
						default: 10,
						description: 'Number of items per page (max 100)',
						typeOptions: {
							minValue: 1,
							maxValue: 100,
						},
					},
					{
						displayName: 'Max Pages',
						name: 'maxPages',
						type: 'number',
						default: 5,
						description: 'Maximum pages to fetch (0 = unlimited)',
						typeOptions: {
							minValue: 0,
						},
					},
					{
						displayName: 'Return All',
						name: 'returnAll',
						type: 'boolean',
						default: false,
						description: 'Whether to return all results or only up to a given limit',
					},
				],
			},

			// Rate Limit Options
			{
				displayName: 'Rate Limiting',
				name: 'rateLimiting',
				type: 'collection',
				placeholder: 'Add Rate Limit Option',
				default: {},
				options: [
					{
						displayName: 'Enable Rate Limit Check',
						name: 'enabled',
						type: 'boolean',
						default: true,
						description: 'Whether to check rate limits before each request',
					},
					{
						displayName: 'Threshold',
						name: 'threshold',
						type: 'number',
						default: 300,
						description: 'Minimum X-Rate-Limit-Remaining before proceeding',
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						type: 'number',
						default: 5,
						description: 'Maximum retries when rate limited',
					},
				],
			},

			// Batch Processing Options
			{
				displayName: 'Batch Processing',
				name: 'batchProcessing',
				type: 'collection',
				placeholder: 'Add Batch Option',
				default: {},
				options: [
					{
						displayName: 'Processing Mode',
						name: 'mode',
						type: 'options',
						options: [
							{
								name: 'Batch (Recommended)',
								value: 'batch',
								description: 'Group API calls for efficiency',
							},
							{
								name: 'Individual',
								value: 'individual',
								description: 'One API call per item',
							},
						],
						default: 'batch',
					},
					{
						displayName: 'Batch Size',
						name: 'batchSize',
						type: 'number',
						default: 10,
						description: 'Items per batch (for batch mode)',
						displayOptions: {
							show: {
								mode: ['batch'],
							},
						},
					},
					{
						displayName: 'Delay Between Batches (Ms)',
						name: 'batchDelay',
						type: 'number',
						default: 1000,
						description: 'Milliseconds to wait between batches',
						displayOptions: {
							show: {
								mode: ['batch'],
							},
						},
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const successItems: INodeExecutionData[] = [];
		const errorItems: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Get options
		const errorHandlingRaw = this.getNodeParameter('errorHandling', 0, {}) as IDataObject;
		const errorHandling: IErrorHandlingOptions = {
			onError: (errorHandlingRaw.onError as IErrorHandlingOptions['onError']) || DEFAULT_ERROR_HANDLING_OPTIONS.onError,
			maxRetries: (errorHandlingRaw.maxRetries as number) || DEFAULT_ERROR_HANDLING_OPTIONS.maxRetries,
		};

		const paginationRaw = this.getNodeParameter('pagination', 0, {}) as IDataObject;
		const pagination: IPaginationOptions = {
			enabled: true,
			perPage: (paginationRaw.perPage as number) || DEFAULT_PAGINATION_OPTIONS.perPage,
			maxPages: paginationRaw.returnAll ? 0 : ((paginationRaw.maxPages as number) ?? DEFAULT_PAGINATION_OPTIONS.maxPages),
		};

		const rateLimitRaw = this.getNodeParameter('rateLimiting', 0, {}) as IDataObject;
		const rateLimit: IRateLimitOptions = {
			enabled: rateLimitRaw.enabled !== false,
			threshold: (rateLimitRaw.threshold as number) || DEFAULT_RATE_LIMIT_OPTIONS.threshold,
			maxRetries: (rateLimitRaw.maxRetries as number) || DEFAULT_RATE_LIMIT_OPTIONS.maxRetries,
			baseDelayMs: DEFAULT_RATE_LIMIT_OPTIONS.baseDelayMs,
			maxDelayMs: DEFAULT_RATE_LIMIT_OPTIONS.maxDelayMs,
		};

		const batchRaw = this.getNodeParameter('batchProcessing', 0, {}) as IDataObject;
		const batch: IBatchOptions = {
			mode: (batchRaw.mode as IBatchOptions['mode']) || 'batch',
			batchSize: (batchRaw.batchSize as number) || 10,
			batchDelay: (batchRaw.batchDelay as number) || 1000,
		};

		// Process items
		if (batch.mode === 'batch') {
			for (let i = 0; i < items.length; i += batch.batchSize) {
				const batchItems = items.slice(i, i + batch.batchSize);

				const results = await Promise.all(
					batchItems.map(async (item, batchIndex) => {
						const itemIndex = i + batchIndex;
						return processItem(
							this,
							item,
							itemIndex,
							resource,
							operation,
							errorHandling,
							pagination,
							rateLimit,
						);
					}),
				);

				for (const result of results) {
					if (result.success) {
						successItems.push(...result.items);
					} else if (result.error) {
						errorItems.push({ json: result.error as unknown as IDataObject });
					}
				}

				if (i + batch.batchSize < items.length) {
					await sleep(batch.batchDelay);
				}
			}
		} else {
			for (let i = 0; i < items.length; i++) {
				const result = await processItem(
					this,
					items[i],
					i,
					resource,
					operation,
					errorHandling,
					pagination,
					rateLimit,
				);

				if (result.success) {
					successItems.push(...result.items);
				} else if (result.error) {
					errorItems.push({ json: result.error as unknown as IDataObject });
				}
			}
		}

		return [successItems, errorItems];
	}
}

async function processItem(
	context: IExecuteFunctions,
	item: INodeExecutionData,
	itemIndex: number,
	resource: string,
	operation: string,
	errorHandling: IErrorHandlingOptions,
	pagination: IPaginationOptions,
	rateLimit: IRateLimitOptions,
): Promise<{ success: boolean; items: INodeExecutionData[]; error?: ICanvasErrorOutput }> {
	const { endpoint, method, body, qs } = buildRequest(context, resource, operation, itemIndex);

	const result = await executeWithErrorHandling.call(
		context,
		async () => {
			// Handle list operations with pagination
			if (operation === 'getAll' || operation.startsWith('getAll') || operation.startsWith('list')) {
				const response = await canvasApiRequestAllItems.call(
					context,
					method,
					endpoint,
					body,
					qs,
					pagination,
					rateLimit,
				);
				return response.items;
			}

			// Handle single item operations
			const response = await canvasApiRequest.call(
				context,
				method,
				endpoint,
				body,
				qs,
				rateLimit,
			);
			return response.data;
		},
		errorHandling,
		item.json,
		resource,
		operation,
		endpoint,
	);

	if (result.success && result.data) {
		const data = result.data as IDataObject | IDataObject[];
		const items = Array.isArray(data)
			? data.map((d) => ({ json: d }))
			: [{ json: data }];
		return { success: true, items };
	}

	return { success: false, items: [], error: result.error };
}

function buildRequest(
	context: IExecuteFunctions,
	resource: string,
	operation: string,
	itemIndex: number,
): { endpoint: string; method: IHttpRequestMethods; body?: IDataObject; qs?: IDataObject } {
	let endpoint = '';
	let method: IHttpRequestMethods = 'GET';
	let body: IDataObject | undefined;
	let qs: IDataObject | undefined;

	// Helper to safely get parameters
	const getParam = (name: string, defaultValue: string = '') => {
		try {
			return context.getNodeParameter(name, itemIndex, defaultValue) as string;
		} catch {
			return defaultValue;
		}
	};

	const getParamObject = (name: string) => {
		try {
			return context.getNodeParameter(name, itemIndex, {}) as IDataObject;
		} catch {
			return {};
		}
	};

	// Build endpoint and method based on resource and operation
	switch (resource) {
		// ============================================
		// COURSES GROUP
		// ============================================
		case 'course': {
			const courseId = getParam('courseId');
			switch (operation) {
				case 'create':
					endpoint = `/api/v1/accounts/${getParam('accountId')}/courses`;
					method = 'POST';
					body = { course: { name: getParam('name'), ...getParamObject('additionalFields') } };
					break;
				case 'delete':
					endpoint = `/api/v1/courses/${courseId}`;
					method = 'DELETE';
					qs = { event: 'delete' };
					break;
				case 'get':
					endpoint = `/api/v1/courses/${courseId}`;
					qs = getParamObject('options');
					break;
				case 'getAll':
					endpoint = '/api/v1/courses';
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/courses/${courseId}`;
					method = 'PUT';
					body = { course: getParamObject('updateFields') };
					break;
				case 'conclude':
					endpoint = `/api/v1/courses/${courseId}`;
					method = 'DELETE';
					qs = { event: 'conclude' };
					break;
				case 'copy':
					endpoint = `/api/v1/courses/${courseId}/content_migrations`;
					method = 'POST';
					body = {
						migration_type: 'course_copy_importer',
						settings: { source_course_id: getParam('sourceCourseId'), ...getParamObject('options') },
					};
					break;
				case 'listStudents':
					endpoint = `/api/v1/courses/${courseId}/students`;
					qs = getParamObject('options');
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		case 'section': {
			const courseId = getParam('courseId');
			const sectionId = getParam('sectionId');
			switch (operation) {
				case 'create':
					endpoint = `/api/v1/courses/${courseId}/sections`;
					method = 'POST';
					body = { course_section: { name: getParam('name'), ...getParamObject('additionalFields') } };
					break;
				case 'delete':
					endpoint = `/api/v1/sections/${sectionId}`;
					method = 'DELETE';
					break;
				case 'get':
					endpoint = `/api/v1/sections/${sectionId}`;
					qs = getParamObject('options');
					break;
				case 'getAll':
					endpoint = `/api/v1/courses/${courseId}/sections`;
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/sections/${sectionId}`;
					method = 'PUT';
					body = { course_section: getParamObject('updateFields') };
					break;
				case 'crosslist':
					endpoint = `/api/v1/sections/${sectionId}/crosslist/${getParam('newCourseId')}`;
					method = 'POST';
					break;
				case 'uncrosslist':
					endpoint = `/api/v1/sections/${sectionId}/crosslist`;
					method = 'DELETE';
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		// ============================================
		// USERS GROUP
		// ============================================
		case 'user': {
			const userId = getParam('userId', 'self');
			switch (operation) {
				case 'create':
					endpoint = `/api/v1/accounts/${getParam('accountId')}/users`;
					method = 'POST';
					body = {
						user: { name: getParam('name'), ...getParamObject('additionalFields') },
						pseudonym: getParamObject('pseudonym'),
					};
					break;
				case 'delete':
					endpoint = `/api/v1/accounts/${getParam('accountId')}/users/${userId}`;
					method = 'DELETE';
					break;
				case 'get':
					endpoint = `/api/v1/users/${userId}`;
					qs = getParamObject('options');
					break;
				case 'getAll':
					endpoint = `/api/v1/accounts/${getParam('accountId')}/users`;
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/users/${userId}`;
					method = 'PUT';
					body = { user: getParamObject('updateFields') };
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		// ============================================
		// ASSIGNMENTS GROUP
		// ============================================
		case 'assignment': {
			const courseId = getParam('courseId');
			const assignmentId = getParam('assignmentId');
			switch (operation) {
				case 'create':
					endpoint = `/api/v1/courses/${courseId}/assignments`;
					method = 'POST';
					body = { assignment: { name: getParam('name'), ...getParamObject('additionalFields') } };
					break;
				case 'delete':
					endpoint = `/api/v1/courses/${courseId}/assignments/${assignmentId}`;
					method = 'DELETE';
					break;
				case 'get':
					endpoint = `/api/v1/courses/${courseId}/assignments/${assignmentId}`;
					qs = getParamObject('options');
					break;
				case 'getAll':
					endpoint = `/api/v1/courses/${courseId}/assignments`;
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/courses/${courseId}/assignments/${assignmentId}`;
					method = 'PUT';
					body = { assignment: getParamObject('updateFields') };
					break;
				case 'duplicate':
					endpoint = `/api/v1/courses/${courseId}/assignments/${assignmentId}/duplicate`;
					method = 'POST';
					body = getParamObject('options');
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		// ============================================
		// ENROLLMENTS GROUP
		// ============================================
		case 'enrollment': {
			const courseId = getParam('courseId');
			const enrollmentId = getParam('enrollmentId');
			switch (operation) {
				case 'create':
					endpoint = `/api/v1/courses/${courseId}/enrollments`;
					method = 'POST';
					body = {
						enrollment: {
							user_id: getParam('userId'),
							type: getParam('enrollmentType'),
							...getParamObject('additionalFields'),
						},
					};
					break;
				case 'delete':
					endpoint = `/api/v1/courses/${courseId}/enrollments/${enrollmentId}`;
					method = 'DELETE';
					qs = { task: getParam('task', 'conclude') };
					break;
				case 'get':
					endpoint = `/api/v1/accounts/${getParam('accountId')}/enrollments/${enrollmentId}`;
					break;
				case 'getAll':
					endpoint = `/api/v1/courses/${courseId}/enrollments`;
					qs = getParamObject('options');
					break;
				case 'accept':
					endpoint = `/api/v1/courses/${courseId}/enrollments/${enrollmentId}/accept`;
					method = 'POST';
					break;
				case 'reject':
					endpoint = `/api/v1/courses/${courseId}/enrollments/${enrollmentId}/reject`;
					method = 'POST';
					break;
				case 'reactivate':
					endpoint = `/api/v1/courses/${courseId}/enrollments/${enrollmentId}/reactivate`;
					method = 'PUT';
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		// ============================================
		// MODULES GROUP
		// ============================================
		case 'module': {
			const courseId = getParam('courseId');
			const moduleId = getParam('moduleId');
			switch (operation) {
				case 'create':
					endpoint = `/api/v1/courses/${courseId}/modules`;
					method = 'POST';
					body = { module: { name: getParam('name'), ...getParamObject('additionalFields') } };
					break;
				case 'delete':
					endpoint = `/api/v1/courses/${courseId}/modules/${moduleId}`;
					method = 'DELETE';
					break;
				case 'get':
					endpoint = `/api/v1/courses/${courseId}/modules/${moduleId}`;
					qs = getParamObject('options');
					break;
				case 'getAll':
					endpoint = `/api/v1/courses/${courseId}/modules`;
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/courses/${courseId}/modules/${moduleId}`;
					method = 'PUT';
					body = { module: getParamObject('updateFields') };
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		case 'moduleItem': {
			const courseId = getParam('courseId');
			const moduleId = getParam('moduleId');
			const itemId = getParam('itemId');
			switch (operation) {
				case 'create':
					endpoint = `/api/v1/courses/${courseId}/modules/${moduleId}/items`;
					method = 'POST';
					body = {
						module_item: {
							title: getParam('title'),
							type: getParam('type'),
							...getParamObject('additionalFields'),
						},
					};
					break;
				case 'delete':
					endpoint = `/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}`;
					method = 'DELETE';
					break;
				case 'get':
					endpoint = `/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}`;
					qs = getParamObject('options');
					break;
				case 'getAll':
					endpoint = `/api/v1/courses/${courseId}/modules/${moduleId}/items`;
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/courses/${courseId}/modules/${moduleId}/items/${itemId}`;
					method = 'PUT';
					body = { module_item: getParamObject('updateFields') };
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		case 'page': {
			const courseId = getParam('courseId');
			const pageUrl = getParam('pageUrl');
			switch (operation) {
				case 'create':
					endpoint = `/api/v1/courses/${courseId}/pages`;
					method = 'POST';
					body = { wiki_page: { title: getParam('title'), ...getParamObject('additionalFields') } };
					break;
				case 'delete':
					endpoint = `/api/v1/courses/${courseId}/pages/${pageUrl}`;
					method = 'DELETE';
					break;
				case 'get':
					endpoint = `/api/v1/courses/${courseId}/pages/${pageUrl}`;
					break;
				case 'getAll':
					endpoint = `/api/v1/courses/${courseId}/pages`;
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/courses/${courseId}/pages/${pageUrl}`;
					method = 'PUT';
					body = { wiki_page: getParamObject('updateFields') };
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		// ============================================
		// SUBMISSIONS GROUP
		// ============================================
		case 'submission': {
			const courseId = getParam('courseId');
			const assignmentId = getParam('assignmentId');
			const userId = getParam('userId');
			switch (operation) {
				case 'get':
					endpoint = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;
					qs = getParamObject('options');
					break;
				case 'getAll':
					endpoint = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`;
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;
					method = 'PUT';
					body = { submission: getParamObject('updateFields') };
					break;
				case 'grade':
					endpoint = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;
					method = 'PUT';
					body = {
						submission: {
							posted_grade: getParam('grade'),
							...getParamObject('additionalFields'),
						},
					};
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		// ============================================
		// QUIZZES GROUP
		// ============================================
		case 'quiz': {
			const courseId = getParam('courseId');
			const quizId = getParam('quizId');
			switch (operation) {
				case 'create':
					endpoint = `/api/v1/courses/${courseId}/quizzes`;
					method = 'POST';
					body = { quiz: { title: getParam('title'), ...getParamObject('additionalFields') } };
					break;
				case 'delete':
					endpoint = `/api/v1/courses/${courseId}/quizzes/${quizId}`;
					method = 'DELETE';
					break;
				case 'get':
					endpoint = `/api/v1/courses/${courseId}/quizzes/${quizId}`;
					break;
				case 'getAll':
					endpoint = `/api/v1/courses/${courseId}/quizzes`;
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/courses/${courseId}/quizzes/${quizId}`;
					method = 'PUT';
					body = { quiz: getParamObject('updateFields') };
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		// ============================================
		// FILES GROUP
		// ============================================
		case 'file': {
			const fileId = getParam('fileId');
			const courseId = getParam('courseId');
			switch (operation) {
				case 'get':
					endpoint = `/api/v1/files/${fileId}`;
					qs = getParamObject('options');
					break;
				case 'getAll':
					endpoint = `/api/v1/courses/${courseId}/files`;
					qs = getParamObject('options');
					break;
				case 'delete':
					endpoint = `/api/v1/files/${fileId}`;
					method = 'DELETE';
					break;
				case 'update':
					endpoint = `/api/v1/files/${fileId}`;
					method = 'PUT';
					body = getParamObject('updateFields');
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		case 'folder': {
			const folderId = getParam('folderId');
			const courseId = getParam('courseId');
			switch (operation) {
				case 'create':
					endpoint = `/api/v1/courses/${courseId}/folders`;
					method = 'POST';
					body = { name: getParam('name'), ...getParamObject('additionalFields') };
					break;
				case 'get':
					endpoint = `/api/v1/folders/${folderId}`;
					break;
				case 'getAll':
					endpoint = `/api/v1/courses/${courseId}/folders`;
					qs = getParamObject('options');
					break;
				case 'delete':
					endpoint = `/api/v1/folders/${folderId}`;
					method = 'DELETE';
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/folders/${folderId}`;
					method = 'PUT';
					body = getParamObject('updateFields');
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		// ============================================
		// DISCUSSIONS GROUP
		// ============================================
		case 'discussionTopic': {
			const courseId = getParam('courseId');
			const topicId = getParam('topicId');
			switch (operation) {
				case 'create':
					endpoint = `/api/v1/courses/${courseId}/discussion_topics`;
					method = 'POST';
					body = { title: getParam('title'), ...getParamObject('additionalFields') };
					break;
				case 'delete':
					endpoint = `/api/v1/courses/${courseId}/discussion_topics/${topicId}`;
					method = 'DELETE';
					break;
				case 'get':
					endpoint = `/api/v1/courses/${courseId}/discussion_topics/${topicId}`;
					qs = getParamObject('options');
					break;
				case 'getAll':
					endpoint = `/api/v1/courses/${courseId}/discussion_topics`;
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/courses/${courseId}/discussion_topics/${topicId}`;
					method = 'PUT';
					body = getParamObject('updateFields');
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		case 'announcement': {
			const courseId = getParam('courseId');
			const announcementId = getParam('announcementId');
			switch (operation) {
				case 'create':
					endpoint = `/api/v1/courses/${courseId}/discussion_topics`;
					method = 'POST';
					body = {
						title: getParam('title'),
						message: getParam('message'),
						is_announcement: true,
						...getParamObject('additionalFields'),
					};
					break;
				case 'delete':
					endpoint = `/api/v1/courses/${courseId}/discussion_topics/${announcementId}`;
					method = 'DELETE';
					break;
				case 'get':
					endpoint = `/api/v1/courses/${courseId}/discussion_topics/${announcementId}`;
					break;
				case 'getAll':
					endpoint = '/api/v1/announcements';
					qs = { context_codes: getParam('contextCodes'), ...getParamObject('options') };
					break;
				case 'update':
					endpoint = `/api/v1/courses/${courseId}/discussion_topics/${announcementId}`;
					method = 'PUT';
					body = getParamObject('updateFields');
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		// ============================================
		// ACCOUNTS GROUP
		// ============================================
		case 'account': {
			const accountId = getParam('accountId');
			switch (operation) {
				case 'get':
					endpoint = `/api/v1/accounts/${accountId}`;
					qs = getParamObject('options');
					break;
				case 'getAll':
					endpoint = '/api/v1/accounts';
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/accounts/${accountId}`;
					method = 'PUT';
					body = { account: getParamObject('updateFields') };
					break;
				case 'createSubAccount':
					endpoint = `/api/v1/accounts/${accountId}/sub_accounts`;
					method = 'POST';
					body = { account: { name: getParam('name'), ...getParamObject('additionalFields') } };
					break;
				case 'getSubAccounts':
					endpoint = `/api/v1/accounts/${accountId}/sub_accounts`;
					qs = getParamObject('options');
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		// ============================================
		// GROUPS GROUP
		// ============================================
		case 'group': {
			const groupId = getParam('groupId');
			const courseId = getParam('courseId');
			switch (operation) {
				case 'create':
					endpoint = courseId ? `/api/v1/courses/${courseId}/groups` : `/api/v1/group_categories/${getParam('groupCategoryId')}/groups`;
					method = 'POST';
					body = { name: getParam('name'), ...getParamObject('additionalFields') };
					break;
				case 'delete':
					endpoint = `/api/v1/groups/${groupId}`;
					method = 'DELETE';
					break;
				case 'get':
					endpoint = `/api/v1/groups/${groupId}`;
					qs = getParamObject('options');
					break;
				case 'getAll':
					endpoint = '/api/v1/users/self/groups';
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/groups/${groupId}`;
					method = 'PUT';
					body = getParamObject('updateFields');
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		// ============================================
		// CONVERSATIONS GROUP
		// ============================================
		case 'conversation': {
			const conversationId = getParam('conversationId');
			switch (operation) {
				case 'create':
					endpoint = '/api/v1/conversations';
					method = 'POST';
					body = {
						recipients: getParam('recipients'),
						body: getParam('body'),
						...getParamObject('additionalFields'),
					};
					break;
				case 'delete':
					endpoint = `/api/v1/conversations/${conversationId}`;
					method = 'DELETE';
					break;
				case 'get':
					endpoint = `/api/v1/conversations/${conversationId}`;
					qs = getParamObject('options');
					break;
				case 'getAll':
					endpoint = '/api/v1/conversations';
					qs = getParamObject('options');
					break;
				case 'update':
					endpoint = `/api/v1/conversations/${conversationId}`;
					method = 'PUT';
					body = { conversation: getParamObject('updateFields') };
					break;
				default:
					throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
			}
			break;
		}

		// ============================================
		// DEFAULT - Throw error for unimplemented resources
		// ============================================
		default:
			throw new ApplicationError(`Resource ${resource} not yet fully implemented. Please check the Canvas API documentation.`);
	}

	return { endpoint, method, body, qs };
}
