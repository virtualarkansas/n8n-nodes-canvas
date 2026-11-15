import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	canvasApiRequest,
	canvasApiRequestAllItems,
	canvasApiRequestMergedRecord,
	canvasFileUpload,
	canvasFileUploadFromUrl,
	executeWithErrorHandling,
	encodePathValues,
	resolvePerPage,
	unwrapRecord,
	buildCurlCommand,
	buildCanvasUrl,
	getCanvasUrl,
	CANVAS_MAX_PER_PAGE,
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

import { canvasResources } from './resources';

export class Canvas implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Canvas LMS',
		name: 'canvas',
		icon: 'file:../../icons/canvas.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and manage courses, users, enrollments, grades, content and administration in Canvas LMS',
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
			{
				name: 'canvasLtiAdvantageApi',
				required: true,
				displayOptions: {
					show: {
						authentication: ['ltiAdvantage'],
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
						name: 'LTI Advantage',
						value: 'ltiAdvantage',
						description:
							'As an LTI 1.3 tool, for the LTI Advantage services only (Line Item, Progress > Get LTI, and /api/lti paths in Custom API Request)',
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
				options: canvasResources.map(({ name, value }) => ({ name, value })),
				default: 'course',
			},

			// Operations, then fields, of every resource (see resources.ts)
			...canvasResources.flatMap((resource) => resource.operations),
			...canvasResources.flatMap((resource) => resource.fields),

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

			// Request Options
			{
				displayName: 'Request Options',
				name: 'requestOptions',
				type: 'collection',
				placeholder: 'Add Request Option',
				default: {},
				options: [
					{
						displayName: 'Act as User ID',
						name: 'asUserId',
						type: 'string',
						default: '',
						placeholder: '12345 or sis_user_id:jdoe',
						description:
							'Carry out the request as this user (Canvas masquerading, as_user_id). The user of the credential needs the "Become other users" permission; Canvas records both users in its logs. May be an expression, so each item can act as a different user.',
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

		// Get options
		const errorHandlingRaw = this.getNodeParameter('errorHandling', 0, {}) as IDataObject;
		const errorHandling: IErrorHandlingOptions = {
			onError: (errorHandlingRaw.onError as IErrorHandlingOptions['onError']) || DEFAULT_ERROR_HANDLING_OPTIONS.onError,
			maxRetries: toNumber(errorHandlingRaw.maxRetries, DEFAULT_ERROR_HANDLING_OPTIONS.maxRetries, 0),
		};

		const paginationRaw = this.getNodeParameter('pagination', 0, {}) as IDataObject;
		const nodeReturnAll = paginationRaw.returnAll === true;
		const pagination: IPaginationOptions = {
			enabled: true,
			// Fetching everything is far cheaper with full pages unless a size was chosen explicitly.
			perPage: toNumber(
				paginationRaw.perPage,
				nodeReturnAll ? CANVAS_MAX_PER_PAGE : DEFAULT_PAGINATION_OPTIONS.perPage,
				1,
			),
			maxPages: nodeReturnAll ? 0 : toNumber(paginationRaw.maxPages, DEFAULT_PAGINATION_OPTIONS.maxPages, 0),
		};

		const rateLimitRaw = this.getNodeParameter('rateLimiting', 0, {}) as IDataObject;
		const rateLimit: IRateLimitOptions = {
			enabled: rateLimitRaw.enabled !== false,
			threshold: toNumber(rateLimitRaw.threshold, DEFAULT_RATE_LIMIT_OPTIONS.threshold, 0),
			maxRetries: toNumber(rateLimitRaw.maxRetries, DEFAULT_RATE_LIMIT_OPTIONS.maxRetries, 0),
			baseDelayMs: DEFAULT_RATE_LIMIT_OPTIONS.baseDelayMs,
			maxDelayMs: DEFAULT_RATE_LIMIT_OPTIONS.maxDelayMs,
		};

		const batchRaw = this.getNodeParameter('batchProcessing', 0, {}) as IDataObject;
		const batch: IBatchOptions = {
			mode: (batchRaw.mode as IBatchOptions['mode']) || 'batch',
			batchSize: toNumber(batchRaw.batchSize, 10, 1),
			batchDelay: toNumber(batchRaw.batchDelay, 1000, 0),
		};

		if (debugMode) {
			const canvasBaseUrl = await getCanvasUrl.call(this);
			const authType = this.getNodeParameter('authentication', 0) as string;
			const debugItems: INodeExecutionData[] = [];

			for (let i = 0; i < items.length; i++) {
				// A request that cannot be built is handled like a failed one: per the error mode.
				const built = await executeWithErrorHandling.call(
					this,
					async () => buildRequest(this, resource, operation, i),
					{ ...errorHandling, maxRetries: 0 },
					items[i].json,
					resource,
					operation,
					'',
					i,
				);
				if (!built.success || !built.data) {
					if (built.error) {
						errorItems.push({ json: built.error as unknown as IDataObject, pairedItem: { item: i } });
					}
					continue;
				}
				const request = built.data as IRequestConfig;
				const { endpoint, method } = request;
				let body = request.body;
				let contentType = request.contentType;
				// Show the query exactly as a real run sends it: every GET carries per_page.
				let qs = request.qs;
				if (request.binaryBody) {
					// The body is a file of the input item; describe it instead of printing it.
					const { propertyName, prepare } = request.binaryBody;
					const file = items[i].binary?.[propertyName];
					const derived = file ? (prepare?.(file) ?? {}) : {};
					qs = { ...(qs ?? {}), ...(derived.qs ?? {}) };
					contentType = derived.contentType ?? contentType ?? file?.mimeType ?? 'application/octet-stream';
					body = `@<binary property "${propertyName}"${file?.fileName ? `: ${file.fileName}` : file ? '' : ', missing on this item'}>`;
				}
				if (method === 'GET') {
					const perPage =
						request.fetchAllPages || request.mergePagedArray
							? CANVAS_MAX_PER_PAGE
							: resolvePerPage(resolvePagination(this, i, pagination));
					qs = { per_page: perPage, ...(request.qs ?? {}) };
				}
				const asUserId = masqueradeAs(this, i);
				if (asUserId && qs?.as_user_id === undefined) {
					qs = { ...(qs ?? {}), as_user_id: asUserId };
				}
				const curl = buildCurlCommand(method, canvasBaseUrl, endpoint, qs, body, authType, contentType);

				const debugJson: IDataObject = {
					resource,
					operation,
					method,
					url: buildCanvasUrl(canvasBaseUrl, endpoint, qs),
					queryString: qs || {},
					body: Buffer.isBuffer(body) ? `<${body.length} bytes>` : body || {},
					curl,
				};

				if (resource === 'file' && operation === 'upload') {
					debugJson._note = 'This is Step 1 of 3. Steps 2 (multipart upload) and 3 (confirmation) are handled automatically at runtime.';
				}

				debugItems.push({ json: debugJson, pairedItem: { item: i } });
			}

			return [[], errorItems, debugItems];
		}

		const collect = (result: IProcessResult): void => {
			if (result.success) {
				successItems.push(...result.items);
			} else if (result.error) {
				errorItems.push({
					json: result.error as unknown as IDataObject,
					pairedItem: { item: result.itemIndex },
				});
			}
		};

		// Process items
		if (batch.mode === 'batch') {
			for (let i = 0; i < items.length; i += batch.batchSize) {
				const batchItems = items.slice(i, i + batch.batchSize);

				const results = await Promise.all(
					batchItems.map(async (item, batchIndex) =>
						processItem(
							this,
							item,
							i + batchIndex,
							resource,
							operation,
							errorHandling,
							pagination,
							rateLimit,
						),
					),
				);

				results.forEach(collect);

				if (i + batch.batchSize < items.length && batch.batchDelay > 0) {
					await sleep(batch.batchDelay);
				}
			}
		} else {
			for (let i = 0; i < items.length; i++) {
				collect(
					await processItem(
						this,
						items[i],
						i,
						resource,
						operation,
						errorHandling,
						pagination,
						rateLimit,
					),
				);
			}
		}

		return [successItems, errorItems];
	}
}

interface IProcessResult {
	success: boolean;
	itemIndex: number;
	items: INodeExecutionData[];
	error?: ICanvasErrorOutput;
}

/**
 * Read a numeric option, falling back when it is unset or not a number.
 * (`||` would turn a deliberate 0 into the default.)
 */
function toNumber(value: unknown, fallback: number, min: number): number {
	const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
	if (!Number.isFinite(parsed)) {
		return fallback;
	}
	return Math.max(min, parsed);
}

/**
 * Turn a Canvas response into n8n items, always linked to the input item.
 *   - a list becomes one item per record (an empty list yields no items),
 *   - a record becomes one item,
 *   - an empty body (204, or `null`) becomes `{ success: true }` so the item is not lost.
 */
function toOutputItems(data: unknown, itemIndex: number): INodeExecutionData[] {
	const pairedItem = { item: itemIndex };
	const wrap = (value: unknown): INodeExecutionData => {
		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			return { json: value as IDataObject, pairedItem };
		}
		return { json: { value: value as IDataObject[keyof IDataObject] }, pairedItem };
	};

	if (Array.isArray(data)) {
		return data.map(wrap);
	}
	if (data === undefined || data === null || data === '') {
		return [{ json: { success: true }, pairedItem }];
	}
	return [wrap(data)];
}

/** The user to act as for this item ("Act as User ID"), if any. */
function masqueradeAs(context: IExecuteFunctions, itemIndex: number): string {
	const options = context.getNodeParameter('requestOptions', itemIndex, {}) as IDataObject;
	return String(options.asUserId ?? '').trim();
}

async function processItem(
	context: IExecuteFunctions,
	item: INodeExecutionData,
	itemIndex: number,
	resource: string,
	operation: string,
	errorHandling: IErrorHandlingOptions,
	nodePagination: IPaginationOptions,
	nodeRateLimit: IRateLimitOptions,
): Promise<IProcessResult> {
	// Known once the request has been built; reported with any error.
	let endpoint = '';

	const result = await executeWithErrorHandling.call(
		context,
		async () => {
			const request = buildRequest(context, resource, operation, itemIndex);
			const asUserId = masqueradeAs(context, itemIndex);
			const rateLimit: IRateLimitOptions = asUserId ? { ...nodeRateLimit, asUserId } : nodeRateLimit;
			endpoint = request.endpoint;
			const bodyData = request.body as IDataObject | IDataObject[] | string | Buffer | undefined;
			const qsData = request.qs as IDataObject | undefined;

			// Special case: File Upload (three-step process)
			if (resource === 'file' && operation === 'upload') {
				const uploadSource = context.getNodeParameter('uploadSource', itemIndex, 'binaryData') as string;

				if (uploadSource === 'binaryData') {
					const binaryPropertyName = context.getNodeParameter('binaryPropertyName', itemIndex, 'data') as string;
					const binaryData = context.helpers.assertBinaryData(itemIndex, binaryPropertyName);
					const binaryBuffer = await context.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);

					const step1Body = { ...((bodyData as IDataObject | undefined) || {}) } as IDataObject;
					if (!step1Body.name) {
						step1Body.name = binaryData.fileName || 'unnamed_file';
					}
					if (!step1Body.content_type) {
						step1Body.content_type = binaryData.mimeType || 'application/octet-stream';
					}
					step1Body.size = binaryBuffer.length;

					return canvasFileUpload.call(
						context,
						request.endpoint,
						step1Body,
						itemIndex,
						binaryPropertyName,
						rateLimit,
					);
				}

				const fileUrl = context.getNodeParameter('fileUrl', itemIndex) as string;
				const waitForCompletion = context.getNodeParameter('waitForCompletion', itemIndex, true) as boolean;

				const step1Body = { ...((bodyData as IDataObject | undefined) || {}) } as IDataObject;
				if (!step1Body.name) {
					try {
						const urlPath = new URL(fileUrl).pathname;
						step1Body.name = decodeURIComponent(urlPath.split('/').pop() || '') || 'uploaded_file';
					} catch {
						step1Body.name = 'uploaded_file';
					}
				}

				return canvasFileUploadFromUrl.call(
					context,
					request.endpoint,
					step1Body,
					fileUrl,
					waitForCompletion,
					rateLimit,
				);
			}

			// Every GET goes through the paginating request: Canvas tells us through the
			// Link header whether there is more, so no list endpoint is cut off at one page.
			if (request.method === 'GET' && request.mergePagedArray) {
				return canvasApiRequestMergedRecord.call(
					context,
					request.endpoint,
					qsData,
					request.mergePagedArray,
					rateLimit,
				);
			}

			if (request.method === 'GET') {
				let pagination: IPaginationOptions = request.fetchAllPages
					? { enabled: true, perPage: CANVAS_MAX_PER_PAGE, maxPages: 0 }
					: resolvePagination(context, itemIndex, nodePagination);
				if (request.singlePage) {
					pagination = { ...pagination, enabled: false };
				}
				const response = await canvasApiRequestAllItems.call(
					context,
					request.method,
					request.endpoint,
					undefined,
					qsData,
					pagination,
					rateLimit,
					request.dataKey,
				);
				if (!response.isList) {
					return unwrapRecord(response.items[0], request.dataKey);
				}
				let records = response.items;
				if (request.itemKey) {
					const key = request.itemKey;
					records = records.map((record) =>
						record && typeof record[key] === 'object' && record[key] !== null
							? (record[key] as IDataObject)
							: record,
					);
				}
				return request.transform ? request.transform(records) : records;
			}

			let writeBody: IDataObject | IDataObject[] | string | Buffer | undefined = bodyData;
			let writeQuery = qsData;
			let contentType = request.contentType;
			if (request.binaryBody) {
				// The request body is a file from the input item (import files).
				const { propertyName, prepare } = request.binaryBody;
				const file = context.helpers.assertBinaryData(itemIndex, propertyName);
				writeBody = await context.helpers.getBinaryDataBuffer(itemIndex, propertyName);
				const derived = prepare?.(file) ?? {};
				writeQuery = { ...(qsData ?? {}), ...((derived.qs ?? {}) as IDataObject) };
				contentType = derived.contentType ?? contentType ?? file.mimeType ?? 'application/octet-stream';
			}

			const response = await canvasApiRequest.call(
				context,
				request.method,
				request.endpoint,
				writeBody,
				writeQuery,
				rateLimit,
				contentType,
			);
			if (request.checkResponse) {
				request.checkResponse(response.data as IDataObject);
			}
			if (request.thenGet) {
				if (request.mergePagedArray) {
					return canvasApiRequestMergedRecord.call(
						context,
						request.thenGet,
						undefined,
						request.mergePagedArray,
						rateLimit,
					);
				}
				const current = await canvasApiRequest.call(
					context,
					'GET',
					request.thenGet,
					undefined,
					undefined,
					rateLimit,
				);
				return unwrapRecord(current.data, request.dataKey);
			}
			// Some APIs wrap even a created or updated record:
			// { "poll_choices": [{...}] } or { "late_policy": {...} }.
			const data = response.data as IDataObject | undefined;
			if (request.dataKey && data && Array.isArray(data[request.dataKey])) {
				return data[request.dataKey] as IDataObject[];
			}
			return unwrapRecord(response.data, request.dataKey);
		},
		errorHandling,
		item.json,
		resource,
		operation,
		() => endpoint,
		itemIndex,
	);

	if (result.success) {
		return { success: true, itemIndex, items: toOutputItems(result.data, itemIndex) };
	}

	return { success: false, itemIndex, items: [], error: result.error };
}

/**
 * Operation-level "Return All" / "Limit" fields (where a resource defines them)
 * take precedence over the node-level Pagination options.
 */
function resolvePagination(
	context: IExecuteFunctions,
	itemIndex: number,
	nodePagination: IPaginationOptions,
): IPaginationOptions {
	let returnAll: unknown;
	let limit: unknown;
	try {
		returnAll = context.getNodeParameter('returnAll', itemIndex, null);
		limit = context.getNodeParameter('limit', itemIndex, null);
	} catch {
		return nodePagination;
	}
	if (returnAll === null || returnAll === undefined) {
		return nodePagination;
	}
	if (returnAll === true) {
		return { ...nodePagination, perPage: CANVAS_MAX_PER_PAGE, maxPages: 0, limit: undefined };
	}
	const itemLimit = toNumber(limit, 50, 1);
	return {
		...nodePagination,
		perPage: Math.min(CANVAS_MAX_PER_PAGE, itemLimit),
		maxPages: 0,
		limit: itemLimit,
	};
}

function buildRequest(
	context: IExecuteFunctions,
	resource: string,
	operation: string,
	itemIndex: number,
): IRequestConfig {
	const emptyParams: string[] = [];
	// Values handed to the handler; any of them may end up as a path segment.
	const pathValues = new Set<string>();

	// Parameters hidden for the current operation resolve to the default; expression
	// errors are real errors and must surface instead of silently becoming ''.
	const getParam = (name: string, defaultValue: string = ''): string => {
		const value = context.getNodeParameter(name, itemIndex, defaultValue) as unknown;
		if (value === undefined || value === null || value === '') {
			emptyParams.push(name);
			return defaultValue;
		}
		if (Array.isArray(value)) {
			// A list of records (from an expression into a JSON field) stays JSON;
			// a list of plain values becomes "a,b,c".
			return value.some((entry) => entry !== null && typeof entry === 'object')
				? JSON.stringify(value)
				: value.map((entry) => String(entry)).join(',');
		}
		if (typeof value === 'object') {
			return JSON.stringify(value);
		}
		// IDs arrive as numbers when they come from an expression, and pasted IDs often
		// carry stray whitespace. Free text is passed through untouched.
		const text = /id$/i.test(name) ? String(value).trim() : String(value);
		pathValues.add(text);
		return text;
	};

	const getParamObject = (name: string): Record<string, unknown> => {
		const value = context.getNodeParameter(name, itemIndex, {}) as unknown;
		if (value === null || typeof value !== 'object' || Array.isArray(value)) {
			return {};
		}
		// Copy: handlers add and rewrite keys, and n8n hands out the stored parameter object.
		return { ...(value as Record<string, unknown>) };
	};

	const handler = resourceHandlers[resource];
	if (!handler) {
		throw new NodeOperationError(context.getNode(), `Resource "${resource}" is not implemented`, {
			itemIndex,
		});
	}

	let request: IRequestConfig;
	try {
		request = handler(operation, getParam, getParamObject);
	} catch (error) {
		// Handlers reject unusable input (missing entries, invalid JSON, ...) with plain errors;
		// report them as a problem with this item's parameters.
		if ((error as Error)?.name === 'NodeOperationError') {
			throw error;
		}
		throw new NodeOperationError(context.getNode(), (error as Error)?.message ?? String(error), {
			itemIndex,
			description: `Check the parameters of ${resource}/${operation}`,
		});
	}

	request.endpoint = encodePathValues(request.endpoint, pathValues);

	// A required ID that resolved to nothing leaves an empty path segment
	// (e.g. /api/v1/courses//assignments), which Canvas answers with a misleading 404.
	const path = request.endpoint.split('?')[0];
	if (/\/\/|\/$|\/(undefined|null|NaN)(\/|$)/.test(path)) {
		const candidates = Array.from(new Set(emptyParams)).filter((name) => /id$|url$|type$|code$/i.test(name));
		throw new NodeOperationError(
			context.getNode(),
			`A required parameter is empty for ${resource}/${operation}`,
			{
				itemIndex,
				description:
					`The request path "${path}" has an empty segment.` +
					(candidates.length > 0 ? ` Check these parameters: ${candidates.join(', ')}.` : '') +
					' If the value comes from an expression, make sure it resolves for every input item.',
			},
		);
	}

	return request;
}
