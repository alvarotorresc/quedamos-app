import { Test, TestingModule } from '@nestjs/testing';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { AuthGuard } from '../auth/auth.guard';
import { createTestGroup, createTestUser } from '../common/test-utils';

const mockGroupsService = {
  create: jest.fn(),
  findAllForUser: jest.fn(),
  findById: jest.fn(),
  joinByCode: jest.fn(),
  leave: jest.fn(),
  getMembers: jest.fn(),
  getInviteInfo: jest.fn(),
  refreshInviteCode: jest.fn(),
  addCity: jest.fn(),
  getCities: jest.fn(),
  removeCity: jest.fn(),
  updateMemberRole: jest.fn(),
  kickMember: jest.fn(),
  deleteGroup: jest.fn(),
};

const mockAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('GroupsController', () => {
  let controller: GroupsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupsController],
      providers: [{ provide: GroupsService, useValue: mockGroupsService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<GroupsController>(GroupsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call groupsService.create with userId and dto', async () => {
      const group = createTestGroup();
      const dto = { name: 'New Group', emoji: '🎯' };
      mockGroupsService.create.mockResolvedValue(group);

      const result = await controller.create({ id: 'user-1' }, dto);

      expect(result).toEqual(group);
      expect(mockGroupsService.create).toHaveBeenCalledWith('user-1', dto);
      expect(mockGroupsService.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should call groupsService.findAllForUser with userId', async () => {
      const groups = [createTestGroup(), createTestGroup({ id: 'group-2', name: 'Group 2' })];
      mockGroupsService.findAllForUser.mockResolvedValue(groups);

      const result = await controller.findAll({ id: 'user-1' });

      expect(result).toEqual(groups);
      expect(mockGroupsService.findAllForUser).toHaveBeenCalledWith('user-1');
      expect(mockGroupsService.findAllForUser).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when user has no groups', async () => {
      mockGroupsService.findAllForUser.mockResolvedValue([]);

      const result = await controller.findAll({ id: 'user-1' });

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should call groupsService.findById with groupId and userId', async () => {
      const group = createTestGroup();
      mockGroupsService.findById.mockResolvedValue(group);

      const result = await controller.findOne({ id: 'user-1' }, 'group-1');

      expect(result).toEqual(group);
      expect(mockGroupsService.findById).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockGroupsService.findById).toHaveBeenCalledTimes(1);
    });
  });

  describe('join', () => {
    it('should call groupsService.joinByCode with userId and invite code from dto', async () => {
      const group = createTestGroup();
      mockGroupsService.joinByCode.mockResolvedValue(group);

      const result = await controller.join({ id: 'user-1' }, { inviteCode: '12345678' });

      expect(result).toEqual(group);
      expect(mockGroupsService.joinByCode).toHaveBeenCalledWith('user-1', '12345678');
      expect(mockGroupsService.joinByCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('leave', () => {
    it('should call groupsService.leave with groupId and userId', async () => {
      mockGroupsService.leave.mockResolvedValue({ success: true });

      const result = await controller.leave({ id: 'user-1' }, 'group-1');

      expect(result).toEqual({ success: true });
      expect(mockGroupsService.leave).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockGroupsService.leave).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMembers', () => {
    it('should call groupsService.getMembers with groupId and userId', async () => {
      const members = [
        { userId: 'user-1', user: createTestUser() },
        { userId: 'user-2', user: createTestUser({ id: 'user-2', name: 'User 2' }) },
      ];
      mockGroupsService.getMembers.mockResolvedValue(members);

      const result = await controller.getMembers({ id: 'user-1' }, 'group-1');

      expect(result).toEqual(members);
      expect(mockGroupsService.getMembers).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockGroupsService.getMembers).toHaveBeenCalledTimes(1);
    });
  });

  describe('getInvite', () => {
    it('should call groupsService.getInviteInfo with groupId and userId', async () => {
      const inviteInfo = { inviteCode: '12345678', inviteUrl: 'https://example.com/join/12345678' };
      mockGroupsService.getInviteInfo.mockResolvedValue(inviteInfo);

      const result = await controller.getInvite({ id: 'user-1' }, 'group-1');

      expect(result).toEqual(inviteInfo);
      expect(mockGroupsService.getInviteInfo).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockGroupsService.getInviteInfo).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshInvite', () => {
    it('should call groupsService.refreshInviteCode with groupId and userId', async () => {
      const newInvite = { inviteCode: '87654321', inviteUrl: 'https://example.com/join/87654321' };
      mockGroupsService.refreshInviteCode.mockResolvedValue(newInvite);

      const result = await controller.refreshInvite({ id: 'user-1' }, 'group-1');

      expect(result).toEqual(newInvite);
      expect(mockGroupsService.refreshInviteCode).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockGroupsService.refreshInviteCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('addCity', () => {
    it('should call groupsService.addCity with groupId, userId, and dto', async () => {
      const city = { id: 'city-1', name: 'Madrid', lat: 40.4168, lon: -3.7038, groupId: 'group-1' };
      const dto = { name: 'Madrid', lat: 40.4168, lon: -3.7038 };
      mockGroupsService.addCity.mockResolvedValue(city);

      const result = await controller.addCity('group-1', { id: 'user-1' }, dto);

      expect(result).toEqual(city);
      expect(mockGroupsService.addCity).toHaveBeenCalledWith('group-1', 'user-1', dto);
      expect(mockGroupsService.addCity).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCities', () => {
    it('should call groupsService.getCities with groupId and userId', async () => {
      const cities = [
        { id: 'city-1', name: 'Madrid', groupId: 'group-1' },
        { id: 'city-2', name: 'Barcelona', groupId: 'group-1' },
      ];
      mockGroupsService.getCities.mockResolvedValue(cities);

      const result = await controller.getCities('group-1', { id: 'user-1' });

      expect(result).toEqual(cities);
      expect(mockGroupsService.getCities).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockGroupsService.getCities).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeCity', () => {
    it('should call groupsService.removeCity with groupId, cityId, and userId', async () => {
      mockGroupsService.removeCity.mockResolvedValue({ success: true });

      const result = await controller.removeCity('group-1', 'city-1', { id: 'user-1' });

      expect(result).toEqual({ success: true });
      expect(mockGroupsService.removeCity).toHaveBeenCalledWith('group-1', 'city-1', 'user-1');
      expect(mockGroupsService.removeCity).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateMemberRole', () => {
    it('should call groupsService.updateMemberRole with groupId, userId, currentUser, and role', async () => {
      mockGroupsService.updateMemberRole.mockResolvedValue({ success: true });

      const result = await controller.updateMemberRole(
        'group-1',
        'user-2',
        { id: 'user-1' },
        { role: 'admin' },
      );

      expect(result).toEqual({ success: true });
      expect(mockGroupsService.updateMemberRole).toHaveBeenCalledWith(
        'group-1',
        'user-2',
        'user-1',
        'admin',
      );
      expect(mockGroupsService.updateMemberRole).toHaveBeenCalledTimes(1);
    });
  });

  describe('kickMember', () => {
    it('should call groupsService.kickMember with groupId, userId, and currentUser', async () => {
      mockGroupsService.kickMember.mockResolvedValue({ success: true });

      const result = await controller.kickMember('group-1', 'user-2', { id: 'user-1' });

      expect(result).toEqual({ success: true });
      expect(mockGroupsService.kickMember).toHaveBeenCalledWith('group-1', 'user-2', 'user-1');
      expect(mockGroupsService.kickMember).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteGroup', () => {
    it('should call groupsService.deleteGroup with groupId and userId', async () => {
      mockGroupsService.deleteGroup.mockResolvedValue({ success: true });

      const result = await controller.deleteGroup('group-1', { id: 'user-1' });

      expect(result).toEqual({ success: true });
      expect(mockGroupsService.deleteGroup).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockGroupsService.deleteGroup).toHaveBeenCalledTimes(1);
    });
  });
});
