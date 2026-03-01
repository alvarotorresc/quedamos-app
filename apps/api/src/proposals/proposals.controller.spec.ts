import { Test, TestingModule } from '@nestjs/testing';
import { ProposalsController } from './proposals.controller';
import { ProposalsService } from './proposals.service';
import { AuthGuard } from '../auth/auth.guard';
import { createTestUser } from '../common/test-utils';

function createTestProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proposal-1',
    groupId: 'group-1',
    title: 'Test Proposal',
    description: null,
    location: null,
    proposedDate: null,
    createdById: 'user-1',
    status: 'open',
    convertedEventId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    createdBy: createTestUser(),
    votes: [],
    ...overrides,
  };
}

const mockProposalsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  vote: jest.fn(),
  convert: jest.fn(),
  close: jest.fn(),
};

const mockAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('ProposalsController', () => {
  let controller: ProposalsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProposalsController],
      providers: [{ provide: ProposalsService, useValue: mockProposalsService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<ProposalsController>(ProposalsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call proposalsService.create with groupId, userId, and dto', async () => {
      const dto = { title: 'Beach plan' };
      const proposal = createTestProposal({ title: 'Beach plan' });
      mockProposalsService.create.mockResolvedValue(proposal);

      const result = await controller.create('group-1', { id: 'user-1' }, dto);

      expect(result).toEqual(proposal);
      expect(mockProposalsService.create).toHaveBeenCalledWith('group-1', 'user-1', dto);
      expect(mockProposalsService.create).toHaveBeenCalledTimes(1);
    });

    it('should pass optional fields to service', async () => {
      const dto = {
        title: 'Trip',
        description: 'Weekend trip',
        location: 'Mountains',
        proposedDate: '2026-07-15',
      };
      mockProposalsService.create.mockResolvedValue(createTestProposal());

      await controller.create('group-1', { id: 'user-1' }, dto);

      expect(mockProposalsService.create).toHaveBeenCalledWith('group-1', 'user-1', dto);
    });
  });

  describe('findAll', () => {
    it('should call proposalsService.findAll with groupId and userId', async () => {
      const proposals = [createTestProposal(), createTestProposal({ id: 'proposal-2', title: 'Another' })];
      mockProposalsService.findAll.mockResolvedValue(proposals);

      const result = await controller.findAll('group-1', { id: 'user-1' });

      expect(result).toEqual(proposals);
      expect(mockProposalsService.findAll).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockProposalsService.findAll).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no proposals exist', async () => {
      mockProposalsService.findAll.mockResolvedValue([]);

      const result = await controller.findAll('group-1', { id: 'user-1' });

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should call proposalsService.update with groupId, proposalId, userId, and dto', async () => {
      const dto = { title: 'Updated Title' };
      const updated = createTestProposal({ title: 'Updated Title' });
      mockProposalsService.update.mockResolvedValue(updated);

      const result = await controller.update('group-1', 'proposal-1', { id: 'user-1' }, dto);

      expect(result).toEqual(updated);
      expect(mockProposalsService.update).toHaveBeenCalledWith('group-1', 'proposal-1', 'user-1', dto);
      expect(mockProposalsService.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('vote', () => {
    it('should call proposalsService.vote with groupId, proposalId, userId, and dto', async () => {
      const dto = { vote: 'yes' as const };
      const proposal = createTestProposal({
        votes: [{ userId: 'user-1', vote: 'yes' }],
      });
      mockProposalsService.vote.mockResolvedValue(proposal);

      const result = await controller.vote('group-1', 'proposal-1', { id: 'user-1' }, dto);

      expect(result).toEqual(proposal);
      expect(mockProposalsService.vote).toHaveBeenCalledWith('group-1', 'proposal-1', 'user-1', dto);
      expect(mockProposalsService.vote).toHaveBeenCalledTimes(1);
    });

    it('should pass no vote to service', async () => {
      const dto = { vote: 'no' as const };
      mockProposalsService.vote.mockResolvedValue(createTestProposal());

      await controller.vote('group-1', 'proposal-1', { id: 'user-1' }, dto);

      expect(mockProposalsService.vote).toHaveBeenCalledWith('group-1', 'proposal-1', 'user-1', dto);
    });
  });

  describe('convert', () => {
    it('should call proposalsService.convert with groupId, proposalId, userId, and dto', async () => {
      const dto = { date: '2026-07-15', time: '18:00' };
      const converted = createTestProposal({ status: 'converted', convertedEventId: 'event-1' });
      mockProposalsService.convert.mockResolvedValue(converted);

      const result = await controller.convert('group-1', 'proposal-1', { id: 'user-1' }, dto);

      expect(result).toEqual(converted);
      expect(mockProposalsService.convert).toHaveBeenCalledWith('group-1', 'proposal-1', 'user-1', dto);
      expect(mockProposalsService.convert).toHaveBeenCalledTimes(1);
    });

    it('should pass endTime to service', async () => {
      const dto = { date: '2026-07-15', time: '16:00', endTime: '20:00' };
      mockProposalsService.convert.mockResolvedValue(createTestProposal());

      await controller.convert('group-1', 'proposal-1', { id: 'user-1' }, dto);

      expect(mockProposalsService.convert).toHaveBeenCalledWith('group-1', 'proposal-1', 'user-1', dto);
    });
  });

  describe('close', () => {
    it('should call proposalsService.close with groupId, proposalId, and userId', async () => {
      const closed = createTestProposal({ status: 'closed' });
      mockProposalsService.close.mockResolvedValue(closed);

      const result = await controller.close('group-1', 'proposal-1', { id: 'user-1' });

      expect(result).toEqual(closed);
      expect(mockProposalsService.close).toHaveBeenCalledWith('group-1', 'proposal-1', 'user-1');
      expect(mockProposalsService.close).toHaveBeenCalledTimes(1);
    });
  });
});
