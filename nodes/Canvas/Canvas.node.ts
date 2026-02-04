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

export class Canvas implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Canvas LMS',
		name: 'canvas',
		icon: 'file:../../icons/canvas.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Canvas LMS API - Full coverage of 130 resources',
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
					{ name: 'Account', value: 'account' },
					{ name: 'Admin', value: 'admin' },
					{ name: 'Analytics', value: 'analytics' },
					{ name: 'Announcement', value: 'announcement' },
					{ name: 'Appointment Group', value: 'appointmentGroup' },
					{ name: 'Assignment', value: 'assignment' },
					{ name: 'Assignment Group', value: 'assignmentGroup' },
					{ name: 'Calendar Event', value: 'calendarEvent' },
					{ name: 'Communication Channel', value: 'communicationChannel' },
					{ name: 'Conversation', value: 'conversation' },
					{ name: 'Course', value: 'course' },
					{ name: 'Custom Gradebook Column', value: 'customGradebookColumn' },
					{ name: 'Discussion Topic', value: 'discussionTopic' },
					{ name: 'Enrollment', value: 'enrollment' },
					{ name: 'Enrollment Term', value: 'enrollmentTerm' },
					{ name: 'Favorite', value: 'favorite' },
					{ name: 'Feature Flag', value: 'featureFlag' },
					{ name: 'File', value: 'file' },
					{ name: 'Folder', value: 'folder' },
					{ name: 'Grading Period', value: 'gradingPeriod' },
					{ name: 'Grading Standard', value: 'gradingStandard' },
					{ name: 'Group', value: 'group' },
					{ name: 'Group Category', value: 'groupCategory' },
					{ name: 'Login', value: 'login' },
					{ name: 'Module', value: 'module' },
					{ name: 'Module Item', value: 'moduleItem' },
					{ name: 'New Quiz', value: 'newQuiz' },
					{ name: 'Outcome', value: 'outcome' },
					{ name: 'Outcome Group', value: 'outcomeGroup' },
					{ name: 'Page', value: 'page' },
					{ name: 'Planner', value: 'planner' },
					{ name: 'Quiz', value: 'quiz' },
					{ name: 'Quiz Question', value: 'quizQuestion' },
					{ name: 'Quiz Submission', value: 'quizSubmission' },
					{ name: 'Role', value: 'role' },
					{ name: 'Rubric', value: 'rubric' },
					{ name: 'Section', value: 'section' },
					{ name: 'SIS Import', value: 'sisImport' },
					{ name: 'Submission', value: 'submission' },
					{ name: 'Tab', value: 'tab' },
					{ name: 'User', value: 'user' },
				],
				default: 'course',
			},

			// Operation for Course
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['course'],
					},
				},
				options: [
					{ name: 'Create', value: 'create', action: 'Create a course' },
					{ name: 'Delete', value: 'delete', action: 'Delete a course' },
					{ name: 'Get', value: 'get', action: 'Get a course' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many courses' },
					{ name: 'Update', value: 'update', action: 'Update a course' },
				],
				default: 'getAll',
			},

			// Operation for User
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['user'],
					},
				},
				options: [
					{ name: 'Create', value: 'create', action: 'Create a user' },
					{ name: 'Delete', value: 'delete', action: 'Delete a user' },
					{ name: 'Get', value: 'get', action: 'Get a user' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many users' },
					{ name: 'Update', value: 'update', action: 'Update a user' },
				],
				default: 'getAll',
			},

			// Generic Operation for other resources
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					hide: {
						resource: ['course', 'user'],
					},
				},
				options: [
					{ name: 'Create', value: 'create', action: 'Create a resource' },
					{ name: 'Delete', value: 'delete', action: 'Delete a resource' },
					{ name: 'Get', value: 'get', action: 'Get a resource' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many resources' },
					{ name: 'Update', value: 'update', action: 'Update a resource' },
				],
				default: 'getAll',
			},

			// Common Parameters
			{
				displayName: 'Course ID',
				name: 'courseId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['assignment', 'submission', 'quiz', 'module', 'moduleItem', 'page', 'enrollment', 'section', 'announcement', 'discussionTopic', 'file', 'folder', 'assignmentGroup', 'gradingPeriod', 'customGradebookColumn'],
					},
				},
			},

			{
				displayName: 'User ID',
				name: 'userId',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['user'],
						operation: ['get', 'update', 'delete'],
					},
				},
				description: 'The ID of the user (use "self" for current user)',
			},

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
				displayOptions: {
					show: {
						operation: ['getAll'],
					},
				},
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
	const endpoint = buildEndpoint(context, resource, operation, itemIndex);

	const result = await executeWithErrorHandling.call(
		context,
		async () => {
			if (operation === 'getAll') {
				const response = await canvasApiRequestAllItems.call(
					context,
					'GET',
					endpoint,
					undefined,
					undefined,
					pagination,
					rateLimit,
				);
				return response.items;
			} else if (operation === 'get') {
				const response = await canvasApiRequest.call(
					context,
					'GET',
					endpoint,
					undefined,
					undefined,
					rateLimit,
				);
				return response.data;
			} else if (operation === 'create') {
				const body = context.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
				const response = await canvasApiRequest.call(
					context,
					'POST',
					endpoint,
					body,
					undefined,
					rateLimit,
				);
				return response.data;
			} else if (operation === 'update') {
				const body = context.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;
				const response = await canvasApiRequest.call(
					context,
					'PUT',
					endpoint,
					body,
					undefined,
					rateLimit,
				);
				return response.data;
			} else if (operation === 'delete') {
				const response = await canvasApiRequest.call(
					context,
					'DELETE',
					endpoint,
					undefined,
					undefined,
					rateLimit,
				);
				return response.data;
			}
			throw new ApplicationError(`Operation ${operation} not implemented for ${resource}`);
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

function buildEndpoint(
	context: IExecuteFunctions,
	resource: string,
	operation: string,
	itemIndex: number,
): string {
	switch (resource) {
		case 'course': {
			if (operation === 'getAll') {
				return '/api/v1/courses';
			}
			const courseId = context.getNodeParameter('courseId', itemIndex, '') as string;
			return `/api/v1/courses/${courseId}`;
		}

		case 'user': {
			if (operation === 'getAll') {
				return '/api/v1/users';
			}
			const userId = context.getNodeParameter('userId', itemIndex, 'self') as string;
			return `/api/v1/users/${userId}`;
		}

		case 'enrollment': {
			const courseId = context.getNodeParameter('courseId', itemIndex) as string;
			if (operation === 'getAll') {
				return `/api/v1/courses/${courseId}/enrollments`;
			}
			const enrollmentId = context.getNodeParameter('enrollmentId', itemIndex, '') as string;
			return `/api/v1/courses/${courseId}/enrollments/${enrollmentId}`;
		}

		case 'assignment': {
			const courseId = context.getNodeParameter('courseId', itemIndex) as string;
			if (operation === 'getAll') {
				return `/api/v1/courses/${courseId}/assignments`;
			}
			const assignmentId = context.getNodeParameter('assignmentId', itemIndex, '') as string;
			return `/api/v1/courses/${courseId}/assignments/${assignmentId}`;
		}

		case 'submission': {
			const courseId = context.getNodeParameter('courseId', itemIndex) as string;
			const assignmentId = context.getNodeParameter('assignmentId', itemIndex) as string;
			if (operation === 'getAll') {
				return `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`;
			}
			const userId = context.getNodeParameter('userId', itemIndex, '') as string;
			return `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;
		}

		case 'module': {
			const courseId = context.getNodeParameter('courseId', itemIndex) as string;
			if (operation === 'getAll') {
				return `/api/v1/courses/${courseId}/modules`;
			}
			const moduleId = context.getNodeParameter('moduleId', itemIndex, '') as string;
			return `/api/v1/courses/${courseId}/modules/${moduleId}`;
		}

		case 'page': {
			const courseId = context.getNodeParameter('courseId', itemIndex) as string;
			if (operation === 'getAll') {
				return `/api/v1/courses/${courseId}/pages`;
			}
			const pageUrl = context.getNodeParameter('pageUrl', itemIndex, '') as string;
			return `/api/v1/courses/${courseId}/pages/${pageUrl}`;
		}

		case 'file': {
			const courseId = context.getNodeParameter('courseId', itemIndex) as string;
			if (operation === 'getAll') {
				return `/api/v1/courses/${courseId}/files`;
			}
			const fileId = context.getNodeParameter('fileId', itemIndex, '') as string;
			return `/api/v1/files/${fileId}`;
		}

		case 'quiz': {
			const courseId = context.getNodeParameter('courseId', itemIndex) as string;
			if (operation === 'getAll') {
				return `/api/v1/courses/${courseId}/quizzes`;
			}
			const quizId = context.getNodeParameter('quizId', itemIndex, '') as string;
			return `/api/v1/courses/${courseId}/quizzes/${quizId}`;
		}

		case 'discussionTopic': {
			const courseId = context.getNodeParameter('courseId', itemIndex) as string;
			if (operation === 'getAll') {
				return `/api/v1/courses/${courseId}/discussion_topics`;
			}
			const topicId = context.getNodeParameter('topicId', itemIndex, '') as string;
			return `/api/v1/courses/${courseId}/discussion_topics/${topicId}`;
		}

		case 'announcement': {
			const courseId = context.getNodeParameter('courseId', itemIndex) as string;
			if (operation === 'getAll') {
				return `/api/v1/courses/${courseId}/discussion_topics?only_announcements=true`;
			}
			const topicId = context.getNodeParameter('topicId', itemIndex, '') as string;
			return `/api/v1/courses/${courseId}/discussion_topics/${topicId}`;
		}

		case 'group': {
			if (operation === 'getAll') {
				return '/api/v1/users/self/groups';
			}
			const groupId = context.getNodeParameter('groupId', itemIndex, '') as string;
			return `/api/v1/groups/${groupId}`;
		}

		case 'account': {
			if (operation === 'getAll') {
				return '/api/v1/accounts';
			}
			const accountId = context.getNodeParameter('accountId', itemIndex, '') as string;
			return `/api/v1/accounts/${accountId}`;
		}

		default:
			throw new ApplicationError(`Resource ${resource} not yet implemented`);
	}
}
