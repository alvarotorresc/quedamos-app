import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEvents, useCreateEvent, useRespondEvent } from './useEvents';
import { eventsService } from '../services/events';
import { createWrapper } from '../test/test-utils';

vi.mock('../services/events', () => ({
  eventsService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    respond: vi.fn(),
  },
}));

vi.mock('../lib/group-sync', () => ({
  broadcastSync: vi.fn(),
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({ user: { id: 'user-1' } }),
  ),
}));

describe('useEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch events for group', async () => {
    const events = [{ id: 'e1', title: 'Test' }];
    vi.mocked(eventsService.getAll).mockResolvedValue(events as any);

    const { result } = renderHook(() => useEvents('g1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(events);
  });

  it('should not fetch when groupId is empty', () => {
    const { result } = renderHook(() => useEvents(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateEvent', () => {
  it('should create event', async () => {
    vi.mocked(eventsService.create).mockResolvedValue({ id: 'e1' } as any);

    const { result } = renderHook(() => useCreateEvent('g1'), { wrapper: createWrapper() });

    result.current.mutate({ title: 'Test Event', date: '2026-03-01' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(eventsService.create).toHaveBeenCalledWith('g1', { title: 'Test Event', date: '2026-03-01' });
  });
});

describe('useRespondEvent', () => {
  it('should respond to event with confirmed', async () => {
    vi.mocked(eventsService.respond).mockResolvedValue({ id: 'e1' } as any);
    vi.mocked(eventsService.getAll).mockResolvedValue([]);

    const { result } = renderHook(() => useRespondEvent('g1'), { wrapper: createWrapper() });

    result.current.mutate({ eventId: 'e1', status: 'confirmed' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(eventsService.respond).toHaveBeenCalledWith('g1', 'e1', 'confirmed');
  });

  it('should respond to event with declined', async () => {
    vi.mocked(eventsService.respond).mockResolvedValue({ id: 'e1' } as any);
    vi.mocked(eventsService.getAll).mockResolvedValue([]);

    const { result } = renderHook(() => useRespondEvent('g1'), { wrapper: createWrapper() });

    result.current.mutate({ eventId: 'e1', status: 'declined' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(eventsService.respond).toHaveBeenCalledWith('g1', 'e1', 'declined');
  });
});
