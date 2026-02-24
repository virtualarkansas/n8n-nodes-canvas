import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, ApplicationError } from 'n8n-workflow';

import {
	canvasApiRequest,
	canvasApiRequestAllItems,
	canvasFileUpload,
	canvasFileUploadFromUrl,
	executeWithErrorHandling,
	buildCurlCommand,
	getCanvasUrl,
	DEFAULT_RATE_LIMIT_OPTIONS,
	DEFAULT_PAGINATION_OPTIONS,
	DEFAULT_ERROR_HANDLING_OPTIONS,
	sleep,
} from './GenericFunctions';

import type {
	IRequestConfig,
	IRateLimitOptions,
	IPaginationOptions,
	IErrorHandlingOptions,
	IBatchOptions,
	ICanvasErrorOutput,
} from './types/Canvas.types';

import { resourceHandlers } from './handlers';

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
		outputs: '={{$parameter["debugMode"] ? ["main", "main", "main"] : ["main", "main"]}}',
		outputNames: ['Success', 'Error', 'Debug'],
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

			// Debug Mode
			{
				displayName: 'Debug Mode',
				name: 'debugMode',
				type: 'boolean',
				default: false,
				description: 'Whether to skip API calls and output the equivalent curl command and request details to a Debug output instead',
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
		const debugMode = this.getNodeParameter('debugMode', 0, false) as boolean;

		if (debugMode) {
			const canvasBaseUrl = await getCanvasUrl.call(this);
			const authType = this.getNodeParameter('authentication', 0) as string;
			const debugItems: INodeExecutionData[] = [];

			for (let i = 0; i < items.length; i++) {
				const { endpoint, method, body, qs } = buildRequest(this, resource, operation, i);
				const curl = buildCurlCommand(method, canvasBaseUrl, endpoint, qs, body, authType);

				const debugJson: IDataObject = {
					resource,
					operation,
					method,
					url: `${canvasBaseUrl}${endpoint}`,
					queryString: qs || {},
					body: body || {},
					curl,
				};

				if (resource === 'file' && operation === 'upload') {
					debugJson._note = 'This is Step 1 of 3. Steps 2 (multipart upload) and 3 (confirmation) are handled automatically at runtime.';
				}

				debugItems.push({ json: debugJson });
			}

			return [[], [], debugItems];
		}

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
	const bodyData = body as IDataObject | undefined;
	const qsData = qs as IDataObject | undefined;

	// Special case: File Upload (three-step process)
	if (resource === 'file' && operation === 'upload') {
		const result = await executeWithErrorHandling.call(
			context,
			async () => {
				const uploadSource = context.getNodeParameter('uploadSource', itemIndex, 'binaryData') as string;

				if (uploadSource === 'binaryData') {
					const binaryPropertyName = context.getNodeParameter('binaryPropertyName', itemIndex, 'data') as string;
					const binaryData = context.helpers.assertBinaryData(itemIndex, binaryPropertyName);
					const binaryBuffer = await context.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);

					const step1Body = { ...(bodyData || {}) } as IDataObject;
					if (!step1Body.name) {
						step1Body.name = binaryData.fileName || 'unnamed_file';
					}
					if (!step1Body.content_type) {
						step1Body.content_type = binaryData.mimeType || 'application/octet-stream';
					}
					step1Body.size = binaryBuffer.length;

					return canvasFileUpload.call(
						context,
						endpoint,
						step1Body,
						itemIndex,
						binaryPropertyName,
						rateLimit,
					);
				} else {
					const fileUrl = context.getNodeParameter('fileUrl', itemIndex) as string;
					const waitForCompletion = context.getNodeParameter('waitForCompletion', itemIndex, true) as boolean;

					const step1Body = { ...(bodyData || {}) } as IDataObject;
					if (!step1Body.name) {
						try {
							const urlPath = new URL(fileUrl).pathname;
							step1Body.name = urlPath.split('/').pop() || 'uploaded_file';
						} catch {
							step1Body.name = 'uploaded_file';
						}
					}

					return canvasFileUploadFromUrl.call(
						context,
						endpoint,
						step1Body,
						fileUrl,
						waitForCompletion,
						rateLimit,
					);
				}
			},
			errorHandling,
			item.json,
			resource,
			operation,
			endpoint,
		);

		if (result.success && result.data) {
			const data = result.data as IDataObject;
			return { success: true, items: [{ json: data }] };
		}
		return { success: false, items: [], error: result.error };
	}

	const result = await executeWithErrorHandling.call(
		context,
		async () => {
			// Handle list operations with pagination
			if (operation === 'getAll' || operation.startsWith('getAll') || operation.startsWith('list')) {
				const response = await canvasApiRequestAllItems.call(
					context,
					method,
					endpoint,
					bodyData,
					qsData,
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
				bodyData,
				qsData,
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
): IRequestConfig {
	// Helper to safely get parameters
	const getParam = (name: string, defaultValue: string = '') => {
		try {
			return context.getNodeParameter(name, itemIndex, defaultValue) as string;
		} catch {
			return defaultValue;
		}
	};

	const getParamObject = (name: string): Record<string, unknown> => {
		try {
			return context.getNodeParameter(name, itemIndex, {}) as Record<string, unknown>;
		} catch {
			return {};
		}
	};

	const handler = resourceHandlers[resource];
	if (!handler) {
		throw new ApplicationError(`Resource "${resource}" is not implemented`);
	}

	return handler(operation, getParam, getParamObject);
}
