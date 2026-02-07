import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

// ============================================
// Calendar Event
// ============================================

export function buildCalendarEventRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const eventId = getParam('eventId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');

			// Separate duplicate fields from calendar_event fields
			const duplicateFields: Record<string, unknown> = {};
			const eventFields: Record<string, unknown> = {};

			for (const [key, value] of Object.entries(additionalFields)) {
				if (key.startsWith('duplicate_')) {
					// Strip the 'duplicate_' prefix for the API
					duplicateFields[key.replace('duplicate_', '')] = value;
				} else {
					eventFields[key] = value;
				}
			}

			const body: Record<string, unknown> = {
				calendar_event: {
					context_code: getParam('contextCode'),
					title: getParam('title'),
					...eventFields,
				},
			};

			if (Object.keys(duplicateFields).length > 0) {
				body.calendar_event_duplicate = duplicateFields;
			}

			return {
				method: 'POST',
				endpoint: '/api/v1/calendar_events',
				body,
			};
		}

		case 'delete': {
			const options = getParamObject('options');
			return {
				method: 'DELETE',
				endpoint: `/api/v1/calendar_events/${eventId}`,
				qs: options,
			};
		}

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/calendar_events/${eventId}`,
			};

		case 'getAll': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			// Handle context_codes as an array parameter
			if (options.context_codes) {
				const codes = (options.context_codes as string).split(',').map((code) => code.trim());
				qs['context_codes[]'] = codes;
				delete options.context_codes;
			}

			// Handle excludes as an array parameter
			if (options.excludes) {
				qs['excludes[]'] = options.excludes;
				delete options.excludes;
			}

			// Handle includes as an array parameter
			if (options.includes) {
				qs['includes[]'] = options.includes;
				delete options.includes;
			}

			return {
				method: 'GET',
				endpoint: '/api/v1/calendar_events',
				qs: { ...options, ...qs },
			};
		}

		case 'update': {
			const updateFields = getParamObject('updateFields');
			return {
				method: 'PUT',
				endpoint: `/api/v1/calendar_events/${eventId}`,
				body: { calendar_event: updateFields },
			};
		}

		case 'reserveTimeSlot': {
			const options = getParamObject('options');
			return {
				method: 'POST',
				endpoint: `/api/v1/calendar_events/${eventId}/reservations`,
				body: options,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for calendarEvent`);
	}
}

// ============================================
// Appointment Group
// ============================================

export function buildAppointmentGroupRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const appointmentGroupId = getParam('appointmentGroupId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			const contextCodesStr = getParam('contextCodes');
			const contextCodes = contextCodesStr.split(',').map((code) => code.trim());

			// Handle sub_context_codes if provided
			let subContextCodes: string[] | undefined;
			if (additionalFields.sub_context_codes) {
				subContextCodes = (additionalFields.sub_context_codes as string)
					.split(',')
					.map((code) => code.trim());
				delete additionalFields.sub_context_codes;
			}

			const body: Record<string, unknown> = {
				appointment_group: {
					context_codes: contextCodes,
					title: getParam('title'),
					...additionalFields,
					...(subContextCodes ? { sub_context_codes: subContextCodes } : {}),
				},
			};

			return {
				method: 'POST',
				endpoint: '/api/v1/appointment_groups',
				body,
			};
		}

		case 'delete': {
			const options = getParamObject('options');
			return {
				method: 'DELETE',
				endpoint: `/api/v1/appointment_groups/${appointmentGroupId}`,
				qs: options,
			};
		}

		case 'get': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			// Handle include as an array parameter
			if (options.include) {
				qs['include[]'] = options.include;
				delete options.include;
			}

			return {
				method: 'GET',
				endpoint: `/api/v1/appointment_groups/${appointmentGroupId}`,
				qs: { ...options, ...qs },
			};
		}

		case 'getAll': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			// Handle context_codes as an array parameter
			if (options.context_codes) {
				const codes = (options.context_codes as string).split(',').map((code) => code.trim());
				qs['context_codes[]'] = codes;
				delete options.context_codes;
			}

			// Handle include as an array parameter
			if (options.include) {
				qs['include[]'] = options.include;
				delete options.include;
			}

			return {
				method: 'GET',
				endpoint: '/api/v1/appointment_groups',
				qs: { ...options, ...qs },
			};
		}

		case 'getNextAppointment': {
			const options = getParamObject('options');
			const qs: Record<string, unknown> = {};

			// Handle appointment_group_ids as an array parameter
			if (options.appointment_group_ids) {
				const ids = (options.appointment_group_ids as string)
					.split(',')
					.map((id) => id.trim());
				qs['appointment_group_ids[]'] = ids;
				delete options.appointment_group_ids;
			}

			return {
				method: 'GET',
				endpoint: '/api/v1/appointment_groups/next_appointment',
				qs: { ...options, ...qs },
			};
		}

		case 'update': {
			const updateFields = getParamObject('updateFields');

			// Handle context_codes if provided as comma-separated string
			if (updateFields.context_codes) {
				updateFields.context_codes = (updateFields.context_codes as string)
					.split(',')
					.map((code) => code.trim());
			}

			// Handle sub_context_codes if provided as comma-separated string
			if (updateFields.sub_context_codes) {
				updateFields.sub_context_codes = (updateFields.sub_context_codes as string)
					.split(',')
					.map((code) => code.trim());
			}

			return {
				method: 'PUT',
				endpoint: `/api/v1/appointment_groups/${appointmentGroupId}`,
				body: { appointment_group: updateFields },
			};
		}

		case 'listUserParticipants': {
			const options = getParamObject('options');
			return {
				method: 'GET',
				endpoint: `/api/v1/appointment_groups/${appointmentGroupId}/users`,
				qs: options,
			};
		}

		case 'listGroupParticipants': {
			const options = getParamObject('options');
			return {
				method: 'GET',
				endpoint: `/api/v1/appointment_groups/${appointmentGroupId}/groups`,
				qs: options,
			};
		}

		default:
			throw new ApplicationError(
				`Operation ${operation} not implemented for appointmentGroup`,
			);
	}
}

// ============================================
// Blackout Date
// ============================================

function getBlackoutDateBasePath(getParam: GetParam): string {
	const contextType = getParam('contextType');
	if (contextType === 'account') {
		return `/api/v1/accounts/${getParam('accountId')}`;
	}
	return `/api/v1/courses/${getParam('courseId')}`;
}

export function buildBlackoutDateRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const basePath = getBlackoutDateBasePath(getParam);
	const blackoutDateId = getParam('blackoutDateId');

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: `${basePath}/blackout_dates`,
				body: {
					blackout_date: {
						event_title: getParam('eventTitle'),
						start_date: getParam('startDate'),
						end_date: getParam('endDate'),
					},
				},
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${basePath}/blackout_dates/${blackoutDateId}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `${basePath}/blackout_dates/${blackoutDateId}`,
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${basePath}/blackout_dates`,
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			return {
				method: 'PUT',
				endpoint: `${basePath}/blackout_dates/${blackoutDateId}`,
				body: { blackout_date: updateFields },
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for blackoutDate`);
	}
}
