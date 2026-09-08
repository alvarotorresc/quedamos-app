import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useEventResponse } from './useEventResponse';
import { eventsService, type Event } from '../services/events';
import { renderHookWithClient } from '../test/test-utils';
import { formatDateKey } from '../lib/date-utils';

vi.mock('../services/events', () => ({
  eventsService: {
    getAll: vi.fn(),
    respond: vi.fn(),
  },
}));

vi.mock('../lib/group-sync', () => ({ broadcastSync: vi.fn() }));
vi.mock('../lib/firebase', () => ({ logEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector: (state: { user: { id: string } | undefined }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
  ),
}));

function dayOffsetKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDateKey(d);
}

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    groupId: 'group-1',
    title: 'Cena en casa de Iris',
    isOnline: false,
    date: dayOffsetKey(3),
    status: 'pending',
    createdBy: { id: 'user-2', name: 'Iris' },
    attendees: [
      { userId: 'user-1', status: 'pending', user: { id: 'user-1', name: 'Vera', avatarEmoji: '😊' } },
    ],
    ...overrides,
  };
}

describe('useEventResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads your own attendance out of the event', () => {
    const { result } = renderHookWithClient(() => useEventResponse(createEvent()));

    expect(result.current.isInvited).toBe(true);
    expect(result.current.myStatus).toBe('pending');
    expect(result.current.isPending).toBe(true);
    expect(result.current.isPastEvent).toBe(false);
    expect(result.current.canRespond).toBe(true);
  });

  it('reports your answer once you have given one', () => {
    const { result } = renderHookWithClient(() =>
      useEventResponse(
        createEvent({
          attendees: [
            {
              userId: 'user-1',
              status: 'confirmed',
              user: { id: 'user-1', name: 'Vera', avatarEmoji: '😊' },
            },
          ],
        }),
      ),
    );

    expect(result.current.myStatus).toBe('confirmed');
    expect(result.current.isPending).toBe(false);
    expect(result.current.canRespond).toBe(true);
  });

  it('does not consider you invited when you are not on the list', () => {
    const { result } = renderHookWithClient(() =>
      useEventResponse(
        createEvent({
          attendees: [
            {
              userId: 'user-9',
              status: 'confirmed',
              user: { id: 'user-9', name: 'Teo', avatarEmoji: '😊' },
            },
          ],
        }),
      ),
    );

    expect(result.current.isInvited).toBe(false);
    expect(result.current.canRespond).toBe(false);
  });

  it('closes responding on a cancelled event', () => {
    const { result } = renderHookWithClient(() =>
      useEventResponse(createEvent({ status: 'cancelled' })),
    );

    expect(result.current.isCancelled).toBe(true);
    expect(result.current.canRespond).toBe(false);
  });

  it('closes responding on an event that already happened', () => {
    const { result } = renderHookWithClient(() =>
      useEventResponse(createEvent({ date: dayOffsetKey(-1) })),
    );

    expect(result.current.isPastEvent).toBe(true);
    expect(result.current.canRespond).toBe(false);
  });

  it('still lets you answer an event happening today', () => {
    const { result } = renderHookWithClient(() =>
      useEventResponse(createEvent({ date: dayOffsetKey(0) })),
    );

    expect(result.current.isPastEvent).toBe(false);
    expect(result.current.canRespond).toBe(true);
  });

  it('sends the answer to the API', async () => {
    vi.mocked(eventsService.respond).mockResolvedValue(createEvent());

    const { result } = renderHookWithClient(() => useEventResponse(createEvent()));
    result.current.respond('confirmed');

    await waitFor(() =>
      expect(eventsService.respond).toHaveBeenCalledWith('group-1', 'event-1', 'confirmed'),
    );
  });

  it('remembers a fresh confirmation so the UI can celebrate it', async () => {
    vi.mocked(eventsService.respond).mockResolvedValue(createEvent());

    const { result } = renderHookWithClient(() => useEventResponse(createEvent()));
    expect(result.current.justConfirmed).toBe(false);

    result.current.respond('confirmed');

    await waitFor(() => expect(result.current.justConfirmed).toBe(true));
  });

  it('does not celebrate a decline', async () => {
    vi.mocked(eventsService.respond).mockResolvedValue(createEvent());

    const { result } = renderHookWithClient(() => useEventResponse(createEvent()));
    result.current.respond('declined');

    await waitFor(() => expect(eventsService.respond).toHaveBeenCalled());
    expect(result.current.justConfirmed).toBe(false);
  });

  // El modal llama al hook antes de saber si hay evento: sin esto rompería las
  // reglas de los hooks al montarse con `event === null`.
  it('survives being called without an event', () => {
    const { result } = renderHookWithClient(() => useEventResponse(null));

    expect(result.current.isInvited).toBe(false);
    expect(result.current.canRespond).toBe(false);
    expect(result.current.myStatus).toBe('pending');
    expect(() => result.current.respond('confirmed')).not.toThrow();
    expect(eventsService.respond).not.toHaveBeenCalled();
  });
});
