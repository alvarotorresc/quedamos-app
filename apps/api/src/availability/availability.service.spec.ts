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

    it('should reject a range whose endTime is not after startTime', async () => {
      for (const [startTime, endTime] of [
        ['22:00', '08:00'],
        ['18:00', '18:00'],
      ]) {
        await expect(
          service.create('group-1', 'user-1', {
            date: '2026-06-01',
            type: 'range',
            startTime,
            endTime,
          }),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('should clear startTime and endTime when the type is not range', async () => {
      prisma.availability.upsert.mockResolvedValue({});

      await service.create('group-1', 'user-1', { date: '2026-03-01', type: 'day' });

      // undefined would mean "leave as is" on the update branch, keeping the old range.
      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ startTime: null, endTime: null }),
          create: expect.objectContaining({ startTime: null, endTime: null }),
        }),
      );
    });

    it('should keep the times when the type is range', async () => {
      prisma.availability.upsert.mockResolvedValue({});

      await service.create('group-1', 'user-1', {
        date: '2026-03-01',
        type: 'range',
        startTime: '18:00',
        endTime: '22:00',
      });

      expect(prisma.availability.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ startTime: '18:00', endTime: '22:00' }),
        }),
      );
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

    it('should reject an impossible calendar date in update and delete', async () => {
      await expect(
        service.update('group-1', '2026-02-30', 'user-1', { date: '2026-02-30', type: 'day' }),
      ).rejects.toThrow(BadRequestException);
      await expect(service.delete('group-1', '2026-13-01', 'user-1')).rejects.toThrow(
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

    it('should clear the stored range when switching to day', async () => {
      prisma.availability.findUnique.mockResolvedValue({
        id: '1',
        type: 'range',
        startTime: '18:00',
        endTime: '22:00',
      });
      prisma.availability.update.mockResolvedValue({});

      await service.update('group-1', '2026-03-01', 'user-1', {
        date: '2026-03-01',
        type: 'day',
      });

      expect(prisma.availability.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'day', startTime: null, endTime: null }),
        }),
      );
    });
  });

  // I1 — never degrade availability already marked. One test per cell of the merge
  // table (existing row × poll shape) from final-fix-wave-brief.md.
  describe('mergeFromPoll', () => {
    it('sin fila existente y sondeo sin franja: crea type=day', async () => {
      prisma.availability.findUnique.mockResolvedValue(null);
      prisma.availability.create.mockResolvedValue({ id: 'a1', type: 'day' });

      await service.mergeFromPoll('group-1', 'user-1', '2026-03-01', null);

      expect(prisma.availability.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          groupId: 'group-1',
          date: new Date('2026-03-01'),
          type: 'day',
          slots: [],
        },
      });
    });

    it('sin fila existente y sondeo con franja: crea type=slots con esa franja', async () => {
      prisma.availability.findUnique.mockResolvedValue(null);
      prisma.availability.create.mockResolvedValue({ id: 'a1', type: 'slots' });

      await service.mergeFromPoll('group-1', 'user-1', '2026-03-01', 'Tarde');

      expect(prisma.availability.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          groupId: 'group-1',
          date: new Date('2026-03-01'),
          type: 'slots',
          slots: ['Tarde'],
        },
      });
    });

    it('fila existente type=day y sondeo sin franja: no toca nada', async () => {
      const existing = { id: 'a1', type: 'day', slots: [] };
      prisma.availability.findUnique.mockResolvedValue(existing);

      const result = await service.mergeFromPoll('group-1', 'user-1', '2026-03-01', null);

      expect(prisma.availability.update).not.toHaveBeenCalled();
      expect(prisma.availability.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('fila existente type=day y sondeo con franja: no toca nada (el día ya cubre la franja)', async () => {
      const existing = { id: 'a1', type: 'day', slots: [] };
      prisma.availability.findUnique.mockResolvedValue(existing);

      await service.mergeFromPoll('group-1', 'user-1', '2026-03-01', 'Tarde');

      expect(prisma.availability.update).not.toHaveBeenCalled();
      expect(prisma.availability.create).not.toHaveBeenCalled();
    });

    it('fila existente type=slots y sondeo sin franja: amplía a day (permitido)', async () => {
      prisma.availability.findUnique.mockResolvedValue({
        id: 'a1',
        type: 'slots',
        slots: ['Mañana'],
      });
      prisma.availability.update.mockResolvedValue({ id: 'a1', type: 'day' });

      await service.mergeFromPoll('group-1', 'user-1', '2026-03-01', null);

      // Los nulls son deliberados: la rama iguala a la de 'range' para no dejar
      // horas fantasma en filas anteriores al arreglo de create()/update().
      expect(prisma.availability.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { type: 'day', slots: [], startTime: null, endTime: null },
      });
    });

    it('fila existente type=slots con hora antigua y sondeo sin franja: limpia el rango fantasma', async () => {
      // Filas anteriores al arreglo de create/update pueden ser type=slots conservando
      // start_time; al ampliarlas a day hay que borrarlo o el modal lo repinta.
      prisma.availability.findUnique.mockResolvedValue({
        id: 'a1',
        type: 'slots',
        slots: ['Tarde'],
        startTime: '18:00',
        endTime: '22:00',
      });
      prisma.availability.update.mockResolvedValue({});

      await service.mergeFromPoll('group-1', 'user-1', '2026-03-01', null);

      expect(prisma.availability.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { type: 'day', slots: [], startTime: null, endTime: null },
      });
    });

    it('fila existente type=slots y sondeo con franja nueva: la añade preservando el orden existente', async () => {
      prisma.availability.findUnique.mockResolvedValue({
        id: 'a1',
        type: 'slots',
        slots: ['Mañana'],
      });
      prisma.availability.update.mockResolvedValue({ id: 'a1', type: 'slots' });

      await service.mergeFromPoll('group-1', 'user-1', '2026-03-01', 'Tarde');

      expect(prisma.availability.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { slots: ['Mañana', 'Tarde'] },
      });
    });

    it('fila existente type=slots y sondeo con franja ya presente: no toca nada (idempotente)', async () => {
      const existing = { id: 'a1', type: 'slots', slots: ['Tarde'] };
      prisma.availability.findUnique.mockResolvedValue(existing);

      const result = await service.mergeFromPoll('group-1', 'user-1', '2026-03-01', 'Tarde');

      expect(prisma.availability.update).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('fila existente type=range y sondeo sin franja: amplía a day (permitido)', async () => {
      prisma.availability.findUnique.mockResolvedValue({
        id: 'a1',
        type: 'range',
        slots: [],
        startTime: '18:00',
        endTime: '20:00',
      });
      prisma.availability.update.mockResolvedValue({ id: 'a1', type: 'day' });

      await service.mergeFromPoll('group-1', 'user-1', '2026-03-01', null);

      expect(prisma.availability.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { type: 'day', slots: [], startTime: null, endTime: null },
      });
    });

    it('fila existente type=range y sondeo con franja: queda intacta (nunca destruir un rango preciso)', async () => {
      const existing = {
        id: 'a1',
        type: 'range',
        slots: [],
        startTime: '18:00',
        endTime: '20:00',
      };
      prisma.availability.findUnique.mockResolvedValue(existing);

      const result = await service.mergeFromPoll('group-1', 'user-1', '2026-03-01', 'Noche');

      expect(prisma.availability.update).not.toHaveBeenCalled();
      expect(prisma.availability.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
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
