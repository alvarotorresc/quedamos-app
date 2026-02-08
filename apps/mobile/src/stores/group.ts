import { create } from 'zustand';

interface Group {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
}

interface GroupState {
  currentGroup: Group | null;
  groups: Group[];
  setCurrentGroup: (group: Group | null) => void;
  setGroups: (groups: Group[]) => void;
  getPersistedGroupId: () => string | null;
}

const STORAGE_KEY = 'quedamos_current_group_id';

export const useGroupStore = create<GroupState>((set) => ({
  currentGroup: null,
  groups: [],
  setCurrentGroup: (currentGroup) => {
    if (currentGroup) {
      localStorage.setItem(STORAGE_KEY, currentGroup.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ currentGroup });
  },
  setGroups: (groups) => set({ groups }),
  getPersistedGroupId: () => localStorage.getItem(STORAGE_KEY),
}));
