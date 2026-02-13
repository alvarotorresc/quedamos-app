import { describe, it, expect, beforeEach } from 'vitest';
import { useGroupStore } from './group';

describe('useGroupStore', () => {
  beforeEach(() => {
    useGroupStore.setState({ currentGroup: null, groups: [] });
    localStorage.clear();
  });

  it('should have correct initial state', () => {
    const state = useGroupStore.getState();
    expect(state.currentGroup).toBeNull();
    expect(state.groups).toEqual([]);
  });

  it('should set current group and persist to localStorage', () => {
    const group = { id: 'g1', name: 'Test', emoji: '👥', inviteCode: '12345678' };
    useGroupStore.getState().setCurrentGroup(group);

    expect(useGroupStore.getState().currentGroup).toEqual(group);
    expect(localStorage.setItem).toHaveBeenCalledWith('quedamos_current_group_id', 'g1');
  });

  it('should remove from localStorage when setting null', () => {
    useGroupStore.getState().setCurrentGroup(null);

    expect(localStorage.removeItem).toHaveBeenCalledWith('quedamos_current_group_id');
  });

  it('should set groups list', () => {
    const groups = [
      { id: 'g1', name: 'A', emoji: '👥', inviteCode: '11111111' },
      { id: 'g2', name: 'B', emoji: '🎉', inviteCode: '22222222' },
    ];
    useGroupStore.getState().setGroups(groups);

    expect(useGroupStore.getState().groups).toHaveLength(2);
  });

  it('should get persisted group id from localStorage', () => {
    (localStorage.getItem as any).mockReturnValue('g1');

    const id = useGroupStore.getState().getPersistedGroupId();

    expect(id).toBe('g1');
  });
});
