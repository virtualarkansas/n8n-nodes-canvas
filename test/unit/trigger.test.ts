import { describe, expect, it } from 'vitest';
import { idsMatch, parseCanvasEvent, toLocalId } from '../../nodes/Canvas/CanvasTrigger.node.js';
import { canvasLiveEvents } from '../../nodes/Canvas/CanvasTriggerEvents';

describe('trigger: Canvas IDs', () => {
	it('reduces global IDs to local IDs', () => {
		expect(toLocalId('21070000000000565')).toBe('565');
		expect(toLocalId('565')).toBe('565');
		expect(toLocalId(565)).toBe('565');
		expect(toLocalId('sis-abc')).toBe('sis-abc');
		expect(toLocalId(undefined)).toBe('');
	});

	it('matches a local filter against global IDs and the reverse', () => {
		expect(idsMatch('565', '21070000000000565')).toBe(true);
		expect(idsMatch('21070000000000565', '565')).toBe(true);
		expect(idsMatch(' 565 ', 565)).toBe(true);
		expect(idsMatch('565', '21070000000000566')).toBe(false);
		// A filter given as a global ID is exact: the same local ID on another shard is another record.
		expect(idsMatch('21070000000000565', '21070000000000565')).toBe(true);
		expect(idsMatch('70000000000565', '20000000000565')).toBe(false);
		expect(idsMatch('565', '20000000000565')).toBe(true);
		expect(idsMatch('565', undefined)).toBe(false);
		expect(idsMatch('565', '')).toBe(false);
	});
});

describe('trigger: envelopes', () => {
	it('reads the Data Services Canvas format (metadata.event_name)', () => {
		const event = parseCanvasEvent({
			metadata: { event_name: 'grade_change', event_time: '2019-11-01T00:07:59.125Z', context_type: 'Course', context_id: '21070000000000565' },
			body: { submission_id: '21070000000001234', grade: '7' },
		});
		expect(event).toMatchObject({ name: 'grade_change', time: '2019-11-01T00:07:59.125Z', body: { grade: '7' } });
		expect(event?.metadata.context_id).toBe('21070000000000565');
	});

	it('reads raw Live Events stream records (attributes.event_name)', () => {
		const event = parseCanvasEvent({ attributes: { event_name: 'course_created', event_time: 't' }, body: { course_id: '1' } });
		expect(event).toMatchObject({ name: 'course_created', body: { course_id: '1' } });
	});

	it('tolerates a missing or odd body', () => {
		expect(parseCanvasEvent({ metadata: { event_name: 'logged_in' } })?.body).toEqual({});
		expect(parseCanvasEvent({ metadata: { event_name: 'logged_in' }, body: 'text' })?.body).toEqual({});
	});

	it('recognises Caliper deliveries, which have no Canvas event name', () => {
		const event = parseCanvasEvent({
			sensor: 'http://school.instructure.com/',
			sendTime: '2019-11-16T02:09:02.000Z',
			dataVersion: 'http://purl.imsglobal.org/ctx/caliper/v1p1',
			data: [{ type: 'GradeEvent', action: 'Graded', eventTime: '2019-11-16T02:09:00.000Z' }],
		});
		expect(event?.name).toBeUndefined();
		expect(event?.caliper).toBeDefined();
		expect(event?.time).toBe('2019-11-16T02:09:00.000Z');
	});

	it('rejects payloads that are not events', () => {
		expect(parseCanvasEvent({})).toBeUndefined();
		expect(parseCanvasEvent({ hello: 'world' })).toBeUndefined();
		expect(parseCanvasEvent({ metadata: ['x'] })).toBeUndefined();
	});
});

describe('trigger: event list', () => {
	it('offers every event exactly once, alphabetically, plus All Events', () => {
		const values = canvasLiveEvents.map((o) => o.value);
		expect(new Set(values).size).toBe(values.length);
		expect(values).toContain('*');
		for (const name of ['grade_change', 'submission_created', 'enrollment_state_updated', 'course_completed', 'logged_in', 'asset_accessed']) {
			expect(values).toContain(name);
		}
		// These were offered by earlier versions but Canvas never sends them.
		expect(values).not.toContain('course_concluded');
		expect(values).not.toContain('enrollment_concluded');
		const names = canvasLiveEvents.map((o) => o.name.toLowerCase());
		expect(names).toEqual([...names].sort());
	});
});
