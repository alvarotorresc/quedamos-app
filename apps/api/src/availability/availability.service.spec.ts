import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { GroupsService } from '../groups/groups.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { createMockPrisma, createTestGroup } from '../common/test-utils';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let groupsService: jest.Mocked<Partial<GroupsService>>;

  beforeEach(() => {
    prisma = createMockPrisma();
    groupsService = { findById: jest.fn().mockResolvedValue(createTestGroup()) };
    service = new AvailabilityService(
      prisma as unknown as PrismaService,
      groupsService as unknown as GroupsService,
    );
  });

  describe('findAllForGroup', () => {
    it('should return all availability for group', async () => {
      const items = [
        { id: '1', userId: 'user-1', groupId: 'group-1', date: new Date(), type: 'day' },
        { id: '2', userId: 'user-2', groupId: 'group-1', date: new Date(), type: 'slots' },
      ];
      prisma.availability.findMany.mockResolvedValue(items);

      const result = await service.findAllForGroup('group-1', 'user-1');

      expect(result).toHaveLength(2);
      expect(groupsService.findById).toHaveBeenCalledWith('group-1', 'user-1');
    });
  });

  describe('findMyAvailability', () => {
    it('should return only user availability', async () => {
      const items = [
        { id: '1', userId: 'user-1', groupId: 'group-1', date: new Date(), type: 'day' },
      ];
      prisma.availability.findMany.mockResolvedValue(items);

      const result = await service.findMyAvailability('group-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(prisma.availability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { groupId: 'group-1', userId: 'user-1' } }),
      );
    });
  });

  describe('create', () => {
    it('should upsert availability', async () => {
      const availability = { id: '1', userId: 'user-1', groupId: 'group-1', type: 'day' };
      prisma.availability.upsert.mockResolvedValue(availability);

      const result = await service.create('group-1', 'user-1', {
        date: '2026-03-01',
        type: 'day',
      });

      expect(result).toEqual(availability);
      expect(prisma.availability.upsert).toHaveBeenCalled();
    });

    it('should pass slots for slots type', async () => {
      prisma.availability.upsert.mockResolvedValue({});

      await service.create('group-1', 'user-1', {
        date: '2026-03-01',
        type: 'slots',
        slots: ['Mañana', 'Tarde'],
      });

      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ slots: ['Mañana', 'Tarde'] }),
        }),
      );
    });

    it('should reject range type without startTime', async () => {
      await expect(
        service.create('group-1', 'user-1', { date: '2026-06-01', type: 'range' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject range type without endTime', async () => {
      await expect(
        service.create('group-1', 'user-1', {
          date: '2026-06-01',
          type: 'range',
          startTime: '10:00',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject slots type without slots array', async () => {
      await expect(
        service.create('group-1', 'user-1', { date: '2026-06-01', type: 'slots' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject slots type with empty slots array', async () => {
      await expect(
        service.create('group-1', 'user-1', { date: '2026-06-01', type: 'slots', slots: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('date format validation', () => {
    it('should reject invalid date format in update', async () => {
      await expect(
        service.update('group-1', 'INVALID', 'user-1', { date: '2026-03-01', type: 'day' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid date format in delete', async () => {
      await expect(service.delete('group-1', 'not-a-date', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject partial date format in update', async () => {
      await expect(
        service.update('group-1', '2026-03', 'user-1', { date: '2026-03-01', type: 'day' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject date with extra characters in delete', async () => {
      await expect(service.delete('group-1', '2026-03-01T00:00', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept valid YYYY-MM-DD date in update', async () => {
      prisma.availability.findUnique.mockResolvedValue({ id: '1' });
      prisma.availability.update.mockResolvedValue({ id: '1', type: 'day' });

      await expect(
        service.update('group-1', '2026-03-01', 'user-1', { date: '2026-03-01', type: 'day' }),
      ).resolves.toBeDefined();
    });

    it('should accept valid YYYY-MM-DD date in delete', async () => {
      prisma.availability.findUnique.mockResolvedValue({ id: '1' });
      prisma.availability.delete.mockResolvedValue({});

      await expect(service.delete('group-1', '2026-03-01', 'user-1')).resolves.toBeDefined();
    });
  });

  describe('update', () => {
    it('should update existing availability', async () => {
      const existing = { id: '1' };
      prisma.availability.findUnique.mockResolvedValue(existing);
      prisma.availability.update.mockResolvedValue({ ...existing, type: 'slots' });

      const result = await service.update('group-1', '2026-03-01', 'user-1', {
        date: '2026-03-01',
        type: 'slots',
        slots: ['Noche'],
      });

      expect(result).toBeDefined();
      expect(prisma.availability.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: expect.objectContaining({ type: 'slots', slots: ['Noche'] }),
        }),
      );
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.availability.findUnique.mockResolvedValue(null);

      await expect(
        service.update('group-1', '2026-03-01', 'user-1', { date: '2026-03-01', type: 'day' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject range type without startTime', async () => {
      await expect(
        service.update('group-1', '2026-06-01', 'user-1', { date: '2026-06-01', type: 'range' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject slots type without slots array', async () => {
      await expect(
        service.update('group-1', '2026-06-01', 'user-1', { date: '2026-06-01', type: 'slots' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should delete existing availability', async () => {
      prisma.availability.findUnique.mockResolvedValue({ id: '1' });
      prisma.availability.delete.mockResolvedValue({});

      const result = await service.delete('group-1', '2026-03-01', 'user-1');

      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.availability.findUnique.mockResolvedValue(null);

      await expect(service.delete('group-1', '2026-03-01', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
