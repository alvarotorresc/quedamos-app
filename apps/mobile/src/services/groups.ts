import { api } from '../lib/api';

export interface Group {
  id: string;
  name: string;
  emoji: string;
  createdById: string;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  joinedAt: string;
  role: string;
  user: {
    id: string;
    name: string;
    avatarEmoji: string;
  };
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
}

export const groupsService = {
  getAll: () => api.get<GroupWithMembers[]>('/groups'),

  getById: (id: string) => api.get<GroupWithMembers>(`/groups/${id}`),

  create: (data: { name: string; emoji?: string }) =>
    api.post<GroupWithMembers>('/groups', data),

  join: (inviteCode: string) =>
    api.post<GroupWithMembers>('/groups/join', { inviteCode }),

  leave: (id: string) => api.delete<{ success: boolean }>(`/groups/${id}/leave`),

  getInvite: (id: string) =>
    api.get<{ inviteCode: string; inviteUrl: string }>(`/groups/${id}/invite`),

  refreshInvite: (id: string) =>
    api.post<{ inviteCode: string; inviteUrl: string }>(`/groups/${id}/invite/refresh`, {}),

  updateMemberRole: (groupId: string, userId: string, role: 'admin' | 'member') =>
    api.patch(`/groups/${groupId}/members/${userId}/role`, { role }),

  kickMember: (groupId: string, userId: string) =>
    api.delete(`/groups/${groupId}/members/${userId}`),

  deleteGroup: (groupId: string) =>
    api.delete(`/groups/${groupId}`),
};
