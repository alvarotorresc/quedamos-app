import { describe, it, expect } from 'vitest';
import { buildEventEditPayload } from './event-edit-payload';

const base = {
  title: 'Cena',
  location: '',
  time: '',
  endTime: '',
  description: '',
  isOnline: false,
  meetingUrl: '',
};

describe('buildEventEditPayload', () => {
  it('sends null (not omit, not empty string) for a cleared time/endTime', () => {
    const p = buildEventEditPayload({ ...base, time: '', endTime: '' });
    expect(p.time).toBeNull();
    expect(p.endTime).toBeNull();
  });

  it('sends the trimmed time when present', () => {
    const p = buildEventEditPayload({ ...base, time: '18:00', endTime: '20:00' });
    expect(p.time).toBe('18:00');
    expect(p.endTime).toBe('20:00');
  });

  it('clears endTime too when time is cleared, to avoid an end time with no start', () => {
    const p = buildEventEditPayload({ ...base, time: '', endTime: '20:00' });
    expect(p.time).toBeNull();
    expect(p.endTime).toBeNull();
  });

  it('sends null for cleared location and description', () => {
    const p = buildEventEditPayload({ ...base, location: '', description: '' });
    expect(p.location).toBeNull();
    expect(p.description).toBeNull();
  });

  it('sends trimmed location/description when present and presencial', () => {
    const p = buildEventEditPayload({
      ...base,
      location: '  Retiro  ',
      description: '  traer postre ',
    });
    expect(p.location).toBe('Retiro');
    expect(p.description).toBe('traer postre');
  });

  it('never sends a location when online (backend clears it)', () => {
    const p = buildEventEditPayload({ ...base, isOnline: true, location: 'Retiro' });
    expect(p.location).toBeNull();
  });

  it('sends meetingUrl only when online, null when online-but-empty', () => {
    const online = buildEventEditPayload({ ...base, isOnline: true, meetingUrl: 'https://x.y' });
    expect(online.meetingUrl).toBe('https://x.y');

    const onlineEmpty = buildEventEditPayload({ ...base, isOnline: true, meetingUrl: '' });
    expect(onlineEmpty.meetingUrl).toBeNull();

    const presencial = buildEventEditPayload({ ...base, isOnline: false, meetingUrl: 'https://x.y' });
    expect('meetingUrl' in presencial).toBe(false);
  });
});
