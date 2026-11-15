import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

type Fields = Record<string, unknown>;

/**
 * Turn a comma-separated string (or an array coming from an expression) into
 * a list of trimmed, non-empty strings. Canvas expects real arrays for
 * parameters documented as `name[]`.
 */
function splitList(value: unknown): string[] {
	const parts = Array.isArray(value) ? value : String(value ?? '').split(',');
	return parts.map((part) => String(part).trim()).filter((part) => part !== '');
}

/** File IDs are integers in Canvas; anything that is not a number is a mistake worth reporting. */
function toIdList(value: unknown, label: string): number[] {
	return splitList(value).map((part) => {
		const id = Number(part);
		if (!Number.isInteger(id) || id <= 0) {
			throw new ApplicationError(`${label} must be a comma-separated list of numeric IDs (got "${part}")`);
		}
		return id;
	});
}

function parseJsonField(value: unknown, label: string): unknown {
	if (typeof value !== 'string') {
		return value;
	}
	if (value.trim() === '') {
		return undefined;
	}
	try {
		return JSON.parse(value);
	} catch {
		throw new ApplicationError(`${label} must be valid JSON`);
	}
}

/** IDs are numbers in Canvas; anything else in a list of IDs is a mistake worth reporting. */
function toNumericIdStrings(value: unknown, label: string): string[] {
	return splitList(value).map((part) => {
		if (!/^\d+$/.test(part)) {
			throw new ApplicationError(`${label} must be a comma-separated list of numeric IDs (got "${part}")`);
		}
		return part;
	});
}

/**
 * One entry of `grade_data` (bulk grading): the grade, the rubric assessment and
 * the comment for one student.
 */
function buildGradeData(entry: Fields): Fields {
	const data: Fields = {};
	if (entry.posted_grade !== undefined && entry.posted_grade !== '') {
		data.posted_grade = entry.posted_grade;
	}
	if (entry.excuse === true) {
		data.excuse = true;
	}
	const assessment = parseJsonField(entry.rubric_assessment, 'Rubric Assessment');
	if (assessment !== undefined && assessment !== null) {
		if (typeof assessment !== 'object' || Array.isArray(assessment)) {
			throw new ApplicationError('Rubric Assessment must be a JSON object keyed by rubric criterion ID');
		}
		if (Object.keys(assessment).length > 0) {
			data.rubric_assessment = assessment;
		}
	}

	// A comment is text, files, a media recording, or any combination of them.
	let hasComment = false;
	if (entry.text_comment !== undefined && entry.text_comment !== '') {
		data.text_comment = entry.text_comment;
		hasComment = true;
	}
	const fileIds = toIdList(entry.file_ids, 'Comment File IDs');
	if (fileIds.length > 0) {
		data.file_ids = fileIds;
		hasComment = true;
	}
	const mediaId = String(entry.media_comment_id ?? '').trim();
	if (mediaId) {
		data.media_comment_id = mediaId;
		data.media_comment_type = entry.media_comment_type || 'video';
		hasComment = true;
	}
	if (hasComment && entry.group_comment === true) {
		data.group_comment = true;
	}
	return data;
}

/** The `upload` hint of the Upload File operations: a binary property, or a URL Canvas fetches. */
export function buildUploadSource(getParam: GetParam): NonNullable<IRequestConfig['upload']> {
	return getParam('uploadSource', 'binaryData') === 'url'
		? {
				source: 'url',
				url: getParam('fileUrl'),
				waitForCompletion: getParam('waitForCompletion', 'true') !== 'false',
			}
		: { source: 'binaryData', binaryPropertyName: getParam('binaryPropertyName', 'data') };
}

/**
 * Submissions can be addressed through the course or through one of its
 * sections (which limits lists to the students of that section).
 */
function getSubmissionContextBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType', 'course');

	switch (contextType) {
		case 'course':
			return `/api/v1/courses/${getParam('courseId')}`;
		case 'section':
			return `/api/v1/sections/${getParam('sectionId')}`;
		default:
			throw new ApplicationError(`Unknown submission context type: ${contextType}`);
	}
}

// ============================================
// SUBMISSION
// ============================================

export function handleSubmissionResource(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const assignmentId = getParam('assignmentId');

	// These two only exist per course (the section route of the summary counts the whole course anyway).
	if (operation === 'listGradeableStudents') {
		return {
			endpoint: `/api/v1/courses/${getParam('courseId')}/assignments/${assignmentId}/gradeable_students`,
			method: 'GET',
			qs: getParamObject('options'),
		};
	}
	if (operation === 'listGradeableStudentsMultiple') {
		const assignmentIds = toNumericIdStrings(getParam('assignmentIds'), 'Assignment IDs');
		if (assignmentIds.length === 0) {
			throw new ApplicationError('At least one assignment ID is required for submission listGradeableStudentsMultiple');
		}
		return {
			endpoint: `/api/v1/courses/${getParam('courseId')}/assignments/gradeable_students`,
			method: 'GET',
			qs: { assignment_ids: assignmentIds },
		};
	}
	if (operation === 'getSummary') {
		return {
			endpoint: `/api/v1/courses/${getParam('courseId')}/assignments/${assignmentId}/submission_summary`,
			method: 'GET',
			qs: getParamObject('options'),
		};
	}

	const basePath = getSubmissionContextBasePath(getParam);
	const submissionsPath = `${basePath}/assignments/${assignmentId}/submissions`;
	// One submission: that of a student, or (anonymous grading) the one with a given anonymous ID.
	const submissionPath = (): string =>
		getParam('submissionBy', 'userId') === 'anonymousId'
			? `${basePath}/assignments/${assignmentId}/anonymous_submissions/${getParam('anonymousId')}`
			: `${submissionsPath}/${getParam('userId')}`;

	switch (operation) {
		case 'get':
			return {
				endpoint: submissionPath(),
				method: 'GET',
				qs: getParamObject('options'),
			};

		case 'getAll': {
			const qs: Fields = getParamObject('options');
			if (qs.grouped !== true) {
				delete qs.grouped;
			}
			return { endpoint: submissionsPath, method: 'GET', qs };
		}

		case 'getAllForStudents': {
			const qs: Fields = getParamObject('options');
			// Without student IDs Canvas returns the submissions of the user of the credential.
			const studentIds = splitList(getParam('studentIds'));
			if (studentIds.length > 0) {
				qs.student_ids = studentIds;
			}
			if ('assignment_ids' in qs) {
				const ids = splitList(qs.assignment_ids);
				if (ids.length > 0) {
					qs.assignment_ids = ids;
				} else {
					delete qs.assignment_ids;
				}
			}
			// Canvas groups (and filters) as soon as these parameters are present.
			for (const flag of ['grouped', 'post_to_sis']) {
				if (qs[flag] !== true) {
					delete qs[flag];
				}
			}
			for (const key of ['workflow_state', 'enrollment_state', 'grading_period_id', 'submitted_since', 'graded_since']) {
				if (qs[key] === '' || qs[key] === undefined || qs[key] === null) {
					delete qs[key];
				}
			}
			return { endpoint: `${basePath}/students/submissions`, method: 'GET', qs };
		}

		case 'grade': {
			const gradeFields = getParamObject('gradeFields');
			const body: Fields = {};

			// Comments, the rubric assessment and the grade live in different objects.
			const { comment, group_comment, rubric_assessment, prefer_points_over_scheme, ...submissionFields } = gradeFields;

			if (Object.keys(submissionFields).length > 0) {
				body.submission = submissionFields;
			}

			if (comment) {
				body.comment = { text_comment: comment, ...(group_comment ? { group_comment } : {}) };
			}

			const assessment = parseJsonField(rubric_assessment, 'Rubric Assessment');
			if (assessment !== undefined) {
				body.rubric_assessment = assessment;
			}
			if (prefer_points_over_scheme !== undefined) {
				body.prefer_points_over_scheme = prefer_points_over_scheme;
			}

			return {
				endpoint: submissionPath(),
				method: 'PUT',
				body,
			};
		}

		case 'bulkGrade': {
			const entries = ((getParamObject('grades').gradeValues ?? []) as Fields[]).filter(
				(entry) => String(entry.student_id ?? '').trim() !== '',
			);
			if (entries.length === 0) {
				throw new ApplicationError('At least one grade entry is required for submission bulkGrade');
			}
			const gradeData: Record<string, Fields> = {};
			for (const entry of entries) {
				gradeData[String(entry.student_id).trim()] = buildGradeData(entry);
			}
			return {
				endpoint: `${submissionsPath}/update_grades`,
				method: 'POST',
				body: { grade_data: gradeData },
			};
		}

		case 'bulkGradeMultiple': {
			const entries = ((getParamObject('grades').gradeValues ?? []) as Fields[]).filter(
				(entry) => String(entry.student_id ?? '').trim() !== '' || String(entry.assignment_id ?? '').trim() !== '',
			);
			if (entries.length === 0) {
				throw new ApplicationError('At least one grade entry is required for submission bulkGradeMultiple');
			}
			// grade_data[<assignment ID>][<student ID>]
			const gradeData: Record<string, Record<string, Fields>> = {};
			for (const entry of entries) {
				const assignment = String(entry.assignment_id ?? '').trim();
				const student = String(entry.student_id ?? '').trim();
				if (!assignment || !student) {
					throw new ApplicationError('Every grade entry needs an Assignment ID and a Student ID');
				}
				gradeData[assignment] = { ...(gradeData[assignment] ?? {}), [student]: buildGradeData(entry) };
			}
			return {
				endpoint: `${basePath}/submissions/update_grades`,
				method: 'POST',
				body: { grade_data: gradeData },
			};
		}

		case 'markRead': {
			// Grade, comments and rubric each have their own read state next to the submission's;
			// document annotations and rubric assessments are flags of the student with paths of their own.
			const item = String(getParamObject('options').item ?? '').trim();
			if (item === 'document_annotations' || item === 'rubric_assessments') {
				return {
					endpoint: `${submissionsPath}/${getParam('userId')}/${item}/read`,
					method: 'PUT',
				};
			}
			return {
				endpoint: `${submissionsPath}/${getParam('userId')}/read${item ? `/${item}` : ''}`,
				method: 'PUT',
			};
		}

		case 'getReadState': {
			const item = getParam('readStateItem', 'document_annotations');
			if (item !== 'document_annotations' && item !== 'rubric_assessments') {
				throw new ApplicationError(`Unknown read state item: ${item}`);
			}
			return {
				endpoint: `${submissionsPath}/${getParam('userId')}/${item}/read`,
				method: 'GET',
			};
		}

		case 'bulkMarkRead': {
			const submissionIds = toNumericIdStrings(getParam('submissionIds'), 'Submission IDs');
			if (submissionIds.length === 0) {
				throw new ApplicationError('At least one submission ID is required for submission bulkMarkRead');
			}
			return {
				endpoint: `${basePath}/submissions/bulk_mark_read`,
				method: 'PUT',
				body: { submissionIds },
			};
		}

		case 'clearUnread':
			return {
				endpoint: `${basePath}/submissions/${getParam('userId')}/clear_unread`,
				method: 'PUT',
			};

		case 'uploadFile': {
			const upload = buildUploadSource(getParam);
			const options = getParamObject('options');
			const body: Fields = {};
			if (options.name) {
				body.name = options.name;
			}
			if (options.content_type) {
				body.content_type = options.content_type;
			}
			if (upload.source === 'url') {
				// Left to itself Canvas hands the fetched file in, as the user of the credential.
				const submit = getParam('submitAssignment', 'false') === 'true';
				body.submit_assignment = submit;
				if (submit && options.comment) {
					body.comment = options.comment;
				}
			}
			return {
				endpoint: `${submissionsPath}/${getParam('userId')}/files`,
				method: 'POST',
				body,
				upload,
			};
		}

		case 'markUnread':
			return {
				endpoint: `${submissionsPath}/${getParam('userId')}/read`,
				method: 'DELETE',
			};

		case 'submit': {
			const submissionType = getParam('submissionType');
			const submissionBody: Fields = { submission_type: submissionType };

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
					submissionBody.file_ids = toIdList(getParam('fileIds'), 'File IDs');
					break;
				case 'media_recording':
					// Canvas requires both the ID and the type of the recording.
					submissionBody.media_comment_id = getParam('mediaCommentId');
					submissionBody.media_comment_type = getParam('mediaCommentType', 'video');
					break;
				case 'student_annotation':
					submissionBody.annotatable_attachment_id = getParam('annotatableAttachmentId');
					break;
				default:
					throw new ApplicationError(`Submission type ${submissionType} is not supported`);
			}

			const additionalFields = getParamObject('additionalFields');

			// The comment goes in its own object; everything else belongs to the submission.
			const { comment, ...restFields } = additionalFields;
			if (submissionType !== 'media_recording' || !restFields.media_comment_type) {
				// (Workflows saved before the type became a field of its own still carry it here.)
				delete restFields.media_comment_type;
			}
			if (restFields.group_comment !== true) {
				delete restFields.group_comment;
			}
			for (const key of ['user_id', 'submitted_at']) {
				if (restFields[key] === '' || restFields[key] === undefined || restFields[key] === null) {
					delete restFields[key];
				}
			}
			const body: Fields = {
				submission: { ...submissionBody, ...restFields },
			};

			if (comment) {
				body.comment = { text_comment: comment };
			}

			return {
				endpoint: submissionsPath,
				method: 'POST',
				body,
			};
		}

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
	const submissionPath = `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const commentBody: Fields = { text_comment: getParam('comment') };

			if ('file_ids' in additionalFields) {
				const fileIds = toIdList(additionalFields.file_ids, 'File IDs');
				if (fileIds.length > 0) {
					additionalFields.file_ids = fileIds;
				} else {
					delete additionalFields.file_ids;
				}
			}
			if (!additionalFields.media_comment_id) {
				delete additionalFields.media_comment_id;
				delete additionalFields.media_comment_type;
			}

			Object.assign(commentBody, additionalFields);

			return {
				endpoint: submissionPath,
				method: 'PUT',
				// Comments are added by updating the submission; ask for the comments back so the
				// result carries the ID of the new comment.
				qs: { include: ['submission_comments'] },
				body: { comment: commentBody },
			};
		}

		case 'getAll':
			return {
				endpoint: submissionPath,
				method: 'GET',
				qs: { include: ['submission_comments'] },
				dataKey: 'submission_comments',
			};

		case 'update':
			return {
				endpoint: `${submissionPath}/comments/${getParam('commentId')}`,
				method: 'PUT',
				body: { comment: getParam('comment') },
			};

		case 'delete':
			return {
				endpoint: `${submissionPath}/comments/${getParam('commentId')}`,
				method: 'DELETE',
			};

		case 'uploadFile': {
			// Step 1 of the upload; the file is attached to a comment with Create > File IDs.
			const options = getParamObject('options');
			const body: Fields = {};
			if (options.name) {
				body.name = options.name;
			}
			if (options.content_type) {
				body.content_type = options.content_type;
			}
			return {
				endpoint: `${submissionPath}/comments/files`,
				method: 'POST',
				body,
				upload: buildUploadSource(getParam),
			};
		}

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
	const assignmentId = getParam('assignmentId');

	if (operation === 'allocate') {
		// Only exists per course.
		return {
			endpoint: `/api/v1/courses/${getParam('courseId')}/assignments/${assignmentId}/allocate`,
			method: 'POST',
			qs: getParamObject('options'),
		};
	}

	// Peer reviews can be addressed through the course or through one of its sections.
	const assignmentPath = `${getSubmissionContextBasePath(getParam)}/assignments/${assignmentId}`;

	switch (operation) {
		case 'getAll': {
			const qs: Fields = getParamObject('options');
			// Reviews of one submission have their own path.
			const submissionId = String(qs.submission_id ?? '').trim();
			delete qs.submission_id;
			return {
				endpoint: submissionId
					? `${assignmentPath}/submissions/${submissionId}/peer_reviews`
					: `${assignmentPath}/peer_reviews`,
				method: 'GET',
				qs,
			};
		}

		case 'create':
			return {
				endpoint: `${assignmentPath}/submissions/${getParam('submissionId')}/peer_reviews`,
				method: 'POST',
				body: { user_id: getParam('reviewerUserId') },
			};

		case 'delete':
			return {
				endpoint: `${assignmentPath}/submissions/${getParam('submissionId')}/peer_reviews`,
				method: 'DELETE',
				qs: { user_id: getParam('reviewerUserId') },
			};

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for peerReview`);
	}
}
