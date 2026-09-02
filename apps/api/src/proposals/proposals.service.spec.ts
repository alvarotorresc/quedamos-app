import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { GroupsService } from '../groups/groups.service';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
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
    isOnline: false,
    meetingUrl: null,
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
    // El reclamo atómico de convert() encuentra la propuesta abierta salvo que un test diga lo contrario.
    prisma.planProposal.updateMany.mockResolvedValue({ count: 1 });
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
      prisma as unknown as PrismaService,
      groupsService as unknown as GroupsService,
      notifications as unknown as NotificationsService,
      eventsService as unknown as EventsService,
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

  describe('findAll', () => {
    it('should return all proposals for a group', async () => {
      const proposals = [
        { ...createTestProposal(), createdBy: createTestUser(), votes: [] },
        {
          ...createTestProposal({ id: 'proposal-2', title: 'Second Proposal' }),
          createdBy: createTestUser(),
          votes: [],
        },
      ];
      prisma.planProposal.findMany.mockResolvedValue(proposals);

      const result = await service.findAll('group-1', 'user-1');

      expect(result).toEqual(proposals);
      expect(result).toHaveLength(2);
      expect(groupsService.findById).toHaveBeenCalledWith('group-1', 'user-1');
      expect(prisma.planProposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId: 'group-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should return empty array when no proposals exist', async () => {
      prisma.planProposal.findMany.mockResolvedValue([]);

      const result = await service.findAll('group-1', 'user-1');

      expect(result).toEqual([]);
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

    it('should throw NotFoundException when proposal not found', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(null);

      await expect(
        service.vote('group-1', 'proposal-1', 'user-1', { vote: 'yes' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when proposal is closed', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(createTestProposal({ status: 'closed' }));

      await expect(
        service.vote('group-1', 'proposal-1', 'user-1', { vote: 'yes' }),
      ).rejects.toThrow(ForbiddenException);
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
    beforeEach(() => {
      prisma.planProposal.updateMany.mockResolvedValue({ count: 1 });
    });

    it('claims the proposal atomically before creating the event', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [],
      });
      prisma.planProposal.update.mockResolvedValue({
        ...createTestProposal({ status: 'converted' }),
        createdBy: createTestUser(),
        votes: [],
      });

      await service.convert('group-1', 'proposal-1', 'user-1', { date: '2026-03-15' });

      expect(prisma.planProposal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'proposal-1', status: 'open' }),
          data: expect.objectContaining({ status: 'converted' }),
        }),
      );
      const claimOrder = prisma.planProposal.updateMany.mock.invocationCallOrder[0];
      const createOrder = (eventsService.create as jest.Mock).mock.invocationCallOrder[0];
      expect(claimOrder).toBeLessThan(createOrder);
    });

    it('refuses a second convert that lost the race and creates no event', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [],
      });
      prisma.planProposal.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.convert('group-1', 'proposal-1', 'user-1', { date: '2026-03-15' }),
      ).rejects.toThrow(ForbiddenException);
      expect(eventsService.create).not.toHaveBeenCalled();
    });

    it('reopens the proposal when the event could not be created', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [],
      });
      (eventsService.create as jest.Mock).mockRejectedValueOnce(new Error('boom'));

      await expect(
        service.convert('group-1', 'proposal-1', 'user-1', { date: '2026-03-15' }),
      ).rejects.toThrow('boom');
      expect(prisma.planProposal.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'proposal-1', status: 'converted' }),
          data: expect.objectContaining({ status: 'open' }),
        }),
      );
    });

    it('should convert proposal to event', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [],
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
        votes: [],
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

    it('should transfer yes votes as confirmed and no votes as declined', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [
          { userId: 'user-1', vote: 'yes' },
          { userId: 'user-2', vote: 'yes' },
          { userId: 'user-3', vote: 'no' },
        ],
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

      expect(eventsService.create).toHaveBeenCalledWith(
        'group-1',
        'user-1',
        expect.objectContaining({
          date: '2026-12-01',
          time: '18:00',
        }),
        {
          'user-1': 'confirmed',
          'user-2': 'confirmed',
          'user-3': 'declined',
        },
        { skipNewEventNotification: true },
      );
    });

    it('should throw NotFoundException when proposal not found', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(null);

      await expect(
        service.convert('group-1', 'proposal-1', 'user-1', { date: '2026-12-01' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when endTime is before or equal to time', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [],
      });

      await expect(
        service.convert('group-1', 'proposal-1', 'user-1', {
          date: '2026-12-01',
          time: '18:00',
          endTime: '17:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when endTime equals time', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [],
      });

      await expect(
        service.convert('group-1', 'proposal-1', 'user-1', {
          date: '2026-12-01',
          time: '18:00',
          endTime: '18:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject convert from non-creator', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [],
      });

      await expect(
        service.convert('group-1', 'proposal-1', 'user-2', { date: '2026-12-01' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject convert when proposal is not open', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal({ status: 'converted' }),
        createdBy: createTestUser(),
        votes: [],
      });

      await expect(
        service.convert('group-1', 'proposal-1', 'user-1', { date: '2026-12-01' }),
      ).rejects.toThrow(ForbiddenException);
      expect(eventsService.create).not.toHaveBeenCalled();
    });

    it('should reject convert when proposal is closed', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal({ status: 'closed' }),
        createdBy: createTestUser(),
        votes: [],
      });

      await expect(
        service.convert('group-1', 'proposal-1', 'user-1', { date: '2026-12-01' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should skip the internal new_event push when converting (only proposal_converted)', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [],
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

      expect(eventsService.create).toHaveBeenCalledWith(
        'group-1',
        'user-1',
        expect.any(Object),
        expect.any(Object),
        { skipNewEventNotification: true },
      );
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

    it('should throw NotFoundException when proposal not found', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(null);

      await expect(service.close('group-1', 'proposal-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject close when proposal is not open', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(createTestProposal({ status: 'converted' }));

      await expect(service.close('group-1', 'proposal-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.planProposal.update).not.toHaveBeenCalled();
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

  describe('online proposals', () => {
    it('should create online proposal with meetingUrl', async () => {
      const proposal = {
        ...createTestProposal({ isOnline: true, meetingUrl: 'https://meet.google.com/abc' }),
        createdBy: createTestUser(),
        votes: [],
      };
      prisma.planProposal.create.mockResolvedValue(proposal);

      await service.create('group-1', 'user-1', {
        title: 'Online Meeting',
        isOnline: true,
        meetingUrl: 'https://meet.google.com/abc',
      });

      expect(prisma.planProposal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOnline: true,
            meetingUrl: 'https://meet.google.com/abc',
          }),
        }),
      );
    });

    it('should clear meetingUrl when creating presencial proposal', async () => {
      const proposal = {
        ...createTestProposal(),
        createdBy: createTestUser(),
        votes: [],
      };
      prisma.planProposal.create.mockResolvedValue(proposal);

      await service.create('group-1', 'user-1', {
        title: 'Presencial',
        isOnline: false,
        meetingUrl: 'https://meet.google.com/abc',
      });

      expect(prisma.planProposal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOnline: false,
            meetingUrl: null,
          }),
        }),
      );
    });

    it('should clear location when creating online proposal', async () => {
      const proposal = {
        ...createTestProposal({ isOnline: true }),
        createdBy: createTestUser(),
        votes: [],
      };
      prisma.planProposal.create.mockResolvedValue(proposal);

      await service.create('group-1', 'user-1', {
        title: 'Online',
        isOnline: true,
        location: 'Madrid',
      });

      expect(prisma.planProposal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOnline: true,
            location: null,
          }),
        }),
      );
    });

    it('should switch to online and clear location on update', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(createTestProposal({ location: 'Madrid' }));
      prisma.planProposal.update.mockResolvedValue({
        ...createTestProposal({ isOnline: true, location: null }),
        createdBy: createTestUser(),
        votes: [],
      });

      await service.update('group-1', 'proposal-1', 'user-1', {
        isOnline: true,
      });

      expect(prisma.planProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOnline: true,
            location: null,
          }),
        }),
      );
    });

    it('should switch to presencial and clear meetingUrl on update', async () => {
      prisma.planProposal.findFirst.mockResolvedValue(
        createTestProposal({ isOnline: true, meetingUrl: 'https://meet.google.com/abc' }),
      );
      prisma.planProposal.update.mockResolvedValue({
        ...createTestProposal({ isOnline: false, meetingUrl: null }),
        createdBy: createTestUser(),
        votes: [],
      });

      await service.update('group-1', 'proposal-1', 'user-1', {
        isOnline: false,
      });

      expect(prisma.planProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOnline: false,
            meetingUrl: null,
          }),
        }),
      );
    });

    it('should propagate isOnline and meetingUrl when converting proposal to event', async () => {
      prisma.planProposal.findFirst.mockResolvedValue({
        ...createTestProposal({
          isOnline: true,
          meetingUrl: 'https://meet.google.com/abc',
        }),
        createdBy: createTestUser(),
        votes: [{ userId: 'user-1', vote: 'yes' }],
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

      expect(eventsService.create).toHaveBeenCalledWith(
        'group-1',
        'user-1',
        expect.objectContaining({
          isOnline: true,
          meetingUrl: 'https://meet.google.com/abc',
        }),
        { 'user-1': 'confirmed' },
        { skipNewEventNotification: true },
      );
    });
  });
});
