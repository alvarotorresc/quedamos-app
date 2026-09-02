import { WidgetTokenService } from './widget-token.service';
import { createMockPrisma, createTestUser, MockPrisma } from '../common/test-utils';
import { createHash } from 'crypto';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('WidgetTokenService', () => {
  let service: WidgetTokenService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.widgetToken.findMany.mockResolvedValue([]);
    prisma.widgetToken.deleteMany.mockResolvedValue({ count: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new WidgetTokenService(prisma as any);
  });

  describe('issue', () => {
    it('returns a qw_-prefixed token with 48 hex chars', async () => {
      prisma.widgetToken.create.mockResolvedValue({ id: 'wt-1' });
      const { token } = await service.issue('user-1');
      expect(token).toMatch(/^qw_[0-9a-f]{48}$/);
    });

    it('stores only the sha256 of the token, never the token itself', async () => {
      prisma.widgetToken.create.mockResolvedValue({ id: 'wt-1' });
      const { token } = await service.issue('user-1');
      const stored = prisma.widgetToken.create.mock.calls[0][0].data;
      expect(stored.userId).toBe('user-1');
      expect(stored.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
      expect(stored.tokenHash).not.toContain(token);
    });

    it('issues a different token every time', async () => {
      prisma.widgetToken.create.mockResolvedValue({ id: 'wt-1' });
      const a = await service.issue('user-1');
      const b = await service.issue('user-1');
      expect(a.token).not.toBe(b.token);
    });
  });

  describe('revokeAll', () => {
    it('deletes every token of the user', async () => {
      prisma.widgetToken.deleteMany.mockResolvedValue({ count: 2 });
      const result = await service.revokeAll('user-1');
      expect(prisma.widgetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(result).toEqual({ success: true });
    });
  });

  describe('validate', () => {
    it('returns the user for a known token and touches lastUsedAt', async () => {
      const user = createTestUser();
      prisma.widgetToken.create.mockResolvedValue({ id: 'wt-1' });
      const { token } = await service.issue('user-1');
      prisma.widgetToken.findUnique.mockResolvedValue({
        id: 'wt-1',
        userId: 'user-1',
        createdAt: new Date(),
        user,
      });
      prisma.widgetToken.update.mockResolvedValue({});
      const result = await service.validate(token);
      expect(prisma.widgetToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: createHash('sha256').update(token).digest('hex') },
        include: { user: true },
      });
      expect(result).toEqual(user);
      expect(prisma.widgetToken.update).toHaveBeenCalledWith({
        where: { id: 'wt-1' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it('returns null for an unknown token', async () => {
      prisma.widgetToken.findUnique.mockResolvedValue(null);
      expect(await service.validate('qw_' + 'a'.repeat(48))).toBeNull();
    });

    it('returns null without touching the db for a token without the qw_ prefix', async () => {
      expect(await service.validate('not-a-widget-token')).toBeNull();
      expect(prisma.widgetToken.findUnique).not.toHaveBeenCalled();
    });

    it('still validates when the lastUsedAt touch fails', async () => {
      const user = createTestUser();
      prisma.widgetToken.findUnique.mockResolvedValue({
        id: 'wt-1',
        userId: 'user-1',
        createdAt: new Date(),
        user,
      });
      prisma.widgetToken.update.mockRejectedValue(new Error('db down'));
      const result = await service.validate('qw_' + 'b'.repeat(48));
      expect(result).toEqual(user);
    });
  });

  describe('expiry', () => {
    it('rejects a token older than 90 days and drops the row', async () => {
      const user = createTestUser();
      prisma.widgetToken.findUnique.mockResolvedValue({
        id: 'wt-old',
        userId: 'user-1',
        createdAt: new Date(Date.now() - 91 * DAY_MS),
        user,
      });
      prisma.widgetToken.delete.mockResolvedValue({});

      expect(await service.validate('qw_' + 'c'.repeat(48))).toBeNull();
      expect(prisma.widgetToken.update).not.toHaveBeenCalled();
      expect(prisma.widgetToken.delete).toHaveBeenCalledWith({ where: { id: 'wt-old' } });
    });

    it('still accepts a token just inside the 90-day window', async () => {
      const user = createTestUser();
      prisma.widgetToken.findUnique.mockResolvedValue({
        id: 'wt-fresh',
        userId: 'user-1',
        createdAt: new Date(Date.now() - 89 * DAY_MS),
        user,
      });
      prisma.widgetToken.update.mockResolvedValue({});

      expect(await service.validate('qw_' + 'd'.repeat(48))).toEqual(user);
    });

    it('validates even if deleting the expired row fails', async () => {
      prisma.widgetToken.findUnique.mockResolvedValue({
        id: 'wt-old',
        userId: 'user-1',
        createdAt: new Date(Date.now() - 200 * DAY_MS),
        user: createTestUser(),
      });
      prisma.widgetToken.delete.mockRejectedValue(new Error('db down'));

      expect(await service.validate('qw_' + 'e'.repeat(48))).toBeNull();
    });
  });

  describe('issue — per-user cap', () => {
    it('drops the oldest tokens above the cap', async () => {
      prisma.widgetToken.create.mockResolvedValue({ id: 'wt-new' });
      prisma.widgetToken.findMany.mockResolvedValue([{ id: 'wt-oldest' }]);
      prisma.widgetToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.issue('user-1');

      expect(prisma.widgetToken.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 5,
        select: { id: true },
      });
      expect(prisma.widgetToken.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['wt-oldest'] } },
      });
    });

    it('does not delete anything when the user is under the cap', async () => {
      prisma.widgetToken.create.mockResolvedValue({ id: 'wt-new' });

      await service.issue('user-1');

      expect(prisma.widgetToken.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('purgeExpired', () => {
    it('deletes every token created before the 90-day cutoff', async () => {
      prisma.widgetToken.deleteMany.mockResolvedValue({ count: 3 });

      await service.purgeExpired();

      const where = prisma.widgetToken.deleteMany.mock.calls[0][0].where;
      const cutoff: Date = where.createdAt.lt;
      const expected = Date.now() - 90 * DAY_MS;
      expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(5000);
    });
  });
});
