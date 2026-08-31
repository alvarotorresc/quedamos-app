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

/**
 * `notified` is true when the anti-spam rule (spec §3, at most one poll push per group
 * per day) actually let the push through, false when it silenced it — the poll is
 * created either way. Only present on the create response (I3).
 */
export interface CreatePollResult extends Poll {
  notified: boolean;
}

export const pollsService = {
  list: (groupId: string) => api.get<Poll[]>(`/groups/${groupId}/polls`),

  create: (groupId: string, data: CreatePollDto) =>
    api.post<CreatePollResult>(`/groups/${groupId}/polls`, data),

  respond: (groupId: string, pollId: string, answer: 'yes' | 'no' | 'unsure') =>
    api.post<Poll>(`/groups/${groupId}/polls/${pollId}/respond`, { answer }),
};
