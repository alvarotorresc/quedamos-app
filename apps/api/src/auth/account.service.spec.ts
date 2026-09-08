import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { createMockConfigService, createMockPrisma, MockPrisma } from '../common/test-utils';

const USER = 'user-1';
const SERVICE_KEY = 'service-role-key';

interface MemberRow {
  userId: string;
  role: string;
  joinedAt: Date;
}

function member(userId: string, role: string, day: number): MemberRow {
  return { userId, role, joinedAt: new Date(`2026-01-${String(day).padStart(2, '0')}`) };
}

function groupRow(id: string, createdById: string, members: MemberRow[]) {
  return { id, name: `Group ${id}`, createdById, members };
}

describe('AccountService', () => {
  let service: AccountService;
  let prisma: MockPrisma;
  let fetchMock: jest.Mock;

  async function build(configOverrides: Record<string, string> = {}) {
    prisma = createMockPrisma();
    const config = createMockConfigService({
      SUPABASE_SERVICE_KEY: SERVICE_KEY,
      ...configOverrides,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(AccountService);
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    service.setFetch(fetchMock as unknown as typeof fetch);

    // Defaults: the user exists and authored nothing anywhere.
    prisma.user.findUnique.mockResolvedValue({ id: USER });
    prisma.event.findMany.mockResolvedValue([]);
    prisma.planProposal.findMany.mockResolvedValue([]);
    prisma.availabilityPoll.findMany.mockResolvedValue([]);
    prisma.group.findMany.mockResolvedValue([]);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    await build();
  });

  describe('deleteAccount', () => {
    it('refuses with 503 and touches nothing when the service key is missing', async () => {
      await build({ SUPABASE_SERVICE_KEY: '' });

      await expect(service.deleteAccount(USER)).rejects.toBeInstanceOf(ServiceUnavailableException);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('returns 404 when the user row is already gone', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteAccount(USER)).rejects.toBeInstanceOf(NotFoundException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('deletes the auth user through the Supabase Admin API before touching the database', async () => {
      const calls: string[] = [];
      fetchMock.mockImplementation(async () => {
        calls.push('supabase');
        return { ok: true, status: 200 };
      });
      prisma.$transaction.mockImplementation(async (fn: (tx: MockPrisma) => unknown) => {
        calls.push('prisma');
        return fn(prisma);
      });

      const result = await service.deleteAccount(USER);

      expect(fetchMock).toHaveBeenCalledWith(
        `https://test.supabase.co/auth/v1/admin/users/${USER}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
          signal: expect.any(AbortSignal),
        }),
      );
      expect(calls).toEqual(['supabase', 'prisma']);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: USER } });
      expect(result).toEqual({ success: true, groupsDeleted: 0, groupsTransferred: 0 });
    });

    it('leaves the database untouched when Supabase answers with an error', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      await expect(service.deleteAccount(USER)).rejects.toBeInstanceOf(BadGatewayException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(prisma.group.delete).not.toHaveBeenCalled();
    });

    it('leaves the database untouched when the Supabase request fails or times out', async () => {
      fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));

      await expect(service.deleteAccount(USER)).rejects.toBeInstanceOf(BadGatewayException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('treats a 404 from Supabase as already deleted and finishes the database side', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });

      await expect(service.deleteAccount(USER)).resolves.toMatchObject({ success: true });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: USER } });
    });

    it('deletes the groups the user founded alone', async () => {
      prisma.group.findMany.mockResolvedValue([
        groupRow('g-solo', USER, [member(USER, 'admin', 1)]),
        groupRow('g-empty', USER, []),
      ]);

      const result = await service.deleteAccount(USER);

      expect(prisma.group.delete).toHaveBeenCalledWith({ where: { id: 'g-solo' } });
      expect(prisma.group.delete).toHaveBeenCalledWith({ where: { id: 'g-empty' } });
      expect(prisma.group.update).not.toHaveBeenCalled();
      expect(prisma.event.updateMany).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, groupsDeleted: 2, groupsTransferred: 0 });
    });

    it('hands a founded group to its oldest admin and reassigns what the user authored there', async () => {
      prisma.group.findMany.mockResolvedValue([
        groupRow('g-1', USER, [
          member(USER, 'admin', 1),
          member('member-old', 'member', 2),
          member('admin-old', 'admin', 3),
          member('admin-new', 'admin', 4),
        ]),
      ]);

      const result = await service.deleteAccount(USER);

      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: 'g-1' },
        data: { createdById: 'admin-old' },
      });
      expect(prisma.groupMember.update).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId: 'g-1', userId: 'admin-old' } },
        data: { role: 'admin' },
      });
      const reassign = {
        where: { groupId: 'g-1', createdById: USER },
        data: { createdById: 'admin-old' },
      };
      expect(prisma.event.updateMany).toHaveBeenCalledWith(reassign);
      expect(prisma.planProposal.updateMany).toHaveBeenCalledWith(reassign);
      expect(prisma.availabilityPoll.updateMany).toHaveBeenCalledWith(reassign);
      expect(prisma.group.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, groupsDeleted: 0, groupsTransferred: 1 });
    });

    it('falls back to the oldest member when the founder was the only admin', async () => {
      prisma.group.findMany.mockResolvedValue([
        groupRow('g-1', USER, [
          member(USER, 'admin', 1),
          member('member-old', 'member', 2),
          member('member-new', 'member', 3),
        ]),
      ]);

      await service.deleteAccount(USER);

      expect(prisma.group.update).toHaveBeenCalledWith({
        where: { id: 'g-1' },
        data: { createdById: 'member-old' },
      });
      expect(prisma.groupMember.update).toHaveBeenCalledWith({
        where: { groupId_userId: { groupId: 'g-1', userId: 'member-old' } },
        data: { role: 'admin' },
      });
    });

    it('hands authored content in other people’s groups to their founder', async () => {
      prisma.event.findMany.mockResolvedValue([{ groupId: 'g-other' }, { groupId: 'g-other' }]);
      prisma.planProposal.findMany.mockResolvedValue([{ groupId: 'g-left' }]);
      prisma.group.findMany.mockResolvedValue([
        groupRow('g-other', 'founder-1', [
          member('founder-1', 'admin', 1),
          member(USER, 'member', 2),
        ]),
        // A group the user already left but still has a proposal in.
        groupRow('g-left', 'founder-2', [member('founder-2', 'admin', 1)]),
      ]);

      const result = await service.deleteAccount(USER);

      expect(prisma.group.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ createdById: USER }, { id: { in: ['g-other', 'g-left'] } }] },
        }),
      );
      for (const [groupId, heir] of [
        ['g-other', 'founder-1'],
        ['g-left', 'founder-2'],
      ]) {
        const reassign = { where: { groupId, createdById: USER }, data: { createdById: heir } };
        expect(prisma.event.updateMany).toHaveBeenCalledWith(reassign);
        expect(prisma.planProposal.updateMany).toHaveBeenCalledWith(reassign);
        expect(prisma.availabilityPoll.updateMany).toHaveBeenCalledWith(reassign);
      }
      expect(prisma.group.update).not.toHaveBeenCalled();
      expect(prisma.group.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, groupsDeleted: 0, groupsTransferred: 0 });
    });

    it('runs every database write inside one transaction, the user delete last', async () => {
      prisma.group.findMany.mockResolvedValue([
        groupRow('g-solo', USER, [member(USER, 'admin', 1)]),
        groupRow('g-shared', USER, [member(USER, 'admin', 1), member('friend', 'member', 2)]),
      ]);
      const order: string[] = [];
      prisma.group.update.mockImplementation(async () => order.push('transfer'));
      prisma.event.updateMany.mockImplementation(async () => order.push('reassign'));
      prisma.group.delete.mockImplementation(async () => order.push('delete-group'));
      prisma.user.delete.mockImplementation(async () => order.push('delete-user'));

      await service.deleteAccount(USER);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(order).toEqual(['transfer', 'reassign', 'delete-group', 'delete-user']);
    });

    it('propagates a failed transaction so the client can retry', async () => {
      prisma.$transaction.mockRejectedValue(new Error('connection lost'));

      await expect(service.deleteAccount(USER)).rejects.toThrow('connection lost');
    });
  });

  describe('exportData', () => {
    it('returns 404 when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.exportData(USER)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('bundles profile, groups, availability, plans, votes, answers and preferences', async () => {
      const joinedAt = new Date('2026-02-01');
      prisma.user.findUnique.mockResolvedValue({
        id: USER,
        email: 'ana@example.com',
        name: 'Ana',
        avatarEmoji: '🎸',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        memberships: [
          { role: 'admin', joinedAt, group: { id: 'g-1', name: 'Cuadrilla', emoji: '🍻' } },
        ],
        availability: [{ groupId: 'g-1', date: new Date('2026-03-01'), type: 'day', slots: [] }],
        createdEvents: [{ id: 'e-1', groupId: 'g-1', title: 'Cena' }],
        eventResponses: [
          {
            status: 'confirmed',
            respondedAt: new Date('2026-03-02'),
            event: { id: 'e-2', groupId: 'g-1', title: 'Cine' },
          },
        ],
        createdProposals: [{ id: 'p-1', groupId: 'g-1', title: 'Escapada' }],
        proposalVotes: [
          {
            vote: 'yes',
            votedAt: new Date('2026-03-03'),
            proposal: { id: 'p-2', groupId: 'g-1', title: 'Ruta' },
          },
        ],
        createdPolls: [{ id: 'q-1', groupId: 'g-1', date: new Date('2026-03-05'), slot: null }],
        pollResponses: [
          {
            answer: 'yes',
            respondedAt: new Date('2026-03-04'),
            poll: { id: 'q-2', groupId: 'g-1', date: new Date('2026-03-06'), slot: 'Tarde' },
          },
        ],
        notificationPreferences: [{ type: 'new_event', enabled: false }],
      });

      const dump = await service.exportData(USER);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: USER } }),
      );
      // Credentials never leave the server.
      const select = prisma.user.findUnique.mock.calls[0][0].select;
      expect(select).not.toHaveProperty('pushTokens');
      expect(select).not.toHaveProperty('widgetTokens');

      expect(typeof dump.exportedAt).toBe('string');
      expect(dump.profile).toEqual({
        id: USER,
        email: 'ana@example.com',
        name: 'Ana',
        avatarEmoji: '🎸',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      });
      expect(dump.groups).toEqual([
        { id: 'g-1', name: 'Cuadrilla', emoji: '🍻', role: 'admin', joinedAt },
      ]);
      expect(dump.availability).toHaveLength(1);
      expect(dump.events.created).toEqual([{ id: 'e-1', groupId: 'g-1', title: 'Cena' }]);
      expect(dump.events.attendance).toEqual([
        {
          id: 'e-2',
          groupId: 'g-1',
          title: 'Cine',
          myStatus: 'confirmed',
          respondedAt: new Date('2026-03-02'),
        },
      ]);
      expect(dump.proposals.created).toHaveLength(1);
      expect(dump.proposals.votes).toEqual([
        {
          id: 'p-2',
          groupId: 'g-1',
          title: 'Ruta',
          myVote: 'yes',
          votedAt: new Date('2026-03-03'),
        },
      ]);
      expect(dump.polls.created).toHaveLength(1);
      expect(dump.polls.responses).toEqual([
        {
          id: 'q-2',
          groupId: 'g-1',
          date: new Date('2026-03-06'),
          slot: 'Tarde',
          myAnswer: 'yes',
          respondedAt: new Date('2026-03-04'),
        },
      ]);
      expect(dump.notificationPreferences).toEqual([{ type: 'new_event', enabled: false }]);
    });
  });
});
