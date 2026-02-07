import { ApplicationError } from 'n8n-workflow';
import type { IDataObject } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// SUBMISSION
// ============================================

export function handleSubmissionResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const assignmentId = getParam('assignmentId');

	switch (operation) {
		case 'get':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${getParam('userId')}`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'grade': {
			const gradeFields = getParamObject('gradeFields');
			const body: IDataObject = {};

			// Separate comment fields from submission fields
			const { comment, group_comment, ...submissionFields } = gradeFields;

			if (Object.keys(submissionFields).length > 0) {
				body.submission = submissionFields;
			}

			if (comment) {
				body.comment = { text_comment: comment, ...(group_comment ? { group_comment } : {}) };
			} else if (group_comment) {
				body.comment = { group_comment };
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${getParam('userId')}`,
				method: 'PUT',
				body,
			};
		}

		case 'submit': {
			const submissionType = getParam('submissionType');
			const submissionBody: IDataObject = { submission_type: submissionType };

			switch (submissionType) {
				case 'online_text_entry':
					submissionBody.body = getParam('body');
					break;
				case 'online_url':
					submissionBody.url = getParam('url');
					break;
				case 'basic_lti_launch':
					submissionBody.url = getParam('url');
					break;
				case 'online_upload':
					submissionBody.file_ids = getParam('fileIds').split(',').map(Number);
					break;
				case 'media_recording':
					submissionBody.media_comment_id = getParam('mediaCommentId');
					break;
				case 'student_annotation':
					submissionBody.annotatable_attachment_id = getParam('annotatableAttachmentId');
					break;
				default:
					throw new ApplicationError(`Submission type ${submissionType} is not supported`);
			}

			const additionalFields = getParamObject('additionalFields');

			// Extract comment from additionalFields as it goes in a separate key
			const { comment, ...restFields } = additionalFields;
			const body: IDataObject = {
				submission: { ...submissionBody, ...restFields },
			};

			if (comment) {
				body.comment = { text_comment: comment };
			}

			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
				method: 'POST',
				body,
			};
		}

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${getParam('userId')}`,
				method: 'PUT',
				body: { submission: getParamObject('updateFields') },
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for submission`);
	}
}

// ============================================
// SUBMISSION COMMENT
// ============================================

export function handleSubmissionCommentResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const assignmentId = getParam('assignmentId');
	const userId = getParam('userId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const commentBody: IDataObject = { text_comment: getParam('comment') };

			// Handle file_ids as comma-separated string to array of numbers
			if (additionalFields.file_ids && typeof additionalFields.file_ids === 'string') {
				additionalFields.file_ids = (additionalFields.file_ids as string).split(',').map(Number);
			}

			Object.assign(commentBody, additionalFields);

			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
				method: 'PUT',
				body: { comment: commentBody },
			};
		}

		case 'update':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}/comments/${getParam('commentId')}`,
				method: 'PUT',
				body: { comment: getParam('comment') },
			};

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}/comments/${getParam('commentId')}`,
				method: 'DELETE',
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for submissionComment`);
	}
}

// ============================================
// PEER REVIEW
// ============================================

export function handlePeerReviewResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const courseId = getParam('courseId');
	const assignmentId = getParam('assignmentId');

	switch (operation) {
		case 'getAll':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/peer_reviews`,
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'create':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${getParam('submissionId')}/peer_reviews`,
				method: 'POST',
				body: { user_id: getParam('reviewerUserId') },
			};

		case 'delete':
			return {
				endpoint: `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${getParam('submissionId')}/peer_reviews`,
				method: 'DELETE',
				qs: { user_id: getParam('reviewerUserId') },
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for peerReview`);
	}
}
