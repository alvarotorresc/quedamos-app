import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GroupsService } from './groups.service';
import {
  createMockPrisma,
  createMockNotificationsService,
  createTestUser,
  createTestGroup,
  createTestEvent,
} from '../common/test-utils';

describe('GroupsService', () => {
  let service: GroupsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let notifications: ReturnType<typeof createMockNotificationsService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    notifications = createMockNotificationsService();
    service = new GroupsService(prisma as any, notifications as any);
  });

  describe('create', () => {
    it('should create group and add creator as member', async () => {
      const group = createTestGroup();
      prisma.group.findUnique.mockResolvedValue(null);
      prisma.group.create.mockResolvedValue({ ...group, members: [{ userId: 'user-1' }] });

      const result = await service.create('user-1', { name: 'Test Group', emoji: '👥' });

      expect(result).toBeDefined();
      expect(prisma.group.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test Group',
            emoji: '👥',
            createdById: 'user-1',
            members: { create: { userId: 'user-1' } },
          }),
        }),
      );
    });

    it('should use default emoji when not provided', async () => {
      prisma.group.findUnique.mockResolvedValue(null);
      prisma.group.create.mockResolvedValue(createTestGroup());

      await service.create('user-1', { name: 'No Emoji' });

      expect(prisma.group.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ emoji: '👥' }),
        }),
      );
    });
  });

  describe('findAllForUser', () => {
    it('should return groups for user', async () => {
      const groups = [createTestGroup(), createTestGroup({ id: 'group-2', name: 'Group 2' })];
      prisma.group.findMany.mockResolvedValue(groups);

      const result = await service.findAllForUser('user-1');

      expect(result).toHaveLength(2);
      expect(prisma.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { members: { some: { userId: 'user-1' } } },
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return group when user is member', async () => {
      const group = createTestGroup();
      prisma.group.findFirst.mockResolvedValue(group);

      const result = await service.findById('group-1', 'user-1');

      expect(result).toEqual(group);
    });

    it('should throw NotFoundException when group not found', async () => {
      prisma.group.findFirst.mockResolvedValue(null);

      await expect(service.findById('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('joinByCode', () => {
    it('should join group by invite code', async () => {
      const group = createTestGroup();
      const user = createTestUser();
      prisma.group.findUnique.mockResolvedValue(group);
      prisma.groupMember.findUnique.mockResolvedValue(null);
      prisma.groupMember.create.mockResolvedValue({ groupId: 'group-1', userId: 'user-1' });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.event.findMany.mockResolvedValue([]);
      prisma.group.findFirst.mockResolvedValue({ ...group, members: [{ userId: 'user-1', user }] });

      const result = await service.joinByCode('user-1', '12345678');

      expect(result).toBeDefined();
      expect(prisma.groupMember.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid invite code', async () => {
      prisma.group.findUnique.mockResolvedValue(null);

      await expect(service.joinByCode('user-1', 'INVALID')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when already a member', async () => {
      prisma.group.findUnique.mockResolvedValue(createTestGroup());
      prisma.groupMember.findUnique.mockResolvedValue({ groupId: 'group-1', userId: 'user-1' });

      await expect(service.joinByCode('user-1', '12345678')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should add new member as attendee to active future events', async () => {
      const group = createTestGroup();
      const user = createTestUser({ id: 'user-3', name: 'New User' });
      const futureEvents = [
        createTestEvent({ id: 'event-1', status: 'pending', date: new Date('2026-12-01') }),
        createTestEvent({ id: 'event-2', status: 'confirmed', date: new Date('2026-12-15') }),
      ];

      prisma.group.findUnique.mockResolvedValue(group);
      prisma.groupMember.findUnique.mockResolvedValue(null);
      prisma.groupMember.create.mockResolvedValue({ groupId: 'group-1', userId: 'user-3' });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.event.findMany.mockResolvedValue(futureEvents);
      prisma.eventAttendee.createMany.mockResolvedValue({ count: 2 });
      prisma.group.findFirst.mockResolvedValue({ ...group, members: [{ userId: 'user-3', user }] });

      await service.joinByCode('user-3', '12345678');

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: {
          groupId: group.id,
          status: { not: 'cancelled' },
          date: { gte: expect.any(Date) },
        },
      });
      expect(prisma.eventAttendee.createMany).toHaveBeenCalledWith({
        data: [
          { eventId: 'event-1', userId: 'user-3', status: 'pending' },
          { eventId: 'event-2', userId: 'user-3', status: 'pending' },
        ],
        skipDuplicates: true,
      });
    });

    it('should not call createMany when no active events exist', async () => {
      const group = createTestGroup();
      const user = createTestUser();
      prisma.group.findUnique.mockResolvedValue(group);
      prisma.groupMember.findUnique.mockResolvedValue(null);
      prisma.groupMember.create.mockResolvedValue({ groupId: 'group-1', userId: 'user-1' });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.event.findMany.mockResolvedValue([]);
      prisma.group.findFirst.mockResolvedValue({ ...group, members: [{ userId: 'user-1', user }] });

      await service.joinByCode('user-1', '12345678');

      expect(prisma.eventAttendee.createMany).not.toHaveBeenCalled();
    });

    it('should send notification to group when joining', async () => {
      const group = createTestGroup();
      const user = createTestUser();
      prisma.group.findUnique.mockResolvedValue(group);
      prisma.groupMember.findUnique.mockResolvedValue(null);
      prisma.groupMember.create.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.event.findMany.mockResolvedValue([]);
      prisma.group.findFirst.mockResolvedValue(group);

      await service.joinByCode('user-1', '12345678');

      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'group-1',
        'Nuevo miembro',
        expect.stringContaining('Test User'),
        'user-1',
        expect.objectContaining({ type: 'member_joined' }),
      );
    });
  });

  describe('leave', () => {
    it('should remove member from group', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({ groupId: 'group-1', userId: 'user-1' });
      prisma.user.findUnique.mockResolvedValue(createTestUser());
      prisma.group.findUnique.mockResolvedValue(createTestGroup());
      prisma.groupMember.delete.mockResolvedValue({});

      const result = await service.leave('group-1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(prisma.groupMember.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when not a member', async () => {
      prisma.groupMember.findUnique.mockResolvedValue(null);

      await expect(service.leave('group-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should send notification when leaving', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({ groupId: 'group-1', userId: 'user-1' });
      prisma.user.findUnique.mockResolvedValue(createTestUser());
      prisma.group.findUnique.mockResolvedValue(createTestGroup());
      prisma.groupMember.delete.mockResolvedValue({});

      await service.leave('group-1', 'user-1');

      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'group-1',
        'Miembro salió',
        expect.any(String),
        'user-1',
        expect.objectContaining({ type: 'member_left' }),
      );
    });
  });

  describe('getMembers', () => {
    it('should return group members', async () => {
      const members = [
        { userId: 'user-1', user: createTestUser() },
        { userId: 'user-2', user: createTestUser({ id: 'user-2', name: 'User 2' }) },
      ];
      prisma.group.findFirst.mockResolvedValue(createTestGroup());
      prisma.groupMember.findMany.mockResolvedValue(members);

      const result = await service.getMembers('group-1', 'user-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('getInviteInfo', () => {
    it('should return invite code and URL', async () => {
      prisma.group.findFirst.mockResolvedValue(createTestGroup());

      const result = await service.getInviteInfo('group-1', 'user-1');

      expect(result.inviteCode).toBe('12345678');
      expect(result.inviteUrl).toContain('/join/12345678');
    });
  });

  describe('refreshInviteCode', () => {
    it('should generate new invite code', async () => {
      prisma.group.findFirst.mockResolvedValue(createTestGroup());
      prisma.group.findUnique.mockResolvedValue(null);
      prisma.group.update.mockResolvedValue({});

      const result = await service.refreshInviteCode('group-1', 'user-1');

      expect(result.inviteCode).toBeDefined();
      expect(result.inviteCode).toHaveLength(8);
      expect(prisma.group.update).toHaveBeenCalled();
    });
  });
});
