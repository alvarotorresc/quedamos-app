import { ForbiddenException } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { GroupsService } from '../groups/groups.service';
import { EventsService } from '../events/events.service';
import {
  createMockPrisma,
  createMockNotificationsService,
  createTestUser,
  createTestEvent,
} from '../common/test-utils';

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
    ...overrides,
  };
}

describe('ProposalsService', () => {
  let service: ProposalsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let groupsService: jest.Mocked<Partial<GroupsService>>;
  let eventsService: jest.Mocked<Partial<EventsService>>;
  let notifications: ReturnType<typeof createMockNotificationsService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    groupsService = {
      findById: jest.fn().mockResolvedValue({}),
    };
    eventsService = {
      create: jest.fn().mockResolvedValue({
        ...createTestEvent(),
        createdBy: createTestUser(),
        attendees: [],
      }),
    };
    notifications = createMockNotificationsService();
    service = new ProposalsService(
      prisma as any,
      groupsService as any,
      notifications as any,
      eventsService as any,
    );
  });

  describe('create', () => {
    it('should create proposal', async () => {
      const proposal = {
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [],
      };
      prisma.planProposal.create.mockResolvedValue(proposal);

      const result = await service.create('group-1', 'user-1', {
        title: 'Test Proposal',
      });

      expect(result).toBeDefined();
      expect(result.title).toBe('Test Proposal');
      expect(notifications.sendToGroup).toHaveBeenCalled();
    });

    it('should create proposal with proposedDate', async () => {
      const proposal = {
        ...createTestProposal({ proposedDate: '2026-03-15' }),
        createdBy: createTestUser(),
        votes: [],
      };
      prisma.planProposal.create.mockResolvedValue(proposal);

      const result = await service.create('group-1', 'user-1', {
        title: 'Test Proposal',
        proposedDate: '2026-03-15',
      });

      expect(result).toBeDefined();
      expect(prisma.planProposal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            proposedDate: '2026-03-15',
          }),
        }),
      );
    });
  });

  describe('vote', () => {
    it('should vote yes/no', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(createTestProposal());
      prisma.planVote.upsert.mockResolvedValue({});
      prisma.planProposal.findUnique.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [{ userId: 'user-1', vote: 'yes' }],
      });
      prisma.user.findUnique.mockResolvedValue(createTestUser());

      const result = await service.vote('group-1', 'proposal-1', 'user-1', { vote: 'yes' });

      expect(result).toBeDefined();
      expect(prisma.planVote.upsert).toHaveBeenCalled();
    });

    it('should allow changing vote', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(createTestProposal());
      prisma.planVote.upsert.mockResolvedValue({});
      prisma.planProposal.findUnique.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [{ userId: 'user-1', vote: 'no' }],
      });
      prisma.user.findUnique.mockResolvedValue(createTestUser());

      await service.vote('group-1', 'proposal-1', 'user-1', { vote: 'no' });

      expect(prisma.planVote.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ vote: 'no' }),
        }),
      );
    });

    it('should send proposal_voted notification with voter name', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(createTestProposal());
      prisma.planVote.upsert.mockResolvedValue({});
      prisma.planProposal.findUnique.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [{ userId: 'user-1', vote: 'yes' }],
      });
      prisma.user.findUnique.mockResolvedValue(createTestUser());

      await service.vote('group-1', 'proposal-1', 'user-1', { vote: 'yes' });

      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'group-1',
        expect.any(String),
        expect.any(String),
        'user-1',
        expect.objectContaining({ type: 'proposal_voted' }),
        'proposal_voted',
      );
    });
  });

  describe('convert', () => {
    it('should convert proposal to event', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
      });
      prisma.planProposal.update.mockResolvedValue({
        ...createTestProposal({ status: 'converted' }),
        createdBy: createTestUser(),
        votes: [],
      });

      const result = await service.convert('group-1', 'proposal-1', 'user-1', {
        date: '2026-12-01',
        time: '18:00',
      });

      expect(eventsService.create).toHaveBeenCalled();
      expect(prisma.planProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'converted' }),
        }),
      );
    });

    it('should send proposal_converted notification', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
      });
      prisma.planProposal.update.mockResolvedValue({
        ...createTestProposal({ status: 'converted' }),
        createdBy: createTestUser(),
        votes: [],
      });

      await service.convert('group-1', 'proposal-1', 'user-1', {
        date: '2026-12-01',
        time: '18:00',
      });

      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'group-1',
        expect.any(String),
        expect.any(String),
        'user-1',
        expect.objectContaining({ type: 'proposal_converted' }),
        'proposal_converted',
      );
    });

    it('should reject convert from non-creator', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
      });

      await expect(
        service.convert('group-1', 'proposal-1', 'user-2', { date: '2026-12-01' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('close', () => {
    it('should close proposal', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(createTestProposal());
      prisma.planProposal.update.mockResolvedValue({
        ...createTestProposal({ status: 'closed' }),
        createdBy: createTestUser(),
        votes: [],
      });

      const result = await service.close('group-1', 'proposal-1', 'user-1');

      expect(prisma.planProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'closed' },
        }),
      );
    });

    it('should reject close from non-creator', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(createTestProposal());

      await expect(service.close('group-1', 'proposal-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update proposal title', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(createTestProposal());
      prisma.planProposal.update.mockResolvedValue({
        ...createTestProposal({ title: 'Updated Title' }),
        createdBy: createTestUser(),
        votes: [],
      });

      const result = await service.update('group-1', 'proposal-1', 'user-1', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
      expect(prisma.planProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'proposal-1' },
          data: { title: 'Updated Title' },
        }),
      );
    });

    it('should reject update from non-creator', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(createTestProposal());

      await expect(
        service.update('group-1', 'proposal-1', 'user-2', { title: 'Nope' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject update on closed proposal', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(createTestProposal({ status: 'closed' }));

      await expect(
        service.update('group-1', 'proposal-1', 'user-1', { title: 'Nope' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
