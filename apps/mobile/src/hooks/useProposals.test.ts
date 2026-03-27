import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  useProposals,
  useCreateProposal,
  useUpdateProposal,
  useVoteProposal,
  useConvertProposal,
  useCloseProposal,
} from './useProposals';
import { proposalsService, type Proposal } from '../services/proposals';
import { createWrapper } from '../test/test-utils';

vi.mock('../services/proposals', () => ({
  proposalsService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    vote: vi.fn(),
    convert: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock('../lib/group-sync', () => ({
  broadcastSync: vi.fn(),
}));

function createTestProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 'proposal-1',
    groupId: 'group-1',
    title: 'Test Proposal',
    description: null,
    location: null,
    proposedDate: null,
    status: 'open',
    convertedEventId: null,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: { id: 'user-1', name: 'Test User' },
    votes: [],
    ...overrides,
  };
}

describe('useProposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch proposals for group', async () => {
    const proposals = [
      createTestProposal(),
      createTestProposal({ id: 'proposal-2', title: 'Another' }),
    ];
    vi.mocked(proposalsService.getAll).mockResolvedValue(proposals);

    const { result } = renderHook(() => useProposals('group-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(proposals);
    expect(proposalsService.getAll).toHaveBeenCalledWith('group-1');
  });

  it('should not fetch when groupId is empty', () => {
    const { result } = renderHook(() => useProposals(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle error', async () => {
    vi.mocked(proposalsService.getAll).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useProposals('group-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create proposal', async () => {
    const proposal = createTestProposal({ title: 'Beach Plan' });
    vi.mocked(proposalsService.create).mockResolvedValue(proposal);

    const { result } = renderHook(() => useCreateProposal('group-1'), { wrapper: createWrapper() });

    result.current.mutate({ title: 'Beach Plan' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(proposalsService.create).toHaveBeenCalledWith('group-1', { title: 'Beach Plan' });
  });

  it('should create proposal with all optional fields', async () => {
    vi.mocked(proposalsService.create).mockResolvedValue(createTestProposal());

    const { result } = renderHook(() => useCreateProposal('group-1'), { wrapper: createWrapper() });

    const dto = {
      title: 'Trip',
      description: 'Weekend trip',
      location: 'Mountains',
      proposedDate: '2026-07-15',
    };
    result.current.mutate(dto);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(proposalsService.create).toHaveBeenCalledWith('group-1', dto);
  });
});

describe('useUpdateProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update proposal', async () => {
    const updated = createTestProposal({ title: 'Updated Title' });
    vi.mocked(proposalsService.update).mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateProposal('group-1'), { wrapper: createWrapper() });

    result.current.mutate({ proposalId: 'proposal-1', data: { title: 'Updated Title' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(proposalsService.update).toHaveBeenCalledWith('group-1', 'proposal-1', {
      title: 'Updated Title',
    });
  });
});

describe('useVoteProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should vote yes on proposal', async () => {
    const voted = createTestProposal({ votes: [{ userId: 'user-1', vote: 'yes' }] });
    vi.mocked(proposalsService.vote).mockResolvedValue(voted);

    const { result } = renderHook(() => useVoteProposal('group-1'), { wrapper: createWrapper() });

    result.current.mutate({ proposalId: 'proposal-1', data: { vote: 'yes' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(proposalsService.vote).toHaveBeenCalledWith('group-1', 'proposal-1', { vote: 'yes' });
  });

  it('should vote no on proposal', async () => {
    vi.mocked(proposalsService.vote).mockResolvedValue(createTestProposal());

    const { result } = renderHook(() => useVoteProposal('group-1'), { wrapper: createWrapper() });

    result.current.mutate({ proposalId: 'proposal-1', data: { vote: 'no' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(proposalsService.vote).toHaveBeenCalledWith('group-1', 'proposal-1', { vote: 'no' });
  });
});

describe('useConvertProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should convert proposal to event', async () => {
    const converted = createTestProposal({ status: 'converted', convertedEventId: 'event-1' });
    vi.mocked(proposalsService.convert).mockResolvedValue(converted);

    const { result } = renderHook(() => useConvertProposal('group-1'), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      proposalId: 'proposal-1',
      data: { date: '2026-07-15', time: '18:00' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(proposalsService.convert).toHaveBeenCalledWith('group-1', 'proposal-1', {
      date: '2026-07-15',
      time: '18:00',
    });
  });
});

describe('useCloseProposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should close proposal', async () => {
    const closed = createTestProposal({ status: 'closed' });
    vi.mocked(proposalsService.close).mockResolvedValue(closed);

    const { result } = renderHook(() => useCloseProposal('group-1'), { wrapper: createWrapper() });

    result.current.mutate('proposal-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(proposalsService.close).toHaveBeenCalledWith('group-1', 'proposal-1');
  });
});
