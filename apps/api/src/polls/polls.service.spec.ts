import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PollsService } from './polls.service';
import { createMockPrisma, createMockNotificationsService } from '../common/test-utils';

describe('PollsService', () => {
  let service: PollsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let groupsService: { findById: jest.Mock; getMembers: jest.Mock };
  let notifications: ReturnType<typeof createMockNotificationsService>;
  let availability: { mergeFromPoll: jest.Mock };

  const MEMBERS = [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }];

  beforeEach(() => {
    prisma = createMockPrisma();
    groupsService = {
      findById: jest.fn().mockResolvedValue({ id: 'g1', name: 'Amigos' }),
      getMembers: jest.fn().mockResolvedValue(MEMBERS),
    };
    notifications = createMockNotificationsService();
    availability = { mergeFromPoll: jest.fn().mockResolvedValue({}) };
    service = new PollsService(
      prisma as never,
      groupsService as never,
      notifications as never,
      availability as never,
    );
  });

  describe('create', () => {
    it('rechaza duplicado abierto para el mismo día y franja', async () => {
      prisma.availabilityPoll.findFirst.mockResolvedValue({ id: 'p0', status: 'open' });

      await expect(service.create('g1', 'u1', { date: '2026-02-13' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('crea con la respuesta yes del creador, marca su disponibilidad y avisa al grupo', async () => {
      prisma.availabilityPoll.findFirst.mockResolvedValue(null);
      prisma.availabilityPoll.create.mockResolvedValue({
        id: 'p1',
        groupId: 'g1',
        date: new Date('2026-02-13'),
        slot: null,
        createdBy: { id: 'u1', name: 'Álvaro', avatarEmoji: '😊' },
      });

      const result = await service.create('g1', 'u1', { date: '2026-02-13' });

      expect(prisma.availabilityPoll.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            responses: { create: { userId: 'u1', answer: 'yes' } },
          }),
        }),
      );
      expect(availability.mergeFromPoll).toHaveBeenCalledWith('g1', 'u1', '2026-02-13', null);
      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'g1',
        expect.stringContaining('¿Puedes'),
        expect.any(String),
        'u1',
        expect.objectContaining({ type: 'new_poll', pollId: 'p1', groupId: 'g1' }),
        'new_poll',
      );
      expect(result.notified).toBe(true);
    });

    it('devuelve 409 si la creacion choca con el indice unico parcial', async () => {
      // Doble toque en «preguntar» con red lenta: el findFirst de los dos no ve
      // nada y el segundo INSERT es el que rebota contra el indice.
      prisma.availabilityPoll.findFirst.mockResolvedValue(null);
      prisma.availabilityPoll.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(service.create('g1', 'u1', { date: '2026-02-13' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('no traga otros errores de prisma como si fueran un duplicado', async () => {
      prisma.availabilityPoll.findFirst.mockResolvedValue(null);
      prisma.availabilityPoll.create.mockRejectedValue(
        Object.assign(new Error('connection lost'), { code: 'P1001' }),
      );

      await expect(service.create('g1', 'u1', { date: '2026-02-13' })).rejects.toThrow(
        'connection lost',
      );
    });

    it('con franja, la pregunta la nombra y la disponibilidad va por slots', async () => {
      prisma.availabilityPoll.findFirst.mockResolvedValue(null);
      prisma.availabilityPoll.create.mockResolvedValue({
        id: 'p1',
        groupId: 'g1',
        date: new Date('2026-02-13'),
        slot: 'Tarde',
        createdBy: { id: 'u1', name: 'Álvaro', avatarEmoji: '😊' },
      });

      await service.create('g1', 'u1', { date: '2026-02-13', slot: 'Tarde' });

      expect(availability.mergeFromPoll).toHaveBeenCalledWith('g1', 'u1', '2026-02-13', 'Tarde');
      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'g1',
        expect.stringContaining('por la tarde'),
        expect.any(String),
        'u1',
        expect.anything(),
        'new_poll',
      );
    });
  });

  describe('create — anti-spam', () => {
    it('el segundo sondeo del día se crea pero no manda push', async () => {
      prisma.availabilityPoll.findFirst.mockResolvedValue(null);
      prisma.availabilityPoll.create.mockResolvedValue({
        id: 'p2',
        groupId: 'g1',
        date: new Date('2026-02-14'),
        slot: null,
        createdBy: { id: 'u2', name: 'Sara', avatarEmoji: '😊' },
      });
      prisma.availabilityPoll.count.mockResolvedValue(2);

      const result = await service.create('g1', 'u2', { date: '2026-02-14' });

      expect(prisma.availabilityPoll.create).toHaveBeenCalled();
      expect(notifications.sendToGroup).not.toHaveBeenCalled();
      expect(result.notified).toBe(false);
    });

    it('la ventana del día se cuenta en hora española, no en UTC', async () => {
      // 00:30 del 14 en Madrid (CET, +1) = 23:30 del 13 en UTC.
      jest.useFakeTimers().setSystemTime(new Date('2026-02-13T23:30:00Z'));
      prisma.availabilityPoll.findFirst.mockResolvedValue(null);
      prisma.availabilityPoll.create.mockResolvedValue({
        id: 'p3',
        groupId: 'g1',
        date: new Date('2026-02-14'),
        slot: null,
        createdBy: { id: 'u1', name: 'Álvaro', avatarEmoji: '😊' },
      });

      await service.create('g1', 'u1', { date: '2026-02-14' });

      const { where } = prisma.availabilityPoll.count.mock.calls[0][0] as {
        where: { createdAt: { gte: Date } };
      };
      // Medianoche de Madrid = 23:00 UTC del día anterior, no 00:00 UTC.
      expect(where.createdAt.gte.toISOString()).toBe('2026-02-13T23:00:00.000Z');
      jest.useRealTimers();
    });
  });

  describe('respond', () => {
    const openPoll = {
      id: 'p1',
      groupId: 'g1',
      status: 'open',
      date: new Date('2026-02-13'),
      slot: null,
    };

    beforeEach(() => {
      prisma.availabilityPoll.findFirst.mockResolvedValue(openPoll);
      prisma.pollResponse.upsert.mockResolvedValue({});
    });

    it('es idempotente: upsert por (pollId,userId)', async () => {
      prisma.pollResponse.findMany.mockResolvedValue([
        { userId: 'u1', answer: 'yes' },
        { userId: 'u2', answer: 'yes' },
      ]);

      await service.respond('g1', 'p1', 'u2', { answer: 'yes' });

      expect(prisma.pollResponse.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pollId_userId: { pollId: 'p1', userId: 'u2' } },
        }),
      );
    });

    it('yes escribe disponibilidad; no y unsure no la tocan', async () => {
      prisma.pollResponse.findMany.mockResolvedValue([{ userId: 'u1', answer: 'yes' }]);

      await service.respond('g1', 'p1', 'u2', { answer: 'no' });
      expect(availability.mergeFromPoll).not.toHaveBeenCalled();

      await service.respond('g1', 'p1', 'u2', { answer: 'unsure' });
      expect(availability.mergeFromPoll).not.toHaveBeenCalled();

      await service.respond('g1', 'p1', 'u2', { answer: 'yes' });
      expect(availability.mergeFromPoll).toHaveBeenCalledWith('g1', 'u2', '2026-02-13', null);
    });

    it('cuando el último miembro dice yes: completed una sola vez + push poll_completed', async () => {
      prisma.pollResponse.findMany.mockResolvedValue(
        MEMBERS.map((m) => ({ userId: m.userId, answer: 'yes' })),
      );
      prisma.availabilityPoll.updateMany.mockResolvedValue({ count: 1 });

      await service.respond('g1', 'p1', 'u3', { answer: 'yes' });

      expect(prisma.availabilityPoll.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', status: 'open' },
        data: { status: 'completed', completedAt: expect.any(Date) },
      });
      expect(notifications.sendToGroup).toHaveBeenCalledWith(
        'g1',
        expect.stringContaining('aro'),
        expect.any(String),
        undefined,
        expect.objectContaining({ type: 'poll_completed', pollId: 'p1' }),
        'poll_completed',
      );
    });

    it('si updateMany devuelve count 0 (carrera), no reenvía poll_completed', async () => {
      prisma.pollResponse.findMany.mockResolvedValue(
        MEMBERS.map((m) => ({ userId: m.userId, answer: 'yes' })),
      );
      prisma.availabilityPoll.updateMany.mockResolvedValue({ count: 0 });

      await service.respond('g1', 'p1', 'u3', { answer: 'yes' });

      expect(notifications.sendToGroup).not.toHaveBeenCalled();
    });

    it('con un miembro sin responder no completa el sondeo', async () => {
      prisma.pollResponse.findMany.mockResolvedValue([
        { userId: 'u1', answer: 'yes' },
        { userId: 'u2', answer: 'yes' },
      ]);

      await service.respond('g1', 'p1', 'u2', { answer: 'yes' });

      expect(prisma.availabilityPoll.updateMany).not.toHaveBeenCalled();
      expect(notifications.sendToGroup).not.toHaveBeenCalled();
    });

    it('rechaza responder un sondeo no abierto', async () => {
      prisma.availabilityPoll.findFirst.mockResolvedValue({ ...openPoll, status: 'closed' });

      await expect(service.respond('g1', 'p1', 'u2', { answer: 'yes' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rechaza un sondeo inexistente', async () => {
      prisma.availabilityPoll.findFirst.mockResolvedValue(null);

      await expect(service.respond('g1', 'p1', 'u2', { answer: 'yes' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllForGroup', () => {
    it('exige pertenencia al grupo y devuelve abiertos y completados', async () => {
      prisma.availabilityPoll.findMany.mockResolvedValue([]);

      await service.findAllForGroup('g1', 'u1');

      expect(groupsService.findById).toHaveBeenCalledWith('g1', 'u1');
      expect(prisma.availabilityPoll.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId: 'g1', status: { in: ['open', 'completed'] } },
        }),
      );
    });
  });

  describe('close', () => {
    it('solo el creador puede cerrar', async () => {
      prisma.availabilityPoll.findFirst.mockResolvedValue({
        id: 'p1',
        createdById: 'u1',
        status: 'open',
      });

      await expect(service.close('g1', 'p1', 'u2')).rejects.toThrow(ForbiddenException);
    });

    it('el creador lo cierra', async () => {
      prisma.availabilityPoll.findFirst.mockResolvedValue({
        id: 'p1',
        createdById: 'u1',
        status: 'open',
      });
      prisma.availabilityPoll.update.mockResolvedValue({ id: 'p1', status: 'closed' });

      await service.close('g1', 'p1', 'u1');

      expect(prisma.availabilityPoll.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { status: 'closed' },
      });
    });
  });
});
