import { NotFoundException } from '@nestjs/common';
import { WidgetSummaryService } from './widget-summary.service';
import { createMockPrisma, MockPrisma } from '../common/test-utils';

const GROUP = {
  id: 'group-1',
  name: 'Cuadrilla',
  emoji: '👥',
  members: [
    {
      userId: 'u-b',
      joinedAt: new Date('2026-01-02'),
      role: 'member',
      user: { id: 'u-b', name: 'B', avatarEmoji: '😊' },
    },
    {
      userId: 'u-a',
      joinedAt: new Date('2026-01-01'),
      role: 'admin',
      user: { id: 'u-a', name: 'A', avatarEmoji: '😊' },
    },
    {
      userId: 'u-c',
      joinedAt: new Date('2026-01-02'),
      role: 'member',
      user: { id: 'u-c', name: 'C', avatarEmoji: '😊' },
    },
  ],
};

function avail(userId: string, date: string) {
  return { userId, date: new Date(`${date}T00:00:00.000Z`) };
}

describe('WidgetSummaryService', () => {
  let service: WidgetSummaryService;
  let prisma: MockPrisma;
  const findById = jest.fn();

  beforeEach(() => {
    prisma = createMockPrisma();
    findById.mockReset().mockResolvedValue(GROUP);
    prisma.availability.findMany.mockResolvedValue([]);
    prisma.event.findMany.mockResolvedValue([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new WidgetSummaryService(prisma as any, { findById } as any);
  });

  it('propagates membership errors from GroupsService.findById', async () => {
    findById.mockRejectedValue(new NotFoundException('Group not found'));
    await expect(
      service.getSummary('intruder', 'group-1', '2026-08-31', '2026-09-02'),
    ).rejects.toThrow(NotFoundException);
  });

  it('orders members by joinedAt asc with userId tiebreak and assigns colorIndex mod 6', async () => {
    const s = await service.getSummary('u-a', 'group-1', '2026-08-31', '2026-09-02');
    expect(s.members.map((m) => m.id)).toEqual(['u-a', 'u-b', 'u-c']);
    expect(s.members.map((m) => m.colorIndex)).toEqual([0, 1, 2]);
  });

  it('emits exactly 7 days from weekStart with plain YYYY-MM-DD dates', async () => {
    const s = await service.getSummary('u-a', 'group-1', '2026-08-31', '2026-09-02');
    expect(s.days.map((d) => d.date)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
  });

  it('maps availability presence into availableMemberIds', async () => {
    prisma.availability.findMany.mockResolvedValue([
      avail('u-a', '2026-09-02'),
      avail('u-b', '2026-09-02'),
      avail('u-a', '2026-09-04'),
    ]);
    const s = await service.getSummary('u-a', 'group-1', '2026-08-31', '2026-09-02');
    expect(s.days[2].availableMemberIds.sort()).toEqual(['u-a', 'u-b']);
    expect(s.days[4].availableMemberIds).toEqual(['u-a']);
    expect(s.days[0].availableMemberIds).toEqual([]);
  });

  it('excludes availability rows from users who are no longer group members', async () => {
    prisma.availability.findMany.mockResolvedValue([
      avail('u-a', '2026-09-04'),
      avail('u-b', '2026-09-04'),
      // Orphaned row from a kicked member: GroupsService.kickMember removes the
      // groupMember row but never cleans up availability (unlike leave()).
      avail('u-ghost', '2026-09-04'),
    ]);
    const s = await service.getSummary('u-a', 'group-1', '2026-08-31', '2026-09-02');
    expect(s.days[4].availableMemberIds.sort()).toEqual(['u-a', 'u-b']);
    expect(s.bestDay).toEqual({ date: '2026-09-04', count: 2, closesAro: false });
  });

  it('flags hasEvent only for non-cancelled events', async () => {
    prisma.event.findMany.mockResolvedValue([{ date: new Date('2026-09-03T00:00:00.000Z') }]);
    const s = await service.getSummary('u-a', 'group-1', '2026-08-31', '2026-09-02');
    expect(s.days[3].hasEvent).toBe(true);
    expect(s.days[2].hasEvent).toBe(false);
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'cancelled' } }),
      }),
    );
  });

  describe('bestDay', () => {
    it('is null when no future day reaches 2 people', async () => {
      prisma.availability.findMany.mockResolvedValue([avail('u-a', '2026-09-04')]);
      const s = await service.getSummary('u-a', 'group-1', '2026-08-31', '2026-09-02');
      expect(s.bestDay).toBeNull();
    });

    it('ignores days before today', async () => {
      prisma.availability.findMany.mockResolvedValue([
        avail('u-a', '2026-09-01'),
        avail('u-b', '2026-09-01'),
        avail('u-c', '2026-09-01'),
      ]);
      const s = await service.getSummary('u-a', 'group-1', '2026-08-31', '2026-09-02');
      expect(s.bestDay).toBeNull();
    });

    it('picks the highest count with earliest-date tiebreak', async () => {
      prisma.availability.findMany.mockResolvedValue([
        avail('u-a', '2026-09-05'),
        avail('u-b', '2026-09-05'),
        avail('u-a', '2026-09-03'),
        avail('u-b', '2026-09-03'),
        avail('u-a', '2026-09-04'),
        avail('u-b', '2026-09-04'),
        avail('u-c', '2026-09-04'),
      ]);
      const s = await service.getSummary('u-a', 'group-1', '2026-08-31', '2026-09-02');
      expect(s.bestDay).toEqual({ date: '2026-09-04', count: 3, closesAro: true });
    });

    it('excludes days that already have an active event', async () => {
      prisma.availability.findMany.mockResolvedValue([
        avail('u-a', '2026-09-04'),
        avail('u-b', '2026-09-04'),
        avail('u-c', '2026-09-04'),
        avail('u-a', '2026-09-05'),
        avail('u-b', '2026-09-05'),
      ]);
      prisma.event.findMany.mockResolvedValue([{ date: new Date('2026-09-04T00:00:00.000Z') }]);
      const s = await service.getSummary('u-a', 'group-1', '2026-08-31', '2026-09-02');
      expect(s.bestDay).toEqual({ date: '2026-09-05', count: 2, closesAro: false });
    });

    it('can live outside the requested week', async () => {
      prisma.availability.findMany.mockResolvedValue([
        avail('u-a', '2026-09-12'),
        avail('u-b', '2026-09-12'),
      ]);
      const s = await service.getSummary('u-a', 'group-1', '2026-08-31', '2026-09-02');
      expect(s.bestDay).toEqual({ date: '2026-09-12', count: 2, closesAro: false });
    });
  });

  describe('best-day horizon', () => {
    it('ignores availability past the horizon when choosing bestDay', async () => {
      prisma.availability.findMany.mockResolvedValue([
        avail('u-a', '2026-09-04'),
        avail('u-b', '2026-09-04'),
        // Las fiestas del pueblo dentro de tres meses: votadas por todos, pero
        // no son "el mejor dia" del widget 2x2.
        avail('u-a', '2026-12-01'),
        avail('u-b', '2026-12-01'),
        avail('u-c', '2026-12-01'),
      ]);

      const s = await service.getSummary('u-a', 'group-1', '2026-08-31', '2026-09-02');

      expect(s.bestDay?.date).toBe('2026-09-04');
    });

    it('bounds both queries with an upper limit 28 days out', async () => {
      await service.getSummary('u-a', 'group-1', '2026-08-31', '2026-09-02');

      // La ventana arranca en el menor de weekStart/today: 2026-08-31 + 28 = 2026-09-28.
      const range = {
        gte: new Date('2026-08-31T00:00:00.000Z'),
        lt: new Date('2026-09-28T00:00:00.000Z'),
      };
      expect(prisma.availability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ date: range }) }),
      );
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ date: range }) }),
      );
    });
  });
});
