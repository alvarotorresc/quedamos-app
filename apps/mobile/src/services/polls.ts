import { api } from '../lib/api';

export interface PollResponseEntry {
  userId: string;
  answer: 'yes' | 'no' | 'unsure';
  respondedAt: string;
  user: {
    id: string;
    name: string;
    avatarEmoji: string;
  };
}

export interface Poll {
  id: string;
  groupId: string;
  createdById: string;
  date: string;
  slot: string | null;
  status: 'open' | 'completed' | 'closed';
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    avatarEmoji: string;
  };
  responses: PollResponseEntry[];
}

export interface CreatePollDto {
  date: string;
  slot?: string;
}

export const pollsService = {
  list: (groupId: string) => api.get<Poll[]>(`/groups/${groupId}/polls`),

  create: (groupId: string, data: CreatePollDto) =>
    api.post<Poll>(`/groups/${groupId}/polls`, data),

  respond: (groupId: string, pollId: string, answer: 'yes' | 'no' | 'unsure') =>
    api.post<Poll>(`/groups/${groupId}/polls/${pollId}/respond`, { answer }),
};
