import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  describe('check', () => {
    it('should return status ok', () => {
      const result = controller.check();

      expect(result).toEqual({ status: 'ok' });
    });
  });
});
