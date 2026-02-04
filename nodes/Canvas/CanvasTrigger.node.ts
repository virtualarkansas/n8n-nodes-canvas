import type {
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class CanvasTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Canvas Trigger',
		name: 'canvasTrigger',
		icon: 'file:../../icons/canvas.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Listen for Canvas LMS webhook events',
		defaults: {
			name: 'Canvas Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: [],
				description: 'The events to listen for',
				options: [
					{ name: 'Assignment Created', value: 'assignment_created' },
					{ name: 'Assignment Updated', value: 'assignment_updated' },
					{ name: 'Attachment Created', value: 'attachment_created' },
					{ name: 'Course Concluded', value: 'course_concluded' },
					{ name: 'Course Created', value: 'course_created' },
					{ name: 'Course Updated', value: 'course_updated' },
					{ name: 'Discussion Entry Created', value: 'discussion_entry_created' },
					{ name: 'Discussion Topic Created', value: 'discussion_topic_created' },
					{ name: 'Enrollment Concluded', value: 'enrollment_concluded' },
					{ name: 'Enrollment Created', value: 'enrollment_created' },
					{ name: 'Enrollment Updated', value: 'enrollment_updated' },
					{ name: 'Module Created', value: 'module_created' },
					{ name: 'Module Updated', value: 'module_updated' },
					{ name: 'Quiz Submitted', value: 'quiz_submitted' },
					{ name: 'Submission Created', value: 'submission_created' },
					{ name: 'Submission Graded', value: 'grade_change' },
					{ name: 'Submission Updated', value: 'submission_updated' },
					{ name: 'User Created', value: 'user_created' },
					{ name: 'User Login', value: 'logged_in' },
					{ name: 'User Updated', value: 'user_updated' },
					{ name: 'Wiki Page Created', value: 'wiki_page_created' },
					{ name: 'Wiki Page Updated', value: 'wiki_page_updated' },
				],
			},
			{
				displayName: 'Filter by Course ID',
				name: 'courseId',
				type: 'string',
				default: '',
				description: 'Only trigger for events in this course (leave empty for all courses)',
			},
			{
				displayName: 'Filter by Account ID',
				name: 'accountId',
				type: 'string',
				default: '',
				description: 'Only trigger for events in this account (leave empty for all accounts)',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Include Metadata',
						name: 'includeMetadata',
						type: 'boolean',
						default: true,
						description: 'Whether to include Canvas event metadata in output',
					},
				],
			},
		],
		usableAsTool: true,
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				// Canvas webhooks are configured externally in Canvas Admin
				// This node just provides the endpoint
				// Return true to indicate webhook is always "set up"
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				// Canvas webhooks must be configured in Canvas Admin → Data Services
				// The webhook URL is available via this.getNodeWebhookUrl('default')
				// Users should configure this URL in Canvas Admin → Data Services
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				// Canvas webhooks are managed externally
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData() as IDataObject;
		const events = this.getNodeParameter('events', []) as string[];
		const courseIdFilter = this.getNodeParameter('courseId', '') as string;
		const accountIdFilter = this.getNodeParameter('accountId', '') as string;
		const options = this.getNodeParameter('options', {}) as IDataObject;

		// Canvas Live Events format varies by event type
		// Common fields: metadata.event_type, metadata.event_time, body.*
		const metadata = body.metadata as IDataObject | undefined;
		const eventType = metadata?.event_type as string | undefined;
		const eventBody = body.body as IDataObject | undefined;

		// Check if this event type is in our filter list
		if (events.length > 0 && eventType && !events.includes(eventType)) {
			// Event type not in filter list, ignore
			return { noWebhookResponse: true };
		}

		// Check course filter
		if (courseIdFilter) {
			const courseSisId = eventBody?.course_id as string | undefined;
			const courseIdFromContext = (metadata?.context_id as string) || '';
			if (courseSisId !== courseIdFilter && courseIdFromContext !== courseIdFilter) {
				return { noWebhookResponse: true };
			}
		}

		// Check account filter
		if (accountIdFilter) {
			const accountId = (metadata?.root_account_id as string) || '';
			if (accountId !== accountIdFilter) {
				return { noWebhookResponse: true };
			}
		}

		// Build output
		const output: IDataObject = {
			eventType,
			timestamp: metadata?.event_time || new Date().toISOString(),
			...eventBody,
		};

		if (options.includeMetadata) {
			output.metadata = metadata;
		}

		return {
			workflowData: [this.helpers.returnJsonArray([output])],
		};
	}
}
