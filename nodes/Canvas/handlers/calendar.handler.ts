import { ApplicationError } from 'n8n-workflow';
import type { IRequestConfig, GetParam, GetParamObject } from '../types/Canvas.types';

/**
 * Split a comma-separated field into trimmed, non-empty entries.
 * Accepts what the UI and expressions produce: "a, b", an array, or a single number.
 */
function toList(value: unknown): string[] {
	if (value === undefined || value === null) {
		return [];
	}
	const entries = Array.isArray(value) ? value : String(value).split(',');
	return entries.map((entry) => String(entry).trim()).filter((entry) => entry !== '');
}

/** The entries of a fixedCollection with multiple values (`{ <group>: [ {...}, ... ] }`). */
function collectionRows(value: unknown, group: string): Array<Record<string, unknown>> {
	if (value === null || typeof value !== 'object') {
		return [];
	}
	const rows = (value as Record<string, unknown>)[group];
	return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

const isBlank = (value: unknown): boolean => value === undefined || value === null || value === '';

// ============================================
// Calendar Event
// ============================================

/** Section-specific times: rows without a section or without times are dropped. */
function sectionTimes(fields: Record<string, unknown>): void {
	if (fields.child_event_data === undefined) {
		return;
	}
	const rows = collectionRows(fields.child_event_data, 'times')
		.filter((row) => !isBlank(row.context_code) && !isBlank(row.start_at) && !isBlank(row.end_at))
		.map((row) => ({
			context_code: String(row.context_code).trim(),
			start_at: row.start_at,
			end_at: row.end_at,
		}));
	if (rows.length > 0) {
		fields.child_event_data = rows;
	} else {
		delete fields.child_event_data;
	}
}

export function buildCalendarEventRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const eventId = getParam('eventId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');

			// The "Duplicate ..." fields belong together in calendar_event[duplicate].
			const duplicate: Record<string, unknown> = {};
			const eventFields: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(additionalFields)) {
				if (key.startsWith('duplicate_')) {
					duplicate[key.slice('duplicate_'.length)] = value;
				} else {
					eventFields[key] = value;
				}
			}
			sectionTimes(eventFields);

			const calendarEvent: Record<string, unknown> = {
				context_code: getParam('contextCode').trim(),
				title: getParam('title'),
				...eventFields,
			};
			// Frequency, interval and numbering only mean something when copies are requested.
			if (!isBlank(duplicate.count) && Number(duplicate.count) > 0) {
				calendarEvent.duplicate = duplicate;
			}

			return {
				method: 'POST',
				endpoint: '/api/v1/calendar_events',
				body: { calendar_event: calendarEvent },
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/calendar_events/${eventId}`,
				qs: getParamObject('options'),
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/calendar_events/${eventId}`,
			};

		case 'getAll': {
			const options = getParamObject('options');

			// Another user's calendar has its own endpoint; `user_id` is not a filter.
			const userId = String(options.user_id ?? '').trim();
			delete options.user_id;

			const qs: Record<string, unknown> = { ...options };
			const contextCodes = toList(options.context_codes);
			if (contextCodes.length > 0) {
				qs.context_codes = contextCodes;
			} else {
				delete qs.context_codes;
			}
			// Canvas documents `includes[]` but reads `include[]`. (`includes`: workflows saved before the rename.)
			const include = toList(options.include ?? options.includes);
			delete qs.includes;
			if (include.length > 0) {
				qs.include = include;
			} else {
				delete qs.include;
			}

			return {
				method: 'GET',
				endpoint: userId ? `/api/v1/users/${userId}/calendar_events` : '/api/v1/calendar_events',
				qs,
			};
		}

		case 'update': {
			const updateFields = getParamObject('updateFields');
			// `which` is an argument of the request, not an attribute of the event.
			const which = updateFields.which;
			delete updateFields.which;
			sectionTimes(updateFields);
			if (updateFields.remove_child_events !== true) {
				delete updateFields.remove_child_events;
			}

			const body: Record<string, unknown> = { calendar_event: updateFields };
			if (!isBlank(which)) {
				body.which = which;
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/calendar_events/${eventId}`,
				body,
			};
		}

		case 'reserveTimeSlot':
			return {
				method: 'POST',
				endpoint: `/api/v1/calendar_events/${eventId}/reservations`,
				body: getParamObject('options'),
			};

		case 'getTimetable':
			return {
				method: 'GET',
				endpoint: `/api/v1/courses/${getParam('courseId')}/calendar_events/timetable`,
			};

		case 'setTimetable': {
			// Canvas wants the entries grouped by section: { all: [...], "<section ID>": [...] }.
			const timetables: Record<string, Array<Record<string, unknown>>> = {};
			for (const row of collectionRows(getParamObject('timetables'), 'timetable')) {
				const weekdays = toList(row.weekdays);
				if (weekdays.length === 0 || isBlank(row.start_time) || isBlank(row.end_time)) {
					throw new ApplicationError('Every timetable entry needs Weekdays, a Start Time and an End Time');
				}
				const section = isBlank(row.course_section_id) ? 'all' : String(row.course_section_id).trim();
				const entry: Record<string, unknown> = {
					weekdays: weekdays.join(','),
					start_time: row.start_time,
					end_time: row.end_time,
				};
				if (!isBlank(row.location_name)) {
					entry.location_name = row.location_name;
				}
				(timetables[section] ??= []).push(entry);
			}
			if (Object.keys(timetables).length === 0) {
				throw new ApplicationError('Add at least one timetable entry');
			}
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${getParam('courseId')}/calendar_events/timetable`,
				body: { timetables },
			};
		}

		case 'setTimetableEvents': {
			const events = collectionRows(getParamObject('events'), 'event').map((row) => {
				if (isBlank(row.start_at) || isBlank(row.end_at)) {
					throw new ApplicationError('Every timetable event needs a Start At and an End At');
				}
				const event: Record<string, unknown> = { start_at: row.start_at, end_at: row.end_at };
				for (const key of ['code', 'location_name', 'title']) {
					if (!isBlank(row[key])) {
						event[key] = row[key];
					}
				}
				return event;
			});
			if (events.length === 0) {
				throw new ApplicationError('Add at least one timetable event');
			}
			const body: Record<string, unknown> = { events };
			const sectionId = getParam('courseSectionId');
			if (!isBlank(sectionId)) {
				body.course_section_id = sectionId;
			}
			return {
				method: 'POST',
				endpoint: `/api/v1/courses/${getParam('courseId')}/calendar_events/timetable_events`,
				body,
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for calendarEvent`);
	}
}

// ============================================
// Appointment Group
// ============================================

/** Turn the UI fields of an appointment group into what Canvas expects. */
function appointmentGroupAttributes(fields: Record<string, unknown>, operation: 'create' | 'update'): void {
	for (const key of ['context_codes', 'sub_context_codes']) {
		if (fields[key] === undefined) {
			continue;
		}
		const list = toList(fields[key]);
		if (list.length > 0) {
			fields[key] = list;
		} else {
			delete fields[key];
		}
	}

	// Time slots: [[start, end], [start, end], ...]
	if (fields.new_appointments !== undefined) {
		const slots = collectionRows(fields.new_appointments, 'slots')
			.filter((slot) => !isBlank(slot.start_at) && !isBlank(slot.end_at))
			.map((slot) => [slot.start_at, slot.end_at]);
		if (slots.length > 0) {
			fields.new_appointments = slots;
		} else {
			delete fields.new_appointments;
		}
	}

	if (fields.publish !== undefined) {
		if (fields.publish !== true) {
			// Publishing cannot be undone, so "off" simply means "leave as it is".
			delete fields.publish;
		} else if (operation === 'update') {
			// On update Canvas only recognises the literal "1".
			fields.publish = '1';
		}
	}
}

export function buildAppointmentGroupRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const appointmentGroupId = getParam('appointmentGroupId');

	switch (operation) {
		case 'create': {
			const additionalFields = getParamObject('additionalFields');
			appointmentGroupAttributes(additionalFields, 'create');
			return {
				method: 'POST',
				endpoint: '/api/v1/appointment_groups',
				body: {
					appointment_group: {
						context_codes: toList(getParam('contextCodes')),
						title: getParam('title'),
						...additionalFields,
					},
				},
			};
		}

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `/api/v1/appointment_groups/${appointmentGroupId}`,
				qs: getParamObject('options'),
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `/api/v1/appointment_groups/${appointmentGroupId}`,
				qs: getParamObject('options'),
			};

		case 'getAll': {
			const qs = getParamObject('options');
			const contextCodes = toList(qs.context_codes);
			if (contextCodes.length > 0) {
				qs.context_codes = contextCodes;
			} else {
				delete qs.context_codes;
			}
			return {
				method: 'GET',
				endpoint: '/api/v1/appointment_groups',
				qs,
			};
		}

		case 'getNextAppointment': {
			const ids = toList(getParamObject('options').appointment_group_ids);
			return {
				method: 'GET',
				endpoint: '/api/v1/appointment_groups/next_appointment',
				qs: ids.length > 0 ? { appointment_group_ids: ids } : {},
			};
		}

		case 'update': {
			const updateFields = getParamObject('updateFields');
			appointmentGroupAttributes(updateFields, 'update');
			return {
				method: 'PUT',
				endpoint: `/api/v1/appointment_groups/${appointmentGroupId}`,
				body: { appointment_group: updateFields },
			};
		}

		case 'listUserParticipants':
			return {
				method: 'GET',
				endpoint: `/api/v1/appointment_groups/${appointmentGroupId}/users`,
				qs: getParamObject('options'),
			};

		case 'listGroupParticipants':
			return {
				method: 'GET',
				endpoint: `/api/v1/appointment_groups/${appointmentGroupId}/groups`,
				qs: getParamObject('options'),
			};

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

/**
 * Blackout dates are calendar days. A date picker hands over a full timestamp;
 * keep its date part so the day does not depend on how Canvas parses the rest.
 */
function toDay(value: unknown): unknown {
	const match = /^\s*(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/.exec(String(value ?? ''));
	return match ? match[1] : value;
}

export function buildBlackoutDateRequest(
	operation: string,
	getParam: GetParam,
	getParamObject: GetParamObject,
): IRequestConfig {
	const blackoutDateId = getParam('blackoutDateId');

	switch (operation) {
		case 'create':
			return {
				method: 'POST',
				endpoint: `${getBlackoutDateBasePath(getParam)}/blackout_dates`,
				body: {
					blackout_date: {
						event_title: getParam('eventTitle'),
						start_date: toDay(getParam('startDate')),
						end_date: toDay(getParam('endDate')),
					},
				},
				dataKey: 'blackout_date',
			};

		case 'delete':
			return {
				method: 'DELETE',
				endpoint: `${getBlackoutDateBasePath(getParam)}/blackout_dates/${blackoutDateId}`,
			};

		case 'get':
			return {
				method: 'GET',
				endpoint: `${getBlackoutDateBasePath(getParam)}/blackout_dates/${blackoutDateId}`,
				dataKey: 'blackout_date',
			};

		case 'getAll':
			return {
				method: 'GET',
				endpoint: `${getBlackoutDateBasePath(getParam)}/blackout_dates`,
			};

		case 'update': {
			const updateFields = getParamObject('updateFields');
			for (const key of ['start_date', 'end_date']) {
				if (updateFields[key] !== undefined) {
					updateFields[key] = toDay(updateFields[key]);
				}
			}
			return {
				method: 'PUT',
				endpoint: `${getBlackoutDateBasePath(getParam)}/blackout_dates/${blackoutDateId}`,
				body: { blackout_date: updateFields },
				dataKey: 'blackout_date',
			};
		}

		case 'replaceAll': {
			const dates = collectionRows(getParamObject('blackoutDates'), 'dates')
				.filter((row) => !isBlank(row.id) || !isBlank(row.event_title) || !isBlank(row.start_date))
				.map((row) => {
					const entry: Record<string, unknown> = {
						event_title: row.event_title,
						start_date: toDay(row.start_date),
						end_date: toDay(isBlank(row.end_date) ? row.start_date : row.end_date),
					};
					if (!isBlank(row.id)) {
						entry.id = String(row.id).trim();
					}
					return entry;
				});
			if (dates.length === 0) {
				// An empty list would delete every blackout date of the course; Canvas cannot even process it.
				throw new ApplicationError('Add at least one blackout date. To remove blackout dates use the Delete operation.');
			}
			return {
				method: 'PUT',
				endpoint: `/api/v1/courses/${getParam('courseId')}/blackout_dates`,
				body: { blackout_dates: dates },
			};
		}

		default:
			throw new ApplicationError(`Operation ${operation} not implemented for blackoutDate`);
	}
}
