import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAutoSelectGroup } from './useAutoSelectGroup';
import { useGroupStore } from '../stores/group';
import type { Group } from '../services/groups';

function group(id: string, name = id): Group {
  return { id, name, emoji: '👥', createdById: 'user-1', createdAt: '2026-01-01T00:00:00.000Z' };
}

describe('useAutoSelectGroup', () => {
  beforeEach(() => {
    useGroupStore.setState({ currentGroup: null, groups: [] });
    vi.mocked(localStorage.getItem).mockReturnValue(null);
  });

  it('selecciona el grupo del deep link si existe entre los grupos del usuario', () => {
    const groups = [group('g1'), group('g2')];

    renderHook(() => useAutoSelectGroup(groups, 'g2'));

    expect(useGroupStore.getState().currentGroup?.id).toBe('g2');
  });

  it('un groupId de deep link que no pertenece al usuario cae al grupo persistido', () => {
    const groups = [group('g1'), group('g2')];
    vi.mocked(localStorage.getItem).mockReturnValue('g2');

    renderHook(() => useAutoSelectGroup(groups, 'not-a-real-group'));

    expect(useGroupStore.getState().currentGroup?.id).toBe('g2');
  });

  it('sin deep link ni grupo persistido, cae al primer grupo', () => {
    const groups = [group('g1'), group('g2')];

    renderHook(() => useAutoSelectGroup(groups, null));

    expect(useGroupStore.getState().currentGroup?.id).toBe('g1');
  });

  it('sin deep link, respeta el grupo persistido de una sesión anterior', () => {
    const groups = [group('g1'), group('g2')];
    vi.mocked(localStorage.getItem).mockReturnValue('g2');

    renderHook(() => useAutoSelectGroup(groups, null));

    expect(useGroupStore.getState().currentGroup?.id).toBe('g2');
  });

  it('si el currentGroup ya es válido y no hay deep link, no lo toca', () => {
    const groups = [group('g1'), group('g2')];
    useGroupStore.setState({ currentGroup: group('g2') });
    const setCurrentGroupSpy = vi.spyOn(useGroupStore.getState(), 'setCurrentGroup');

    renderHook(() => useAutoSelectGroup(groups, null));

    expect(setCurrentGroupSpy).not.toHaveBeenCalled();
  });

  it('no repite la selección del deep link tras un cambio manual posterior', () => {
    const groups = [group('g1'), group('g2')];

    const { rerender } = renderHook(
      ({ deepLinkGroupId }: { deepLinkGroupId: string | null }) =>
        useAutoSelectGroup(groups, deepLinkGroupId),
      { initialProps: { deepLinkGroupId: 'g2' } },
    );
    expect(useGroupStore.getState().currentGroup?.id).toBe('g2');

    // User manually switches to g1 from the group-selector UI.
    act(() => {
      useGroupStore.getState().setCurrentGroup(group('g1'));
    });

    // Same deep-link groupId is still around (URL not cleared yet) — must not fight back.
    rerender({ deepLinkGroupId: 'g2' });

    expect(useGroupStore.getState().currentGroup?.id).toBe('g1');
  });

  it('no hace nada mientras groups no ha cargado', () => {
    const setCurrentGroupSpy = vi.spyOn(useGroupStore.getState(), 'setCurrentGroup');

    renderHook(() => useAutoSelectGroup(undefined, 'g2'));

    expect(setCurrentGroupSpy).not.toHaveBeenCalled();
  });

  it('si el usuario se queda sin grupos, limpia el grupo actual', () => {
    useGroupStore.setState({ currentGroup: group('g1'), groups: [] });

    renderHook(() => useAutoSelectGroup([], null));

    expect(useGroupStore.getState().currentGroup).toBeNull();
  });
});
