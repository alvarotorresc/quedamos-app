import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { createMockPrisma, createMockConfigService, createTestUser } from '../common/test-utils';

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

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let configService: ReturnType<typeof createMockConfigService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    configService = createMockConfigService();
    service = new AuthService(configService as any, prisma as any);
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

    it('should throw UnauthorizedException on invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(new Error('invalid signature'));
      });

      await expect(service.validateToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when sub is missing', async () => {
      (jwt.verify as jest.Mock).mockImplementation((_token, _key, _opts, cb) => {
        cb(null, { email: 'test@test.com' });
      });

      await expect(service.validateToken('no-sub-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const user = createTestUser();
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile('user-1');

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
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
