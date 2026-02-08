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
}

export const useGroupStore = create<GroupState>((set) => ({
  currentGroup: null,
  groups: [],
  setCurrentGroup: (currentGroup) => set({ currentGroup }),
  setGroups: (groups) => set({ groups }),
}));
