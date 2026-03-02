import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGroupSync } from './useGroupSync';
import { subscribeToGroup, type SyncResource } from '../lib/group-sync';
import { createWrapper, renderHookWithClient } from '../test/test-utils';

vi.mock('../lib/group-sync', () => ({
  subscribeToGroup: vi.fn().mockReturnValue(vi.fn()),
}));

describe('useGroupSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe to group on mount', () => {
    renderHook(() => useGroupSync('g1'), { wrapper: createWrapper() });

    expect(subscribeToGroup).toHaveBeenCalledWith('g1', expect.any(Function));
  });

  it('should not subscribe when groupId is undefined', () => {
    renderHook(() => useGroupSync(undefined), { wrapper: createWrapper() });

    expect(subscribeToGroup).not.toHaveBeenCalled();
  });

  it('should unsubscribe on unmount', () => {
    const unsubscribe = vi.fn();
    vi.mocked(subscribeToGroup).mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useGroupSync('g1'), { wrapper: createWrapper() });
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should invalidate all relevant queries when members sync is received', () => {
    let capturedCallback: ((resource: SyncResource) => void) | null = null;
    vi.mocked(subscribeToGroup).mockImplementation((_id, cb) => {
      capturedCallback = cb;
      return vi.fn();
    });

    const { queryClient } = renderHookWithClient(() => useGroupSync('g1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    capturedCallback!('members');

    expect(spy).toHaveBeenCalledWith({ queryKey: ['groups'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['groups', 'g1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['events', 'g1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['proposals', 'g1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['availability', 'g1'] });
  });

  it('should invalidate only events when events sync is received', () => {
    let capturedCallback: ((resource: SyncResource) => void) | null = null;
    vi.mocked(subscribeToGroup).mockImplementation((_id, cb) => {
      capturedCallback = cb;
      return vi.fn();
    });

    const { queryClient } = renderHookWithClient(() => useGroupSync('g1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    capturedCallback!('events');

    expect(spy).toHaveBeenCalledWith({ queryKey: ['events', 'g1'] });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should resubscribe when groupId changes', () => {
    const unsubscribe = vi.fn();
    vi.mocked(subscribeToGroup).mockReturnValue(unsubscribe);

    const { rerender } = renderHook(({ groupId }: { groupId: string }) => useGroupSync(groupId), {
      wrapper: createWrapper(),
      initialProps: { groupId: 'g1' },
    });

    rerender({ groupId: 'g2' });

    expect(unsubscribe).toHaveBeenCalled();
    expect(subscribeToGroup).toHaveBeenCalledTimes(2);
  });
});
