import { Test, TestingModule } from '@nestjs/testing';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { AuthGuard } from '../auth/auth.guard';

const mockAvailabilityService = {
  findAllForGroup: jest.fn(),
  findMyAvailability: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('AvailabilityController', () => {
  let controller: AvailabilityController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvailabilityController],
      providers: [{ provide: AvailabilityService, useValue: mockAvailabilityService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<AvailabilityController>(AvailabilityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call availabilityService.findAllForGroup with groupId and userId', async () => {
      const availabilities = [
        { id: 'av-1', groupId: 'group-1', userId: 'user-1', date: new Date('2026-03-01'), type: 'day' },
        { id: 'av-2', groupId: 'group-1', userId: 'user-2', date: new Date('2026-03-01'), type: 'slots' },
      ];
      mockAvailabilityService.findAllForGroup.mockResolvedValue(availabilities);

      const result = await controller.findAll('group-1', { id: 'user-1' });

      expect(result).toEqual(availabilities);
      expect(mockAvailabilityService.findAllForGroup).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockAvailabilityService.findAllForGroup).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no availability exists', async () => {
      mockAvailabilityService.findAllForGroup.mockResolvedValue([]);

      const result = await controller.findAll('group-1', { id: 'user-1' });

      expect(result).toEqual([]);
    });
  });

  describe('findMine', () => {
    it('should call availabilityService.findMyAvailability with groupId and userId', async () => {
      const myAvailabilities = [
        { id: 'av-1', groupId: 'group-1', userId: 'user-1', date: new Date('2026-03-01'), type: 'day' },
      ];
      mockAvailabilityService.findMyAvailability.mockResolvedValue(myAvailabilities);

      const result = await controller.findMine('group-1', { id: 'user-1' });

      expect(result).toEqual(myAvailabilities);
      expect(mockAvailabilityService.findMyAvailability).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockAvailabilityService.findMyAvailability).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    it('should call availabilityService.create with groupId, userId, and dto', async () => {
      const dto = { date: '2026-03-15', type: 'day' as const };
      const created = { id: 'av-new', groupId: 'group-1', userId: 'user-1', ...dto };
      mockAvailabilityService.create.mockResolvedValue(created);

      const result = await controller.create('group-1', { id: 'user-1' }, dto);

      expect(result).toEqual(created);
      expect(mockAvailabilityService.create).toHaveBeenCalledWith('group-1', 'user-1', dto);
      expect(mockAvailabilityService.create).toHaveBeenCalledTimes(1);
    });

    it('should pass slots type dto to service', async () => {
      const dto = { date: '2026-03-15', type: 'slots' as const, slots: ['morning', 'afternoon'] };
      mockAvailabilityService.create.mockResolvedValue({ id: 'av-new', ...dto });

      await controller.create('group-1', { id: 'user-1' }, dto);

      expect(mockAvailabilityService.create).toHaveBeenCalledWith('group-1', 'user-1', dto);
    });

    it('should pass range type dto to service', async () => {
      const dto = { date: '2026-03-15', type: 'range' as const, startTime: '09:00', endTime: '17:00' };
      mockAvailabilityService.create.mockResolvedValue({ id: 'av-new', ...dto });

      await controller.create('group-1', { id: 'user-1' }, dto);

      expect(mockAvailabilityService.create).toHaveBeenCalledWith('group-1', 'user-1', dto);
    });
  });

  describe('update', () => {
    it('should call availabilityService.update with groupId, date, userId, and dto', async () => {
      const dto = { date: '2026-03-15', type: 'slots' as const, slots: ['night'] };
      const updated = { id: 'av-1', ...dto };
      mockAvailabilityService.update.mockResolvedValue(updated);

      const result = await controller.update('group-1', '2026-03-15', { id: 'user-1' }, dto);

      expect(result).toEqual(updated);
      expect(mockAvailabilityService.update).toHaveBeenCalledWith(
        'group-1',
        '2026-03-15',
        'user-1',
        dto,
      );
      expect(mockAvailabilityService.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete', () => {
    it('should call availabilityService.delete with groupId, date, and userId', async () => {
      mockAvailabilityService.delete.mockResolvedValue({ success: true });

      const result = await controller.delete('group-1', '2026-03-15', { id: 'user-1' });

      expect(result).toEqual({ success: true });
      expect(mockAvailabilityService.delete).toHaveBeenCalledWith('group-1', '2026-03-15', 'user-1');
      expect(mockAvailabilityService.delete).toHaveBeenCalledTimes(1);
    });
  });
});
