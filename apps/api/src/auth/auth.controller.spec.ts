import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { createTestUser } from '../common/test-utils';

const mockAuthService = {
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  validateToken: jest.fn(),
};

const mockAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should call authService.getProfile with user id', async () => {
      const user = createTestUser();
      mockAuthService.getProfile.mockResolvedValue(user);

      const result = await controller.getProfile({ id: 'user-1' });

      expect(result).toEqual(user);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('user-1');
      expect(mockAuthService.getProfile).toHaveBeenCalledTimes(1);
    });

    it('should return null when user not found', async () => {
      mockAuthService.getProfile.mockResolvedValue(null);

      const result = await controller.getProfile({ id: 'nonexistent' });

      expect(result).toBeNull();
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('updateProfile', () => {
    it('should call authService.updateProfile with user id and dto', async () => {
      const updated = createTestUser({ name: 'Updated Name' });
      const dto = { name: 'Updated Name' };
      mockAuthService.updateProfile.mockResolvedValue(updated);

      const result = await controller.updateProfile({ id: 'user-1' }, dto);

      expect(result).toEqual(updated);
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith('user-1', dto);
      expect(mockAuthService.updateProfile).toHaveBeenCalledTimes(1);
    });

    it('should pass avatar emoji update to service', async () => {
      const updated = createTestUser({ avatarEmoji: '🎸' });
      const dto = { avatarEmoji: '🎸' };
      mockAuthService.updateProfile.mockResolvedValue(updated);

      const result = await controller.updateProfile({ id: 'user-1' }, dto);

      expect(result).toEqual(updated);
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith('user-1', dto);
    });

    it('should pass both name and avatar emoji to service', async () => {
      const dto = { name: 'New Name', avatarEmoji: '🎉' };
      const updated = createTestUser({ name: 'New Name', avatarEmoji: '🎉' });
      mockAuthService.updateProfile.mockResolvedValue(updated);

      const result = await controller.updateProfile({ id: 'user-1' }, dto);

      expect(result).toEqual(updated);
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith('user-1', {
        name: 'New Name',
        avatarEmoji: '🎉',
      });
    });
  });
});
