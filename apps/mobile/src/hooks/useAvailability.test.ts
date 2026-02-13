import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAvailability, useMyAvailability, useCreateAvailability, useDeleteAvailability } from './useAvailability';
import { availabilityService } from '../services/availability';
import { createWrapper } from '../test/test-utils';

vi.mock('../services/availability', () => ({
  availabilityService: {
    getAll: vi.fn(),
    getMine: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../lib/group-sync', () => ({
  broadcastSync: vi.fn(),
}));

describe('useAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all availability for group', async () => {
    const items = [{ id: '1', date: '2026-03-01', type: 'day' }];
    vi.mocked(availabilityService.getAll).mockResolvedValue(items as any);

    const { result } = renderHook(() => useAvailability('g1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(items);
  });

  it('should not fetch when groupId is empty', () => {
    const { result } = renderHook(() => useAvailability(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useMyAvailability', () => {
  it('should fetch my availability', async () => {
    const items = [{ id: '1', date: '2026-03-01' }];
    vi.mocked(availabilityService.getMine).mockResolvedValue(items as any);

    const { result } = renderHook(() => useMyAvailability('g1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(items);
  });
});

describe('useCreateAvailability', () => {
  it('should create availability', async () => {
    vi.mocked(availabilityService.create).mockResolvedValue({} as any);

    const { result } = renderHook(() => useCreateAvailability('g1'), { wrapper: createWrapper() });

    result.current.mutate({ date: '2026-03-01', type: 'day' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(availabilityService.create).toHaveBeenCalledWith('g1', { date: '2026-03-01', type: 'day' });
  });
});

describe('useDeleteAvailability', () => {
  it('should delete availability', async () => {
    vi.mocked(availabilityService.delete).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDeleteAvailability('g1'), { wrapper: createWrapper() });

    result.current.mutate('2026-03-01');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(availabilityService.delete).toHaveBeenCalledWith('g1', '2026-03-01');
  });
});
