import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';

const mockNotificationsService = {
  registerToken: jest.fn(),
  unregisterToken: jest.fn(),
  getPreferences: jest.fn(),
  updatePreference: jest.fn(),
  sendTestNotification: jest.fn(),
  getDebugInfo: jest.fn(),
};

const mockAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('NotificationsController', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockNotificationsService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('registerToken', () => {
    it('should call notificationsService.registerToken with userId and dto', async () => {
      const dto = { token: 'fcm-token-abc', platform: 'android' as const };
      const registered = { id: 'pt-1', userId: 'user-1', ...dto, createdAt: new Date() };
      mockNotificationsService.registerToken.mockResolvedValue(registered);

      const result = await controller.registerToken({ id: 'user-1' }, dto);

      expect(result).toEqual(registered);
      expect(mockNotificationsService.registerToken).toHaveBeenCalledWith('user-1', dto);
      expect(mockNotificationsService.registerToken).toHaveBeenCalledTimes(1);
    });

    it('should pass web platform token to service', async () => {
      const dto = { token: 'web-push-token-xyz', platform: 'web' as const };
      mockNotificationsService.registerToken.mockResolvedValue({
        id: 'pt-2',
        userId: 'user-1',
        ...dto,
      });

      await controller.registerToken({ id: 'user-1' }, dto);

      expect(mockNotificationsService.registerToken).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('unregisterToken', () => {
    it('should call notificationsService.unregisterToken with userId and token from dto', async () => {
      const dto = { token: 'fcm-token-abc' };
      mockNotificationsService.unregisterToken.mockResolvedValue({ success: true });

      const result = await controller.unregisterToken({ id: 'user-1' }, dto);

      expect(result).toEqual({ success: true });
      expect(mockNotificationsService.unregisterToken).toHaveBeenCalledWith(
        'user-1',
        'fcm-token-abc',
      );
      expect(mockNotificationsService.unregisterToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPreferences', () => {
    it('should call notificationsService.getPreferences with userId', async () => {
      const preferences = [
        { type: 'new_event', enabled: true },
        { type: 'event_confirmed', enabled: true },
        { type: 'event_declined', enabled: false },
        { type: 'member_joined', enabled: true },
        { type: 'member_left', enabled: true },
      ];
      mockNotificationsService.getPreferences.mockResolvedValue(preferences);

      const result = await controller.getPreferences({ id: 'user-1' });

      expect(result).toEqual(preferences);
      expect(mockNotificationsService.getPreferences).toHaveBeenCalledWith('user-1');
      expect(mockNotificationsService.getPreferences).toHaveBeenCalledTimes(1);
    });
  });

  describe('updatePreference', () => {
    it('should call notificationsService.updatePreference with userId and dto', async () => {
      const dto = { type: 'new_event' as const, enabled: false };
      const updated = { userId: 'user-1', type: 'new_event', enabled: false };
      mockNotificationsService.updatePreference.mockResolvedValue(updated);

      const result = await controller.updatePreference({ id: 'user-1' }, dto);

      expect(result).toEqual(updated);
      expect(mockNotificationsService.updatePreference).toHaveBeenCalledWith('user-1', dto);
      expect(mockNotificationsService.updatePreference).toHaveBeenCalledTimes(1);
    });

    it('should pass enable preference to service', async () => {
      const dto = { type: 'event_declined' as const, enabled: true };
      mockNotificationsService.updatePreference.mockResolvedValue({ userId: 'user-1', ...dto });

      await controller.updatePreference({ id: 'user-1' }, dto);

      expect(mockNotificationsService.updatePreference).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('sendTestNotification', () => {
    it('should call notificationsService.sendTestNotification with userId and dto', async () => {
      const dto = { title: 'Test', body: 'Hello' };
      mockNotificationsService.sendTestNotification.mockResolvedValue({ sent: 1 });

      const result = await controller.sendTestNotification({ id: 'user-1' }, dto);

      expect(result).toEqual({ sent: 1 });
      expect(mockNotificationsService.sendTestNotification).toHaveBeenCalledWith('user-1', dto);
      expect(mockNotificationsService.sendTestNotification).toHaveBeenCalledTimes(1);
    });

    it('should work with empty dto (defaults)', async () => {
      mockNotificationsService.sendTestNotification.mockResolvedValue({ sent: 1 });

      await controller.sendTestNotification({ id: 'user-1' }, {});

      expect(mockNotificationsService.sendTestNotification).toHaveBeenCalledWith('user-1', {});
    });
  });

  describe('getDebugInfo', () => {
    it('should call notificationsService.getDebugInfo with userId', async () => {
      const debugInfo = {
        tokens: [{ id: 'pt-1', token: 'tok', platform: 'android', createdAt: new Date() }],
        preferences: [{ type: 'new_event', enabled: true }],
        recentLogs: [],
      };
      mockNotificationsService.getDebugInfo.mockResolvedValue(debugInfo);

      const result = await controller.getDebugInfo({ id: 'user-1' });

      expect(result).toEqual(debugInfo);
      expect(mockNotificationsService.getDebugInfo).toHaveBeenCalledWith('user-1');
      expect(mockNotificationsService.getDebugInfo).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDebugInfo', () => {
    const originalEnv = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      delete process.env.ENABLE_NOTIFICATIONS_DEBUG;
    });

    it('returns the debug info outside production', async () => {
      process.env.NODE_ENV = 'test';
      mockNotificationsService.getDebugInfo.mockResolvedValue({ tokens: [] });

      await expect(controller.getDebugInfo({ id: 'user-1' })).resolves.toEqual({ tokens: [] });
    });

    it('is not found in production unless explicitly enabled', async () => {
      process.env.NODE_ENV = 'production';

      await expect(controller.getDebugInfo({ id: 'user-1' })).rejects.toThrow(NotFoundException);
      expect(mockNotificationsService.getDebugInfo).not.toHaveBeenCalled();

      process.env.ENABLE_NOTIFICATIONS_DEBUG = 'true';
      mockNotificationsService.getDebugInfo.mockResolvedValue({ tokens: [] });
      await expect(controller.getDebugInfo({ id: 'user-1' })).resolves.toEqual({ tokens: [] });
    });
  });
});
