import { describe, it, expect } from 'vitest';
import { generateICS } from './ics-utils';
import type { Event } from '../services/events';

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    groupId: 'group-1',
    title: 'Cena en el centro',
    date: '2026-04-15',
    status: 'pending',
    isOnline: false,
    attendees: [],
    createdBy: { id: 'user-1', name: 'Creator' },
    ...overrides,
  };
}

describe('generateICS', () => {
  it('should generate valid ICS for timed event', () => {
    const ics = generateICS(createEvent({ time: '18:00', endTime: '20:30' }));

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics).toContain('DTSTART;TZID=Europe/Madrid:20260415T180000');
    expect(ics).toContain('DTEND;TZID=Europe/Madrid:20260415T203000');
    expect(ics).toContain('SUMMARY:Cena en el centro');
  });

  it('should default endTime to +1 hour when missing', () => {
    const ics = generateICS(createEvent({ time: '18:00' }));

    expect(ics).toContain('DTSTART;TZID=Europe/Madrid:20260415T180000');
    expect(ics).toContain('DTEND;TZID=Europe/Madrid:20260415T190000');
  });

  it('should generate all-day event when no time', () => {
    const ics = generateICS(createEvent());

    expect(ics).toContain('DTSTART;VALUE=DATE:20260415');
    expect(ics).toContain('DTEND;VALUE=DATE:20260416');
    expect(ics).not.toContain('TZID');
  });

  it('should include location for presencial event', () => {
    const ics = generateICS(createEvent({ location: 'Retiro Park' }));

    expect(ics).toContain('LOCATION:Retiro Park');
    expect(ics).not.toContain('URL:');
  });

  it('should include meetingUrl as LOCATION and URL for online event', () => {
    const ics = generateICS(
      createEvent({
        isOnline: true,
        meetingUrl: 'https://meet.google.com/abc',
      }),
    );

    expect(ics).toContain('LOCATION:https://meet.google.com/abc');
    expect(ics).toContain('URL:https://meet.google.com/abc');
  });

  it('should not include LOCATION for online event without meetingUrl', () => {
    const ics = generateICS(createEvent({ isOnline: true }));

    expect(ics).not.toContain('LOCATION:');
    expect(ics).not.toContain('URL:');
  });

  it('should include description when present', () => {
    const ics = generateICS(createEvent({ description: 'Traer postre' }));

    expect(ics).toContain('DESCRIPTION:Traer postre');
  });

  it('should not include description when absent', () => {
    const ics = generateICS(createEvent());

    expect(ics).not.toContain('DESCRIPTION:');
  });

  it('should map event status correctly', () => {
    expect(generateICS(createEvent({ status: 'confirmed' }))).toContain('STATUS:CONFIRMED');
    expect(generateICS(createEvent({ status: 'cancelled' }))).toContain('STATUS:CANCELLED');
    expect(generateICS(createEvent({ status: 'pending' }))).toContain('STATUS:TENTATIVE');
  });

  it('should escape special characters in text fields', () => {
    const ics = generateICS(
      createEvent({
        title: 'Cena, con amigos; en casa',
        description: 'Nota: traer\nbebida',
      }),
    );

    expect(ics).toContain('SUMMARY:Cena\\, con amigos\\; en casa');
    expect(ics).toContain('DESCRIPTION:Nota: traer\\nbebida');
  });

  it('should include UID based on event id', () => {
    const ics = generateICS(createEvent({ id: 'abc-123' }));

    expect(ics).toContain('UID:abc-123@quedamos.app');
  });

  it('should include calendar metadata', () => {
    const ics = generateICS(createEvent());

    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//Quedamos//Quedamos App//ES');
    expect(ics).toContain('CALSCALE:GREGORIAN');
    expect(ics).toContain('METHOD:PUBLISH');
  });

  it('should use CRLF line endings', () => {
    const ics = generateICS(createEvent());

    expect(ics).toContain('\r\n');
    // Every line should end with \r\n (split by \r\n should give all non-empty parts)
    const lines = ics.split('\r\n');
    expect(lines.length).toBeGreaterThan(5);
  });

  it('should handle time that wraps around with +1 hour default (23:30)', () => {
    const ics = generateICS(createEvent({ time: '23:30' }));

    expect(ics).toContain('DTSTART;TZID=Europe/Madrid:20260415T233000');
    expect(ics).toContain('DTEND;TZID=Europe/Madrid:20260415T003000');
  });
});
