import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const syncWidgetGroups = vi.fn();
vi.mock('../lib/widget-bridge', () => ({
  syncWidgetGroups: (...a: unknown[]) => syncWidgetGroups(...a),
}));

import { useWidgetGroupsSync } from './useWidgetGroupsSync';

describe('useWidgetGroupsSync', () => {
  beforeEach(() => syncWidgetGroups.mockClear());

  it('pushes the groups to the native side once loaded', () => {
    const groups = [{ id: 'g1', name: 'Cuadrilla', emoji: '👥' }];
    renderHook(() => useWidgetGroupsSync(groups));
    expect(syncWidgetGroups).toHaveBeenCalledWith([{ id: 'g1', name: 'Cuadrilla', emoji: '👥' }]);
  });

  it('does nothing while groups are still loading', () => {
    renderHook(() => useWidgetGroupsSync(undefined));
    expect(syncWidgetGroups).not.toHaveBeenCalled();
  });

  it('pushes an empty list once loaded so a group you left disappears from the native picker', () => {
    renderHook(() => useWidgetGroupsSync([]));
    expect(syncWidgetGroups).toHaveBeenCalledWith([]);
  });

  it('re-syncs when the group list changes', () => {
    const g1 = [{ id: 'g1', name: 'A', emoji: '👥' }];
    const { rerender } = renderHook(({ g }) => useWidgetGroupsSync(g), { initialProps: { g: g1 } });
    rerender({ g: [...g1, { id: 'g2', name: 'B', emoji: '🎉' }] });
    expect(syncWidgetGroups).toHaveBeenCalledTimes(2);
  });
});
