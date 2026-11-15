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
	canvasDownload,
	decodePathValue,
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
	pause,
	tagError,
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
								description:
									'Retry throttled requests, server errors and connection failures with backoff, then output to the Error branch. A write (create, update, delete) is only repeated when Canvas cannot have carried it out.',
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
						description:
							'Number of items Canvas is asked for per request (max 100). With the Limit of a list operation left at 50, setting this or Max Pages makes the node read up to Max Pages pages of this size instead.',
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
						description:
							'Maximum pages to fetch (0 = unlimited). Used for operations without a Limit field, and for list operations whose Limit is left at 50 when this or Items Per Page is set.',
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
		// Attached to an AI agent ("Canvas LMS Tool") the node has one output, and n8n hands the
		// agent the first one only: failed items and debug requests join it, so the agent learns
		// what went wrong instead of receiving nothing.
		const asTool = this.getNode().type.endsWith('Tool');
		// n8n's own node setting "On Error: Continue (using error output)" adds an output of its
		// own and moves there every item shaped { error, message } (it would reduce an item that
		// carries an error object to the bare message). With that setting chosen, failed items
		// take that shape, with the node's whole error record under "error", so they arrive where
		// the user asked for them without losing anything.
		const viaN8nErrorOutput = this.getNode().onError === 'continueErrorOutput';
		const failedItem = (error: ICanvasErrorOutput, itemIndex: number): INodeExecutionData => ({
			json: viaN8nErrorOutput
				? { error: error as unknown as IDataObject, message: error.errorMessage || 'The Canvas request failed' }
				: (error as unknown as IDataObject),
			pairedItem: { item: itemIndex },
		});

		// Get options
		const errorHandlingRaw = this.getNodeParameter('errorHandling', 0, {}) as IDataObject;
		const errorHandling: IErrorHandlingOptions = {
			onError: (errorHandlingRaw.onError as IErrorHandlingOptions['onError']) || DEFAULT_ERROR_HANDLING_OPTIONS.onError,
			maxRetries: toNumber(errorHandlingRaw.maxRetries, DEFAULT_ERROR_HANDLING_OPTIONS.maxRetries, 0),
		};

		const paginationRaw = this.getNodeParameter('pagination', 0, {}) as IDataObject;
		const nodeReturnAll = paginationRaw.returnAll === true;
		const isSet = (value: unknown): boolean => value !== undefined && value !== null && value !== '';
		const pagination: INodePagination = {
			enabled: true,
			// Fetching everything is far cheaper with full pages unless a size was chosen explicitly.
			perPage: toNumber(
				paginationRaw.perPage,
				nodeReturnAll ? CANVAS_MAX_PER_PAGE : DEFAULT_PAGINATION_OPTIONS.perPage,
				1,
			),
			maxPages: nodeReturnAll ? 0 : toNumber(paginationRaw.maxPages, DEFAULT_PAGINATION_OPTIONS.maxPages, 0),
			returnAll: nodeReturnAll,
			perPageSet: isSet(paginationRaw.perPage),
			pagesSet: isSet(paginationRaw.perPage) || isSet(paginationRaw.maxPages),
		};
		// Lists that were cut short, for the hint shown with the output.
		const cutShort: ICutShort = { count: 0, hasLimitField: false };

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
						errorItems.push(failedItem(built.error, i));
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

				// What a real run does beyond this one request, in the order it happens.
				const notes: string[] = [];
				if (request.upload) {
					notes.push('This is Step 1 of 3. Steps 2 (multipart upload) and 3 (confirmation) are handled automatically at runtime.');
				}
				if (request.poll) {
					notes.push(`Repeated every ${request.poll.intervalSeconds} seconds until the job is finished, for at most ${request.poll.timeoutSeconds} seconds.`);
				}
				if (request.download) {
					notes.push(`Then the file is downloaded from the "${request.download.urlField}" of the answer and attached as binary property "${request.download.binaryPropertyName}".`);
				}
				if (request.thenGet) {
					notes.push(`Then ${request.thenGet} is read, and that record is the output.`);
				}
				if (notes.length > 0) {
					debugJson._note = notes.join(' ');
				}

				debugItems.push({ json: debugJson, pairedItem: { item: i } });
			}

			return asTool ? [[...errorItems, ...debugItems]] : [[], errorItems, debugItems];
		}

		const collect = (result: IProcessResult): void => {
			if (result.success) {
				successItems.push(...result.items);
			} else if (result.error) {
				errorItems.push(failedItem(result.error, result.itemIndex));
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
							cutShort,
						),
					),
				);

				results.forEach(collect);

				if (i + batch.batchSize < items.length && batch.batchDelay > 0) {
					await pause(this, batch.batchDelay);
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
						cutShort,
					),
				);
			}
		}

		if (cutShort.count > 0) {
			// Never let a partial list pass for a complete one.
			const lists = cutShort.count === 1 ? 'The list' : `${cutShort.count} lists`;
			const remedy = cutShort.hasLimitField
				? 'Turn on Return All or raise the Limit to get all of them.'
				: 'Turn on Pagination > Return All (or raise Max Pages) to get all of them.';
			const message = `${lists} returned by Canvas LMS ${cutShort.count === 1 ? 'is' : 'are'} incomplete: Canvas has more records than were read. ${remedy}`;
			this.addExecutionHints?.({ message, type: 'warning', location: 'outputPane' });
			// The hint is only seen in the editor; a run nobody watches leaves a line in n8n's log.
			this.logger?.warn(`${this.getNode().name} (${resource}/${operation}): ${message}`);
		}

		return asTool ? [[...successItems, ...errorItems]] : [successItems, errorItems];
	}
}

/** The node-level Pagination options, with what the user set explicitly. */
interface INodePagination extends IPaginationOptions {
	/** Pagination > Return All is on. */
	returnAll: boolean;
	/** Pagination > Items Per Page was set. */
	perPageSet: boolean;
	/** Pagination > Items Per Page or Max Pages was set. */
	pagesSet: boolean;
}

/** Lists that ended before Canvas ran out of records. */
interface ICutShort {
	count: number;
	/** One of them was limited by the operation's own Limit field. */
	hasLimitField: boolean;
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

	if (data instanceof OutputItem) {
		return [data.item];
	}
	if (Array.isArray(data)) {
		return data.map(wrap);
	}
	if (data === undefined || data === null || data === '') {
		return [{ json: { success: true }, pairedItem }];
	}
	return [wrap(data)];
}

/** A finished output item (JSON plus binary data), passed through `toOutputItems` unchanged. */
class OutputItem {
	constructor(readonly item: INodeExecutionData) {}
}

/** Download the file a record points to and return the record with the file attached as binary data. */
async function downloadTo(
	context: IExecuteFunctions,
	itemIndex: number,
	record: IDataObject,
	download: NonNullable<IRequestConfig['download']>,
	rateLimit: IRateLimitOptions,
): Promise<OutputItem | IDataObject> {
	// Fields may be nested: "attachment.url".
	const field = (path?: string): unknown =>
		path?.split('.').reduce<unknown>((value, key) => (value as IDataObject | undefined)?.[key], record);
	const url = field(download.urlField);
	if (typeof url !== 'string' || url === '') {
		if (download.optional) {
			return record;
		}
		throw new NodeOperationError(context.getNode(), 'Canvas did not provide a download URL for this file', {
			itemIndex,
			description: `The record has no "${download.urlField}". Locked or hidden files, and files the user of the credential may not download, come without one.`,
		});
	}
	const file = await canvasDownload.call(context, url, rateLimit, itemIndex);
	const fileName = field(download.fileNameField) as string | undefined;
	const recordType = field(download.contentTypeField) as string | undefined;
	const binary = await context.helpers.prepareBinaryData(file.data, fileName || undefined, recordType || file.contentType);
	return new OutputItem({
		json: record,
		binary: { [download.binaryPropertyName]: binary },
		pairedItem: { item: itemIndex },
	});
}

/**
 * "Wait for Completion": read the record again and again until it reports that the
 * background job is over, and output that final record.
 */
async function waitUntilFinished(
	context: IExecuteFunctions,
	itemIndex: number,
	request: IRequestConfig,
	query: IDataObject | undefined,
	rateLimit: IRateLimitOptions,
): Promise<unknown> {
	const poll = request.poll as NonNullable<IRequestConfig['poll']>;
	const intervalMs = Math.max(1, poll.intervalSeconds) * 1000;
	const deadline = Date.now() + Math.max(0, poll.timeoutSeconds) * 1000;
	for (;;) {
		const response = await canvasApiRequest.call(context, 'GET', request.endpoint, undefined, query, rateLimit);
		const record = unwrapRecord(response.data, request.dataKey) as IDataObject;
		if (poll.isFinished(record ?? {})) {
			return record;
		}
		if (Date.now() + intervalMs > deadline) {
			const state = record?.workflow_state ?? record?.status;
			throw tagError(
				new NodeOperationError(context.getNode(), `Still not finished after ${poll.timeoutSeconds} seconds`, {
					itemIndex,
					description:
						(state !== undefined ? `Last state: ${String(state)}. ` : '') +
						'The job keeps running in Canvas. Raise the Timeout, or run this operation again later.',
				}),
				'TIMEOUT',
			);
		}
		await pause(context, intervalMs);
	}
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
	nodePagination: INodePagination,
	nodeRateLimit: IRateLimitOptions,
	cutShort: ICutShort,
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

			// Canvas' three-step file upload: the request is step 1, the node runs the rest.
			if (request.upload) {
				const step1Body = { ...((bodyData as IDataObject | undefined) || {}) } as IDataObject;

				if (request.upload.source === 'binaryData') {
					const { binaryPropertyName } = request.upload;
					const binaryData = context.helpers.assertBinaryData(itemIndex, binaryPropertyName);
					const binaryBuffer = await context.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
					if (binaryBuffer.length === 0) {
						throw new NodeOperationError(context.getNode(), 'The file to upload is empty', {
							itemIndex,
							description: `The binary property "${binaryPropertyName}" holds no data. Canvas does not accept empty files.`,
						});
					}

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
						{
							data: binaryBuffer,
							fileName: binaryData.fileName,
							mimeType: binaryData.mimeType,
						},
						rateLimit,
					);
				}

				const fileUrl = request.upload.url;
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
					request.upload.waitForCompletion,
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

			if (request.method === 'GET' && request.poll) {
				const finished = await waitUntilFinished(context, itemIndex, request, qsData, rateLimit);
				return request.download
					? downloadTo(context, itemIndex, finished as IDataObject, request.download, rateLimit)
					: finished;
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
					request.pageTransform,
				);
				// Reading stopped at the default Limit or at the page budget while Canvas has more.
				// A Limit the user set on purpose is no surprise and needs no warning.
				if (response.more && !request.singlePage && (pagination.limit === undefined || pagination.limit === DEFAULT_LIMIT)) {
					cutShort.count++;
					cutShort.hasLimitField ||= pagination.limit !== undefined;
				}
				if (!response.isList) {
					const record = unwrapRecord(response.items[0], request.dataKey);
					if (request.checkResponse) {
						request.checkResponse(record as IDataObject);
					}
					if (request.download) {
						return downloadTo(context, itemIndex, record as IDataObject, request.download, rateLimit);
					}
					if (request.responseFile && typeof record === 'string') {
						// A file delivered as text: keep the text and attach the file.
						const { fileName, mimeType, binaryPropertyName } = request.responseFile;
						const binary = await context.helpers.prepareBinaryData(Buffer.from(record, 'utf8'), fileName, mimeType);
						return new OutputItem({
							json: { value: record },
							binary: { [binaryPropertyName ?? 'data']: binary },
							pairedItem: { item: itemIndex },
						});
					}
					// One record that is better read as several items (a nested summary).
					return request.transform && record && typeof record === 'object'
						? request.transform([record as IDataObject])
						: record;
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

/** The default of every Limit field (n8n's convention). */
const DEFAULT_LIMIT = 50;

/**
 * How much of a list an operation reads.
 *
 *  1. Everything, when Return All is on: the operation's own field or Pagination > Return All.
 *  2. Otherwise the operation's Limit, when the user changed it: so many records, in pages of
 *     Pagination > Items Per Page if that is set, else in as few requests as possible.
 *  3. With the Limit left at its default: when Pagination > Items Per Page or Max Pages is set,
 *     those decide (pages of that size, up to that many pages). A workflow saved before the
 *     operations had a Limit field has exactly this, and must keep returning what it returned.
 *  4. Otherwise the default Limit.
 *
 * An operation without Return All / Limit fields follows the node-level options alone.
 */
function resolvePagination(
	context: IExecuteFunctions,
	itemIndex: number,
	nodePagination: INodePagination,
): IPaginationOptions {
	const { enabled, perPage, maxPages } = nodePagination;
	const nodeLevel: IPaginationOptions = { enabled, perPage, maxPages };
	let returnAll: unknown;
	let limit: unknown;
	try {
		returnAll = context.getNodeParameter('returnAll', itemIndex, null);
		limit = context.getNodeParameter('limit', itemIndex, null);
	} catch {
		return nodeLevel;
	}
	if (returnAll === null || returnAll === undefined) {
		return nodeLevel;
	}
	if (returnAll === true || nodePagination.returnAll) {
		return { enabled, perPage: nodePagination.perPageSet ? perPage : CANVAS_MAX_PER_PAGE, maxPages: 0 };
	}
	const itemLimit = toNumber(limit, DEFAULT_LIMIT, 1);
	if (itemLimit === DEFAULT_LIMIT && nodePagination.pagesSet) {
		return nodeLevel;
	}
	return {
		enabled,
		perPage: nodePagination.perPageSet ? perPage : Math.min(CANVAS_MAX_PER_PAGE, itemLimit),
		maxPages: 0,
		limit: itemLimit,
	};
}

/** Top-level parameters of a resource that are JSON fields: a list given to one stays JSON. */
const jsonParameterCache = new Map<string, Set<string>>();
function jsonParameterNames(resource: string): Set<string> {
	let names = jsonParameterCache.get(resource);
	if (!names) {
		const fields = canvasResources.find((entry) => entry.value === resource)?.fields ?? [];
		names = new Set(fields.filter((field) => field.type === 'json').map((field) => field.name));
		jsonParameterCache.set(resource, names);
	}
	return names;
}

/**
 * The request an operation makes for one item: the handler's request, with the parameters
 * read, trimmed and encoded the way every caller must see them. Exported so that the test
 * tools (route audit, request snapshot, `describe`) look at exactly what the node sends.
 */
export function buildRequest(
	context: Pick<IExecuteFunctions, 'getNodeParameter' | 'getNode'>,
	resource: string,
	operation: string,
	itemIndex: number,
): IRequestConfig {
	const emptyParams: string[] = [];
	// Values handed to the handler, by parameter; any of them may end up as a path segment.
	const pathValues = new Map<string, string>();
	const jsonParams = jsonParameterNames(resource);

	// Parameters hidden for the current operation resolve to the default; expression
	// errors are real errors and must surface instead of silently becoming ''.
	const getParam = (name: string, defaultValue: string = ''): string => {
		const value = context.getNodeParameter(name, itemIndex, defaultValue) as unknown;
		if (value === undefined || value === null || value === '') {
			emptyParams.push(name);
			return defaultValue;
		}
		// Whatever shape the value arrives in (an expression hands over lists and objects as they
		// are), the text the handler receives is remembered: any of it may end up in the path.
		const remember = (text: string): string => {
			pathValues.set(name, text);
			return text;
		};
		if (Array.isArray(value)) {
			// A list for a JSON field, or a list of records, stays JSON (it came from an
			// expression); a list of plain values for any other field becomes "a,b,c".
			return remember(
				jsonParams.has(name) || value.some((entry) => entry !== null && typeof entry === 'object')
					? JSON.stringify(value)
					: value.map((entry) => String(entry)).join(','),
			);
		}
		if (typeof value === 'object') {
			return remember(JSON.stringify(value));
		}
		// IDs arrive as numbers when they come from an expression, and pasted IDs often
		// carry stray whitespace. Free text is passed through untouched.
		return remember(/id$/i.test(name) ? String(value).trim() : String(value));
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

	for (const name of request.encodedParams ?? []) {
		pathValues.delete(name);
	}
	// A handler may have trimmed a value before using it: look for that form too.
	const values = [...pathValues.values()].flatMap((value) => [value, value.trim()]);
	const refuse = (path: string, why: string): never => {
		throw new NodeOperationError(
			context.getNode(),
			`A parameter of ${resource}/${operation} is not a valid ID: it would change the path of the request`,
			{ itemIndex, description: `The request path "${path}" must not contain ${why}.` },
		);
	};
	// The same for the path of the request itself and of the read that follows a write.
	const safePath = (endpoint: string): string => {
		if (/^https?:\/\//i.test(endpoint)) {
			return endpoint;
		}
		const encoded = encodePathValues(endpoint, values);
		// No handler builds a path with a query string or a fragment (parameters travel in `qs`),
		// so a "?" or "#" can only have come from a value that escaped the encoding above. The
		// Custom API Request is the exception: its path is the user's own text.
		if (resource !== 'apiRequest' && /[?#]/.test(encoded)) {
			refuse(encoded, '"?" or "#"');
		}
		// "." and ".." as a path segment, however they are written (`%2e%2e`, with a backslash),
		// would let an input value move the request to another path: HTTP clients and servers
		// resolve them. Every segment of the finished path is checked, whoever put it there.
		const builtPath = encoded.split(/[?#]/)[0];
		// Decoded as well: a proxy in front of Canvas may resolve `..%2F..` after decoding it.
		const relative = builtPath
			.split(/[/\\]/)
			.some((segment) => decodePathValue(segment).split(/[/\\]/).some((part) => /^\.{1,2}$/.test(part)));
		if (relative || builtPath.includes('\\')) {
			refuse(builtPath, 'relative segments ("." or "..") or backslashes');
		}
		return encoded;
	};
	request.endpoint = safePath(request.endpoint);
	if (request.thenGet) {
		request.thenGet = safePath(request.thenGet);
	}

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
