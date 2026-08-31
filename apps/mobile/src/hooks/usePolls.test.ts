import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePolls, useCreatePoll, useRespondPoll, usePendingQuestions } from './usePolls';
import { pollsService, type Poll } from '../services/polls';
import { eventsService, type Event } from '../services/events';
import { useAuthStore } from '../stores/auth';
import { createWrapper, renderHookWithClient } from '../test/test-utils';
import { formatDateKey } from '../lib/date-utils';

vi.mock('../services/polls', () => ({
  pollsService: {
    list: vi.fn(),
    create: vi.fn(),
    respond: vi.fn(),
  },
}));

vi.mock('../services/events', () => ({
  eventsService: {
    getAll: vi.fn(),
  },
}));

vi.mock('../lib/group-sync', () => ({
  broadcastSync: vi.fn(),
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector: (state: { user: { id: string } | undefined }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
  ),
}));

function createTestPoll(overrides: Partial<Poll> = {}): Poll {
  return {
    id: 'poll-1',
    groupId: 'group-1',
    createdById: 'user-2',
    date: daysFromTodayISO(1),
    slot: null,
    status: 'open',
    createdAt: '2026-07-01T00:00:00Z',
    createdBy: { id: 'user-2', name: 'Misa', avatarEmoji: '😊' },
    responses: [],
    ...overrides,
  };
}

function createTestEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    groupId: 'group-1',
    title: 'Test Event',
    isOnline: false,
    date: '2026-07-15',
    status: 'pending',
    attendees: [],
    createdBy: { id: 'user-2', name: 'Misa' },
    ...overrides,
  };
}

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return formatDateKey(d);
}

// Poll.date arrives from the API as a full ISO datetime (Prisma `DateTime @db.Date`,
// same as Event.date), never as a plain YYYY-MM-DD string. Poll fixtures must use this
// so the tests exercise the real `apiDateToKey` normalization path, not a shape the
// server never actually sends.
function daysFromTodayISO(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${formatDateKey(d)}T00:00:00.000Z`;
}

describe('usePolls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch polls for group', async () => {
    const polls = [createTestPoll()];
    vi.mocked(pollsService.list).mockResolvedValue(polls);

    const { result } = renderHook(() => usePolls('group-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(polls);
    expect(pollsService.list).toHaveBeenCalledWith('group-1');
  });

  it('should not fetch when groupId is empty', () => {
    const { result } = renderHook(() => usePolls(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreatePoll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a poll and invalidate polls + availability', async () => {
    vi.mocked(pollsService.create).mockResolvedValue(createTestPoll());

    const { result, queryClient } = renderHookWithClient(() => useCreatePoll('group-1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.mutate({ date: '2026-07-15', slot: 'Tarde' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pollsService.create).toHaveBeenCalledWith('group-1', {
      date: '2026-07-15',
      slot: 'Tarde',
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['polls', 'group-1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['availability', 'group-1'] });
  });
});

describe('useRespondPoll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should respond to a poll and invalidate polls + availability', async () => {
    vi.mocked(pollsService.respond).mockResolvedValue(createTestPoll());

    const { result, queryClient } = renderHookWithClient(() => useRespondPoll('group-1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.mutate({ pollId: 'poll-1', answer: 'yes' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pollsService.respond).toHaveBeenCalledWith('group-1', 'poll-1', 'yes');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['polls', 'group-1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['availability', 'group-1'] });
  });
});

describe('usePendingQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('excludes polls I already answered and keeps ones I have not', async () => {
    const futureDate = daysFromTodayISO(1);
    const answeredByMe = createTestPoll({
      id: 'poll-answered',
      date: futureDate,
      responses: [
        {
          userId: 'user-1',
          answer: 'yes',
          respondedAt: '2026-07-02T00:00:00Z',
          user: { id: 'user-1', name: 'Alvaro', avatarEmoji: '😊' },
        },
      ],
    });
    const unanswered = createTestPoll({ id: 'poll-unanswered', date: futureDate, responses: [] });

    vi.mocked(pollsService.list).mockResolvedValue([answeredByMe, unanswered]);
    vi.mocked(eventsService.getAll).mockResolvedValue([]);

    const { result } = renderHook(() => usePendingQuestions('group-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.polls).toHaveLength(1));
    expect(result.current.polls[0].id).toBe('poll-unanswered');
  });

  it('excludes polls that are not open', async () => {
    const closedPoll = createTestPoll({ id: 'poll-closed', status: 'closed' });
    const completedPoll = createTestPoll({ id: 'poll-completed', status: 'completed' });
    const openPoll = createTestPoll({ id: 'poll-open', status: 'open' });

    vi.mocked(pollsService.list).mockResolvedValue([closedPoll, completedPoll, openPoll]);
    vi.mocked(eventsService.getAll).mockResolvedValue([]);

    const { result } = renderHook(() => usePendingQuestions('group-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.polls).toHaveLength(1));
    expect(result.current.polls[0].id).toBe('poll-open');
  });

  it('excludes open polls with a date that has already passed, even if unanswered', async () => {
    const pastDate = daysFromTodayISO(-1);
    const futureDate = daysFromTodayISO(1);
    const pastPoll = createTestPoll({ id: 'poll-past', date: pastDate, responses: [] });
    const controlPoll = createTestPoll({ id: 'poll-control', date: futureDate, responses: [] });

    vi.mocked(pollsService.list).mockResolvedValue([pastPoll, controlPoll]);
    vi.mocked(eventsService.getAll).mockResolvedValue([]);

    const { result } = renderHook(() => usePendingQuestions('group-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.polls).toHaveLength(1));
    expect(result.current.polls[0].id).toBe('poll-control');
  });

  it('includes future events where my attendee status is pending', async () => {
    const futureDate = daysFromToday(1);
    const pendingEvent = createTestEvent({
      id: 'event-pending',
      date: futureDate,
      attendees: [
        { userId: 'user-1', status: 'pending', user: { id: 'user-1', name: 'Alvaro', avatarEmoji: '😊' } },
      ],
    });
    const confirmedEvent = createTestEvent({
      id: 'event-confirmed',
      date: futureDate,
      attendees: [
        { userId: 'user-1', status: 'confirmed', user: { id: 'user-1', name: 'Alvaro', avatarEmoji: '😊' } },
      ],
    });

    vi.mocked(pollsService.list).mockResolvedValue([]);
    vi.mocked(eventsService.getAll).mockResolvedValue([pendingEvent, confirmedEvent]);

    const { result } = renderHook(() => usePendingQuestions('group-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.pendingEvents).toHaveLength(1));
    expect(result.current.pendingEvents[0].id).toBe('event-pending');
  });

  it('excludes cancelled events even if my attendee status is pending', async () => {
    const futureDate = daysFromToday(1);
    const cancelledEvent = createTestEvent({
      id: 'event-cancelled',
      date: futureDate,
      status: 'cancelled',
      attendees: [
        { userId: 'user-1', status: 'pending', user: { id: 'user-1', name: 'Alvaro', avatarEmoji: '😊' } },
      ],
    });
    const controlEvent = createTestEvent({
      id: 'event-control',
      date: futureDate,
      attendees: [
        { userId: 'user-1', status: 'pending', user: { id: 'user-1', name: 'Alvaro', avatarEmoji: '😊' } },
      ],
    });

    vi.mocked(pollsService.list).mockResolvedValue([]);
    vi.mocked(eventsService.getAll).mockResolvedValue([cancelledEvent, controlEvent]);

    const { result } = renderHook(() => usePendingQuestions('group-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.pendingEvents).toHaveLength(1));
    expect(result.current.pendingEvents[0].id).toBe('event-control');
  });

  it('excludes past events even if my attendee status is pending', async () => {
    const pastDate = daysFromToday(-1);
    const futureDate = daysFromToday(1);
    const pastEvent = createTestEvent({
      id: 'event-past',
      date: pastDate,
      attendees: [
        { userId: 'user-1', status: 'pending', user: { id: 'user-1', name: 'Alvaro', avatarEmoji: '😊' } },
      ],
    });
    const controlEvent = createTestEvent({
      id: 'event-control',
      date: futureDate,
      attendees: [
        { userId: 'user-1', status: 'pending', user: { id: 'user-1', name: 'Alvaro', avatarEmoji: '😊' } },
      ],
    });

    vi.mocked(pollsService.list).mockResolvedValue([]);
    vi.mocked(eventsService.getAll).mockResolvedValue([pastEvent, controlEvent]);

    const { result } = renderHook(() => usePendingQuestions('group-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.pendingEvents).toHaveLength(1));
    expect(result.current.pendingEvents[0].id).toBe('event-control');
  });

  it('treats today as not-past (inclusive)', async () => {
    const todayKey = daysFromToday(0);
    const todayEvent = createTestEvent({
      id: 'event-today',
      date: todayKey,
      attendees: [
        { userId: 'user-1', status: 'pending', user: { id: 'user-1', name: 'Alvaro', avatarEmoji: '😊' } },
      ],
    });

    vi.mocked(pollsService.list).mockResolvedValue([]);
    vi.mocked(eventsService.getAll).mockResolvedValue([todayEvent]);

    const { result } = renderHook(() => usePendingQuestions('group-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.pendingEvents).toHaveLength(1));
    expect(result.current.pendingEvents[0].id).toBe('event-today');
  });

  describe('without an authenticated user', () => {
    afterEach(() => {
      vi.mocked(useAuthStore).mockImplementation((selector) => selector({ user: { id: 'user-1' } }));
    });

    it('returns empty polls and events', async () => {
      vi.mocked(useAuthStore).mockImplementation((selector) => selector({ user: undefined }));

      vi.mocked(pollsService.list).mockResolvedValue([createTestPoll({ responses: [] })]);
      vi.mocked(eventsService.getAll).mockResolvedValue([
        createTestEvent({
          date: daysFromToday(1),
          attendees: [
            { userId: 'user-1', status: 'pending', user: { id: 'user-1', name: 'Alvaro', avatarEmoji: '😊' } },
          ],
        }),
      ]);

      const { result, queryClient } = renderHookWithClient(() => usePendingQuestions('group-1'));

      await waitFor(() =>
        expect(queryClient.getQueryData(['polls', 'group-1'])).toBeDefined(),
      );
      await waitFor(() =>
        expect(queryClient.getQueryData(['events', 'group-1'])).toBeDefined(),
      );

      expect(result.current.polls).toHaveLength(0);
      expect(result.current.pendingEvents).toHaveLength(0);
    });
  });
});
