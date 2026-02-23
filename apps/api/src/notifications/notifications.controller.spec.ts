import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';

const mockNotificationsService = {
  registerToken: jest.fn(),
  unregisterToken: jest.fn(),
  getPreferences: jest.fn(),
  updatePreference: jest.fn(),
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
      mockNotificationsService.registerToken.mockResolvedValue({ id: 'pt-2', userId: 'user-1', ...dto });

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
      expect(mockNotificationsService.unregisterToken).toHaveBeenCalledWith('user-1', 'fcm-token-abc');
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
});
