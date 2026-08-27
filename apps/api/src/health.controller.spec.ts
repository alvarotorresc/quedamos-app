import { HealthController } from './health.controller';
import { NotificationsService } from './notifications/notifications.service';
import { createMockNotificationsService } from './common/test-utils';

describe('HealthController', () => {
  let controller: HealthController;
  let notifications: ReturnType<typeof createMockNotificationsService>;

  beforeEach(() => {
    notifications = createMockNotificationsService();
    controller = new HealthController(notifications as unknown as NotificationsService);
  });

  describe('check', () => {
    it('should return status ok and firebaseInitialized false by default', () => {
      const result = controller.check();

      expect(result).toEqual({ status: 'ok', firebaseInitialized: false });
    });

    it('should report firebaseInitialized true when Firebase is initialized', () => {
      notifications.isFirebaseInitialized.mockReturnValue(true);

      const result = controller.check();

      expect(result).toEqual({ status: 'ok', firebaseInitialized: true });
    });
  });
});
