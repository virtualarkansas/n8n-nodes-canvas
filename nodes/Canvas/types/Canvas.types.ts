import type { IDataObject, IHttpRequestMethods } from 'n8n-workflow';

/**
 * Request configuration returned by resource handlers.
 * Uses Record<string, unknown> for body/qs since handlers build objects
 * that TypeScript cannot narrow to IDataObject at compile time.
 */
export interface IRequestConfig {
	endpoint: string;
	method: IHttpRequestMethods;
	/** A JSON body (object or array), or raw text (e.g. CSV) sent as it is with `contentType`. */
	body?: Record<string, unknown> | unknown[] | string | Buffer;
	/** Content type of a raw text body. Defaults to text/plain. */
	contentType?: string;
	qs?: Record<string, unknown>;
	/**
	 * For endpoints that wrap their result in an object, the key holding it:
	 * `{ "quiz_submissions": [...] }` becomes one item per record, and
	 * `{ "late_policy": {...} }` becomes that record. Applies to reads and writes.
	 */
	dataKey?: string;
	/**
	 * For lists whose records are each wrapped again (`[{ "course": {...} }, ...]`):
	 * the key inside every record that holds the real record.
	 */
	itemKey?: string;
	/**
	 * Always read every page (100 records at a time), whatever the node's Pagination
	 * options say. For endpoints whose pages are not meaningful on their own, such as
	 * summaries that Canvas computes from a paginated list of underlying records.
	 */
	/**
	 * Send the content of this binary property of the input item as the request body
	 * (import files). `prepare` can derive query parameters and the content type from the file.
	 */
	binaryBody?: {
		propertyName: string;
		prepare?: (file: { fileName?: string; mimeType?: string; fileExtension?: string }) => {
			qs?: Record<string, unknown>;
			contentType?: string;
		};
	};
	/**
	 * The request starts Canvas' three-step file upload. `body` holds the upload arguments
	 * (name, parent_folder_path, on_duplicate ...); the file itself comes from a binary
	 * property of the input item or from a URL Canvas fetches. The node runs all steps and
	 * outputs the finished file (or, for a URL upload that is not waited for, its progress).
	 */
	upload?:
		| { source: 'binaryData'; binaryPropertyName: string }
		| { source: 'url'; url: string; waitForCompletion: boolean };
	/**
	 * After the GET, download the file the record points to and attach it to the output
	 * item as binary data. `urlField` names the record's field that holds the download URL
	 * (`url` of a file); the file name and type come from the record when the fields are given.
	 */
	download?: {
		urlField: string;
		binaryPropertyName: string;
		fileNameField?: string;
		contentTypeField?: string;
	};
	fetchAllPages?: boolean;
	/**
	 * The endpoint answers with its complete list whatever page is asked for, while
	 * still announcing further pages: read it once and do not follow them.
	 */
	singlePage?: boolean;
	/**
	 * Reshape the complete list before it becomes items, e.g. to merge entries
	 * that Canvas split across pages.
	 */
	transform?: (records: IDataObject[]) => IDataObject[];
	/**
	 * For a GET that returns one record containing a paginated array (the Link header
	 * pages through that array): the key of the array. All pages are read and the
	 * array is completed, so the record is output once and whole.
	 */
	mergePagedArray?: string;
	/**
	 * Inspect a successful response and throw if it actually reports a failure
	 * (GraphQL answers 200 with an `errors` array).
	 */
	checkResponse?: (data: IDataObject) => void;
	/**
	 * After a successful write, read this endpoint and output its response instead.
	 * For the few calls whose own response does not reflect the change they made.
	 */
	thenGet?: string;
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
	/**
	 * Canvas user to act as (`as_user_id`, masquerading). It lives here because these
	 * options travel with every request made for an item: follow-up pages, the GET after
	 * a write, the steps of an upload.
	 */
	asUserId?: string;
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
	/** Maximum number of items to return (undefined = no item limit) */
	limit?: number;
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
	| 'VALIDATION_ERROR' // 400, 422
	| 'UNAUTHORIZED' // 401
	| 'FORBIDDEN' // 403
	| 'NOT_FOUND' // 404
	| 'CONFLICT' // 409
	| 'RATE_LIMITED' // 429, or 403 "Rate Limit Exceeded" (Canvas' default throttle response)
	| 'SERVER_ERROR' // 500+
	| 'INVALID_PARAMETERS' // rejected by the node before any request was sent
	| 'NETWORK_ERROR' // no HTTP response (DNS, connection refused, timeout)
	| 'UNKNOWN'; // Other

/**
 * Structured error output for error branch
 */
export interface ICanvasErrorOutput {
	error: true;
	/** HTTP status code, or 0 when no HTTP response was received */
	errorCode: number;
	errorType: CanvasErrorType;
	/** Human readable message; Canvas' own message(s) when it sent any */
	errorMessage: string;
	/** Canvas `error_code` / validation `type` of the first reported error, when present */
	canvasErrorCode?: string;
	/** The `errors` payload exactly as Canvas returned it */
	canvasErrors?: unknown;
	/** Canvas' response body when it is a record rather than an error list. */
	responseBody?: unknown;
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
