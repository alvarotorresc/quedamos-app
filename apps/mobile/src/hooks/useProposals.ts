import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  proposalsService,
  CreateProposalDto,
  UpdateProposalDto,
  VoteProposalDto,
  ConvertProposalDto,
} from '../services/proposals';
import { broadcastSync } from '../lib/group-sync';
import { logEvent } from '../lib/firebase';

export function useProposals(groupId: string) {
  return useQuery({
    queryKey: ['proposals', groupId],
    queryFn: () => proposalsService.getAll(groupId),
    enabled: !!groupId,
  });
}

export function useCreateProposal(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProposalDto) => proposalsService.create(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', groupId] });
      broadcastSync(groupId, 'proposals');
      logEvent('create_proposal').catch(() => {});
    },
  });
}

export function useUpdateProposal(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ proposalId, data }: { proposalId: string; data: UpdateProposalDto }) =>
      proposalsService.update(groupId, proposalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', groupId] });
      broadcastSync(groupId, 'proposals');
    },
  });
}

export function useVoteProposal(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ proposalId, data }: { proposalId: string; data: VoteProposalDto }) =>
      proposalsService.vote(groupId, proposalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', groupId] });
      broadcastSync(groupId, 'proposals');
      logEvent('vote_proposal').catch(() => {});
    },
  });
}

export function useConvertProposal(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ proposalId, data }: { proposalId: string; data: ConvertProposalDto }) =>
      proposalsService.convert(groupId, proposalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', groupId] });
      queryClient.invalidateQueries({ queryKey: ['events', groupId] });
      broadcastSync(groupId, 'proposals');
      broadcastSync(groupId, 'events');
    },
  });
}

export function useCloseProposal(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (proposalId: string) => proposalsService.close(groupId, proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', groupId] });
      broadcastSync(groupId, 'proposals');
    },
  });
}
