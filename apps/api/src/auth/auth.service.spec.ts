import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { createMockPrisma, createMockConfigService, createTestUser } from '../common/test-utils';
import { DEFAULT_TIME_SLOTS } from '@quedamos/shared';

// Mock jwks-rsa
jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn().mockImplementation((_kid, cb) => {
      cb(null, { getPublicKey: () => 'test-public-key' });
    }),
  })),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

import * as jwt from 'jsonwebtoken';

const SERVICE_KEY = 'service-role-key';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let configService: ReturnType<typeof createMockConfigService>;
  let fetchMock: jest.Mock;

  function build(configOverrides: Record<string, string> = {}) {
    prisma = createMockPrisma();
    configService = createMockConfigService({
      SUPABASE_SERVICE_KEY: SERVICE_KEY,
      ...configOverrides,
    });
    service = new AuthService(
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
    // Por defecto Supabase Auth dice que el usuario sigue ahi, que es lo que
    // pasa en cuanto alguien se registra: las pruebas del alta no tienen que
    // repetirlo.
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    service.setFetch(fetchMock as unknown as typeof fetch);
  }

  beforeEach(() => {
    build();
  });

  describe('validateToken', () => {
    it('should validate token and return existing user', async () => {
      const user = createTestUser();
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, { sub: 'user-1', email: 'test@test.com' });
      });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('should create user if not found in database', async () => {
      const user = createTestUser();
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, {
          sub: 'user-1',
          email: 'test@test.com',
          user_metadata: { name: 'Test User', avatarEmoji: '😊' },
        });
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(user);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(user);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          id: 'user-1',
          email: 'test@test.com',
          name: 'Test User',
          avatarEmoji: '😊',
          language: 'es',
        },
      });
    });

    it('should use defaults when user_metadata is missing', async () => {
      const user = createTestUser({ name: 'Usuario' });
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, { sub: 'user-1', email: 'test@test.com' });
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(user);

      await service.validateToken('valid-token');

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Usuario', avatarEmoji: '😊' }),
      });
    });

    it('should sync email in DB when Supabase email differs', async () => {
      const user = createTestUser({ email: 'old@test.com' });
      const updatedUser = createTestUser({ email: 'new@test.com' });
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, { sub: 'user-1', email: 'new@test.com' });
      });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { email: 'new@test.com' },
      });
    });

    it('should not update DB when JWT has no email and user already exists', async () => {
      const user = createTestUser({ email: 'existing@test.com' });
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, { sub: 'user-1' }); // no email in payload
      });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(user);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should not update DB when JWT email is malformed', async () => {
      const user = createTestUser({ email: 'existing@test.com' });
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, { sub: 'user-1', email: 'not-an-email' });
      });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(user);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should store the language from user_metadata when creating the user', async () => {
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, {
          sub: 'user-1',
          email: 'test@test.com',
          user_metadata: { name: 'Test User', language: 'en' },
        });
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(createTestUser());

      await service.validateToken('valid-token');

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ language: 'en' }),
      });
    });

    it('should fall back to Spanish when the JWT carries no language', async () => {
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, { sub: 'user-1', email: 'test@test.com', user_metadata: { name: 'Test User' } });
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(createTestUser());

      await service.validateToken('valid-token');

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ language: 'es' }),
      });
    });

    it('should sync the language when it changes in the JWT', async () => {
      const user = { ...createTestUser(), language: 'es' };
      const updated = { ...user, language: 'en' };
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, {
          sub: 'user-1',
          email: 'test@test.com',
          user_metadata: { language: 'en' },
        });
      });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(updated);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { language: 'en' },
      });
    });

    it('should sync email and language in a single update', async () => {
      const user = { ...createTestUser({ email: 'old@test.com' }), language: 'es' };
      const updated = { ...user, email: 'new@test.com', language: 'en' };
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, {
          sub: 'user-1',
          email: 'new@test.com',
          user_metadata: { language: 'en' },
        });
      });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(updated);

      await service.validateToken('valid-token');

      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { email: 'new@test.com', language: 'en' },
      });
    });

    it('should ignore an unsupported language in the JWT', async () => {
      const user = { ...createTestUser(), language: 'es' };
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, { sub: 'user-1', user_metadata: { language: 'klingon' } });
      });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(user);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should store the time slots from user_metadata when creating the user', async () => {
      const slots = { ...DEFAULT_TIME_SLOTS, nightStart: '21:00' };
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, {
          sub: 'user-1',
          email: 'test@test.com',
          user_metadata: { name: 'Test User', timeSlots: slots },
        });
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(createTestUser());

      await service.validateToken('valid-token');

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ timeSlots: slots }),
      });
    });

    it('should leave the time slots unset when the JWT carries none', async () => {
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, { sub: 'user-1', email: 'test@test.com' });
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(createTestUser());

      await service.validateToken('valid-token');

      expect(prisma.user.create.mock.calls[0][0].data).not.toHaveProperty('timeSlots');
    });

    it('should sync the time slots when they change in the JWT', async () => {
      const user = { ...createTestUser(), timeSlots: DEFAULT_TIME_SLOTS };
      const slots = { ...DEFAULT_TIME_SLOTS, afternoonStart: '16:00' };
      const updated = { ...user, timeSlots: slots };
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, { sub: 'user-1', user_metadata: { timeSlots: slots } });
      });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(updated);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { timeSlots: slots },
      });
    });

    it('should not write when the stored time slots already say the same', async () => {
      // Mismos seis valores, otro orden de claves: lo que devuelve Postgres para
      // una columna JSONB no tiene por que respetar el orden con el que se escribio.
      const user = {
        ...createTestUser(),
        timeSlots: {
          nightEnd: '00:00',
          nightStart: '20:00',
          afternoonEnd: '20:00',
          afternoonStart: '14:00',
          morningEnd: '14:00',
          morningStart: '08:00',
        },
      };
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, { sub: 'user-1', user_metadata: { timeSlots: DEFAULT_TIME_SLOTS } });
      });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(user);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should ignore malformed time slots in the JWT', async () => {
      // user_metadata lo escribe el propio cliente: lo que no sea una franja
      // coherente no llega a la columna.
      const user = { ...createTestUser(), timeSlots: DEFAULT_TIME_SLOTS };
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, {
          sub: 'user-1',
          user_metadata: { timeSlots: { morningStart: '25:00', injected: 'whatever' } },
        });
      });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(user);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should sync email, language and time slots in a single update', async () => {
      const user = {
        ...createTestUser({ email: 'old@test.com' }),
        language: 'es',
        timeSlots: null,
      };
      const slots = { ...DEFAULT_TIME_SLOTS, morningStart: '07:00' };
      const updated = { ...user, email: 'new@test.com', language: 'en', timeSlots: slots };
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, {
          sub: 'user-1',
          email: 'new@test.com',
          user_metadata: { language: 'en', timeSlots: slots },
        });
      });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(updated);

      await service.validateToken('valid-token');

      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { email: 'new@test.com', language: 'en', timeSlots: slots },
      });
    });

    it('should handle concurrent user creation (P2002 unique constraint)', async () => {
      const user = createTestUser();
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, {
          sub: 'user-1',
          email: 'test@test.com',
          user_metadata: { name: 'Test User', avatarEmoji: '😊' },
        });
      });
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // First call: user not found
        .mockResolvedValueOnce(user); // Second call: fallback after P2002
      prisma.user.create.mockRejectedValue({ code: 'P2002' });

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(user);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw UnauthorizedException when P2002 retry finds no user', async () => {
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, {
          sub: 'user-1',
          email: 'test@test.com',
          user_metadata: { name: 'Test User', avatarEmoji: '😊' },
        });
      });
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // first lookup: user not found
        .mockResolvedValueOnce(null); // retry after P2002: still not found
      prisma.user.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.validateToken('valid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should rethrow non-P2002 errors during user creation', async () => {
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, {
          sub: 'user-1',
          email: 'test@test.com',
          user_metadata: { name: 'Test User', avatarEmoji: '😊' },
        });
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(new Error('Connection failed'));

      await expect(service.validateToken('valid-token')).rejects.toThrow('Connection failed');
    });

    it('should throw UnauthorizedException on invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(new Error('invalid signature'));
      });

      await expect(service.validateToken('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when sub is missing', async () => {
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, { email: 'test@test.com' });
      });

      await expect(service.validateToken('no-sub-token')).rejects.toThrow(UnauthorizedException);
    });

    describe('when the row does not exist yet', () => {
      function tokenFor(sub: string) {
        (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
          cb(null, { sub, email: 'test@test.com', user_metadata: { name: 'Test User' } });
        });
      }

      it('rejects the token of a deleted account instead of recreating the row', async () => {
        // El JWT sigue firmado y sin caducar, pero la cuenta ya no esta en
        // Supabase Auth: recrear la fila dejaria el email pillado para siempre.
        tokenFor('deleted-user');
        prisma.user.findUnique.mockResolvedValue(null);
        fetchMock.mockResolvedValue({ ok: false, status: 404 });

        await expect(service.validateToken('valid-token')).rejects.toThrow(UnauthorizedException);

        expect(prisma.user.create).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('asks Supabase Auth with the service key before creating the user', async () => {
        tokenFor('user-1');
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue(createTestUser());

        await service.validateToken('valid-token');

        expect(fetchMock).toHaveBeenCalledWith(
          'https://test.supabase.co/auth/v1/admin/users/user-1',
          expect.objectContaining({
            method: 'GET',
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
            signal: expect.any(AbortSignal),
          }),
        );
        expect(prisma.user.create).toHaveBeenCalled();
      });

      it('does not ask Supabase Auth when the row is already there', async () => {
        // El camino de siempre no puede pagar una llamada de red por peticion.
        const user = createTestUser();
        tokenFor('user-1');
        prisma.user.findUnique.mockResolvedValue(user);

        const result = await service.validateToken('valid-token');

        expect(result).toEqual(user);
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it('refuses with 503 when Supabase Auth is unreachable', async () => {
        tokenFor('user-1');
        prisma.user.findUnique.mockResolvedValue(null);
        fetchMock.mockRejectedValue(new Error('network down'));

        await expect(service.validateToken('valid-token')).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );

        expect(prisma.user.create).not.toHaveBeenCalled();
      });

      it('refuses with 503 when Supabase Auth answers with an error status', async () => {
        // Un 500 (o un 401 por una service key mal puesta) no prueba que la
        // cuenta no exista: solo un 404 lo hace.
        tokenFor('user-1');
        prisma.user.findUnique.mockResolvedValue(null);
        fetchMock.mockResolvedValue({ ok: false, status: 500 });

        await expect(service.validateToken('valid-token')).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );

        expect(prisma.user.create).not.toHaveBeenCalled();
      });

      it('refuses with 503 and asks nothing when the service key is missing', async () => {
        build({ SUPABASE_SERVICE_KEY: '' });
        tokenFor('user-1');
        prisma.user.findUnique.mockResolvedValue(null);

        await expect(service.validateToken('valid-token')).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );

        expect(fetchMock).not.toHaveBeenCalled();
        expect(prisma.user.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('getProfile', () => {
    it('should return user profile with explicit select', async () => {
      const user = createTestUser();
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile('user-1');

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          email: true,
          name: true,
          avatarEmoji: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('should return null for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getProfile('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const updated = createTestUser({ name: 'New Name' });
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile('user-1', { name: 'New Name' });

      expect(result).toEqual(updated);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'New Name' },
      });
    });
  });
});
