import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
            members: { create: { userId: 'user-1', role: 'admin' } },
          }),
        }),
      );
    });

    it('should set creator as admin on create', async () => {
      const group = createTestGroup();
      prisma.group.findUnique.mockResolvedValue(null);
      prisma.group.create.mockResolvedValue({
        ...group,
        members: [{ userId: 'user-1', role: 'admin' }],
      });

      await service.create('user-1', { name: 'Admin Group' });

      const createCall = prisma.group.create.mock.calls[0][0];
      expect(createCall.data.members.create.role).toBe('admin');
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

      await expect(service.findById('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
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

    it('should set new member as member on join (not admin)', async () => {
      const group = createTestGroup();
      const user = createTestUser();
      prisma.group.findUnique.mockResolvedValue(group);
      prisma.groupMember.findUnique.mockResolvedValue(null);
      prisma.groupMember.create.mockResolvedValue({ groupId: 'group-1', userId: 'user-1' });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.event.findMany.mockResolvedValue([]);
      prisma.group.findFirst.mockResolvedValue({ ...group, members: [{ userId: 'user-1', user }] });

      await service.joinByCode('user-1', '12345678');

      const createCall = prisma.groupMember.create.mock.calls[0][0];
      expect(createCall.data.role).toBeUndefined();
    });

    it('should throw NotFoundException for invalid invite code', async () => {
      prisma.group.findUnique.mockResolvedValue(null);

      await expect(service.joinByCode('user-1', 'INVALID')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when already a member', async () => {
      prisma.group.findUnique.mockResolvedValue(createTestGroup());
      prisma.groupMember.findUnique.mockResolvedValue({ groupId: 'group-1', userId: 'user-1' });

      await expect(service.joinByCode('user-1', '12345678')).rejects.toThrow(BadRequestException);
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
        'member_joined',
      );
    });
  });

  describe('leave', () => {
    it('should remove member from group', async () => {
      const nonCreatorUser = createTestUser({ id: 'user-2', name: 'Other User' });
      prisma.groupMember.findUnique.mockResolvedValue({ groupId: 'group-1', userId: 'user-2' });
      prisma.user.findUnique.mockResolvedValue(nonCreatorUser);
      prisma.group.findUnique.mockResolvedValue(createTestGroup());
      prisma.groupMember.delete.mockResolvedValue({});

      const result = await service.leave('group-1', 'user-2');

      expect(result).toEqual({ success: true });
      expect(prisma.groupMember.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when not a member', async () => {
      prisma.groupMember.findUnique.mockResolvedValue(null);

      await expect(service.leave('group-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when creator tries to leave', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({ groupId: 'group-1', userId: 'user-1' });
      prisma.user.findUnique.mockResolvedValue(createTestUser());
      prisma.group.findUnique.mockResolvedValue(createTestGroup());

      await expect(service.leave('group-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should send notification when leaving', async () => {
      const nonCreatorUser = createTestUser({ id: 'user-2', name: 'Other User' });
      prisma.groupMember.findUnique.mockResolvedValue({ groupId: 'group-1', userId: 'user-2' });
      prisma.user.findUnique.mockResolvedValue(nonCreatorUser);
      prisma.group.findUnique.mockResolvedValue(createTestGroup());
      prisma.groupMember.delete.mockResolvedValue({});

      await service.leave('group-1', 'user-2');

      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'group-1',
        'Miembro salió',
        expect.any(String),
        'user-2',
        expect.objectContaining({ type: 'member_left' }),
        'member_left',
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
      prisma.group.findUniqueOrThrow.mockResolvedValue({ inviteCode: '12345678' });

      const result = await service.getInviteInfo('group-1', 'user-1');

      expect(result.inviteCode).toBe('12345678');
      expect(result.inviteUrl).toContain('/join/12345678');
    });
  });

  describe('updateMemberRole', () => {
    it('should promote member to admin', async () => {
      // isAdmin check: requesting user is admin
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      // target member exists
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'member',
      });
      prisma.groupMember.update.mockResolvedValue({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'admin',
      });

      const result = await service.updateMemberRole('group-1', 'user-2', 'user-1', 'admin');

      expect(result.role).toBe('admin');
      expect(prisma.groupMember.update).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId: 'group-1', userId: 'user-2' } },
        data: { role: 'admin' },
      });
      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'user-2',
        'Role updated',
        expect.stringContaining('admin'),
        expect.objectContaining({ type: 'role_changed' }),
        'role_changed',
      );
    });

    it('should prevent removing last admin', async () => {
      // isAdmin check: requesting user is admin
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      // target member is an admin
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      // only 1 admin in group
      prisma.groupMember.count.mockResolvedValue(1);

      await expect(
        service.updateMemberRole('group-1', 'user-1', 'user-1', 'member'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('kickMember', () => {
    it('should kick member as admin', async () => {
      // isAdmin check
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      // target member
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'member',
      });
      prisma.groupMember.delete.mockResolvedValue({});
      prisma.eventAttendee.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.kickMember('group-1', 'user-2', 'user-1');

      expect(result).toEqual({ success: true });
      expect(prisma.groupMember.delete).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId: 'group-1', userId: 'user-2' } },
      });
    });

    it('should reject kick from non-admin', async () => {
      // isAdmin check: user is not admin
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'member',
      });

      await expect(service.kickMember('group-1', 'user-3', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should not kick another admin', async () => {
      // isAdmin check: requesting user is admin
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      // target is also admin
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'admin',
      });

      await expect(service.kickMember('group-1', 'user-2', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should clean event attendees on kick', async () => {
      // isAdmin check
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      // target member
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'member',
      });
      prisma.groupMember.delete.mockResolvedValue({});
      prisma.eventAttendee.deleteMany.mockResolvedValue({ count: 2 });

      await service.kickMember('group-1', 'user-2', 'user-1');

      expect(prisma.eventAttendee.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-2',
          event: {
            groupId: 'group-1',
            date: { gte: expect.any(Date) },
          },
        },
      });
    });
  });

  describe('deleteGroup', () => {
    it('should delete group as admin', async () => {
      // isAdmin check
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      prisma.group.findUnique.mockResolvedValue(createTestGroup());
      prisma.group.delete.mockResolvedValue({});

      const result = await service.deleteGroup('group-1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(prisma.group.delete).toHaveBeenCalledWith({
        where: { id: 'group-1' },
      });
      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'group-1',
        'Group deleted',
        expect.stringContaining('Test Group'),
        'user-1',
        expect.objectContaining({ type: 'group_deleted' }),
        'group_deleted',
      );
    });

    it('should reject delete from non-creator', async () => {
      prisma.group.findUnique.mockResolvedValue(createTestGroup());

      await expect(service.deleteGroup('group-1', 'user-2')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refreshInviteCode', () => {
    it('should generate new invite code for admin', async () => {
      prisma.group.findFirst.mockResolvedValue(createTestGroup());
      prisma.groupMember.findUnique.mockResolvedValue({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      prisma.group.findUnique.mockResolvedValue(null);
      prisma.group.update.mockResolvedValue({});

      const result = await service.refreshInviteCode('group-1', 'user-1');

      expect(result.inviteCode).toBeDefined();
      expect(result.inviteCode).toHaveLength(8);
      expect(prisma.group.update).toHaveBeenCalled();
    });

    it('should reject invite refresh from non-admin', async () => {
      prisma.group.findFirst.mockResolvedValue(createTestGroup());
      prisma.groupMember.findUnique.mockResolvedValue({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'member',
      });

      await expect(service.refreshInviteCode('group-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('isAdmin', () => {
    it('should return true for admin member', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });

      const result = await service.isAdmin('group-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false for regular member', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'member',
      });

      const result = await service.isAdmin('group-1', 'user-2');

      expect(result).toBe(false);
    });

    it('should return false when user is not a member', async () => {
      prisma.groupMember.findUnique.mockResolvedValue(null);

      const result = await service.isAdmin('group-1', 'user-99');

      expect(result).toBe(false);
    });
  });

  describe('updateMemberRole - creator immunity', () => {
    it('should prevent demoting the group creator', async () => {
      // isAdmin check: requesting user is admin
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      // target member is also admin (the creator)
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      // group shows user-1 is creator
      prisma.group.findUnique.mockResolvedValue(createTestGroup({ createdById: 'user-1' }));

      await expect(
        service.updateMemberRole('group-1', 'user-1', 'user-1', 'member'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject role change from non-admin', async () => {
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'member',
      });

      await expect(
        service.updateMemberRole('group-1', 'user-3', 'user-2', 'admin'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when target member does not exist', async () => {
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      prisma.groupMember.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateMemberRole('group-1', 'user-99', 'user-1', 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('kickMember - additional cases', () => {
    it('should reject kicking yourself', async () => {
      // isAdmin check
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });

      await expect(service.kickMember('group-1', 'user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject kicking the group creator', async () => {
      // isAdmin check
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'admin',
      });
      // target member exists as regular member
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'member',
      });
      // group shows user-1 is creator
      prisma.group.findUnique.mockResolvedValue(createTestGroup({ createdById: 'user-1' }));

      await expect(service.kickMember('group-1', 'user-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when target is not a member', async () => {
      // isAdmin check
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      // target not found
      prisma.groupMember.findUnique.mockResolvedValueOnce(null);

      await expect(service.kickMember('group-1', 'user-99', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should send notification to kicked user', async () => {
      // isAdmin check
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      // target member
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'member',
      });
      prisma.group.findUnique.mockResolvedValue(createTestGroup());
      prisma.groupMember.delete.mockResolvedValue({});
      prisma.eventAttendee.deleteMany.mockResolvedValue({ count: 0 });

      await service.kickMember('group-1', 'user-2', 'user-1');

      expect(notifications.sendToUser).toHaveBeenCalledWith(
        'user-2',
        'Removed from group',
        expect.any(String),
        expect.objectContaining({ type: 'member_kicked' }),
        'member_kicked',
      );
    });
  });

  describe('deleteGroup - additional cases', () => {
    it('should throw NotFoundException when group does not exist', async () => {
      // isAdmin check
      prisma.groupMember.findUnique.mockResolvedValueOnce({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      prisma.group.findUnique.mockResolvedValue(null);

      await expect(service.deleteGroup('group-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addCity', () => {
    it('should add city as admin', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      const city = { id: 'city-1', groupId: 'group-1', name: 'Madrid', lat: 40.42, lon: -3.7 };
      prisma.groupCity.create.mockResolvedValue(city);

      const result = await service.addCity('group-1', 'user-1', {
        name: 'Madrid',
        lat: 40.42,
        lon: -3.7,
      });

      expect(result).toEqual(city);
      expect(prisma.groupCity.create).toHaveBeenCalledWith({
        data: { groupId: 'group-1', name: 'Madrid', lat: 40.42, lon: -3.7 },
      });
    });

    it('should reject adding city from non-admin', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'member',
      });

      await expect(
        service.addCity('group-1', 'user-2', { name: 'Madrid', lat: 40.42, lon: -3.7 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getCities', () => {
    it('should return cities for group', async () => {
      prisma.group.findFirst.mockResolvedValue(createTestGroup());
      const cities = [
        { id: 'city-1', groupId: 'group-1', name: 'Madrid', lat: 40.42, lon: -3.7 },
        { id: 'city-2', groupId: 'group-1', name: 'Barcelona', lat: 41.39, lon: 2.17 },
      ];
      prisma.groupCity.findMany.mockResolvedValue(cities);

      const result = await service.getCities('group-1', 'user-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Madrid');
    });

    it('should throw NotFoundException when user is not a member', async () => {
      prisma.group.findFirst.mockResolvedValue(null);

      await expect(service.getCities('group-1', 'user-99')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeCity', () => {
    it('should remove city as admin', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      prisma.groupCity.findFirst.mockResolvedValue({
        id: 'city-1',
        groupId: 'group-1',
        name: 'Madrid',
      });
      prisma.groupCity.delete.mockResolvedValue({});

      const result = await service.removeCity('group-1', 'city-1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(prisma.groupCity.delete).toHaveBeenCalledWith({
        where: { id: 'city-1' },
      });
    });

    it('should reject removal from non-admin', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        groupId: 'group-1',
        userId: 'user-2',
        role: 'member',
      });

      await expect(service.removeCity('group-1', 'city-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when city does not exist', async () => {
      prisma.groupMember.findUnique.mockResolvedValue({
        groupId: 'group-1',
        userId: 'user-1',
        role: 'admin',
      });
      prisma.groupCity.findFirst.mockResolvedValue(null);

      await expect(service.removeCity('group-1', 'city-99', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
