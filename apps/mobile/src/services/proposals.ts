import { api } from '../lib/api';

export interface ProposalVote {
  userId: string;
  vote: 'yes' | 'no';
  votedAt: string;
  user: {
    id: string;
    name: string;
    avatarEmoji: string;
  };
}

export interface Proposal {
  id: string;
  groupId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  proposedDate?: string | null;
  status: 'open' | 'closed' | 'converted';
  convertedEventId?: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  votes: ProposalVote[];
}

export interface CreateProposalDto {
  title: string;
  description?: string;
  location?: string;
  proposedDate?: string;
}

export interface VoteProposalDto {
  vote: 'yes' | 'no';
}

export interface UpdateProposalDto {
  title?: string;
  description?: string;
  location?: string;
  proposedDate?: string;
}

export interface ConvertProposalDto {
  date: string;
  time?: string;
  endTime?: string;
}

export const proposalsService = {
  getAll: (groupId: string) =>
    api.get<Proposal[]>(`/groups/${groupId}/proposals`),

  create: (groupId: string, data: CreateProposalDto) =>
    api.post<Proposal>(`/groups/${groupId}/proposals`, data),

  vote: (groupId: string, proposalId: string, data: VoteProposalDto) =>
    api.post<Proposal>(`/groups/${groupId}/proposals/${proposalId}/vote`, data),

  convert: (groupId: string, proposalId: string, data: ConvertProposalDto) =>
    api.post<Proposal>(`/groups/${groupId}/proposals/${proposalId}/convert`, data),

  update: (groupId: string, proposalId: string, data: UpdateProposalDto) =>
    api.patch<Proposal>(`/groups/${groupId}/proposals/${proposalId}`, data),

  close: (groupId: string, proposalId: string) =>
    api.post<Proposal>(`/groups/${groupId}/proposals/${proposalId}/close`, {}),
};
