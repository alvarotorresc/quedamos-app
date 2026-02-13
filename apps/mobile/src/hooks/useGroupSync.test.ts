import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGroupSync } from './useGroupSync';
import { subscribeToGroup } from '../lib/group-sync';
import { createWrapper } from '../test/test-utils';

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

  it('should resubscribe when groupId changes', () => {
    const unsubscribe = vi.fn();
    vi.mocked(subscribeToGroup).mockReturnValue(unsubscribe);

    const { rerender } = renderHook(
      ({ groupId }: { groupId: string }) => useGroupSync(groupId),
      { wrapper: createWrapper(), initialProps: { groupId: 'g1' } },
    );

    rerender({ groupId: 'g2' });

    expect(unsubscribe).toHaveBeenCalled();
    expect(subscribeToGroup).toHaveBeenCalledTimes(2);
  });
});
