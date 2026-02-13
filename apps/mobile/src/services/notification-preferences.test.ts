import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationPreferencesService } from './notification-preferences';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('notificationPreferencesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get all preferences', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    await notificationPreferencesService.getAll();
    expect(api.get).toHaveBeenCalledWith('/notifications/preferences');
  });

  it('should update preference', async () => {
    vi.mocked(api.put).mockResolvedValue({});
    await notificationPreferencesService.update('new_event', false);
    expect(api.put).toHaveBeenCalledWith('/notifications/preferences', {
      type: 'new_event',
      enabled: false,
    });
  });

  it('should update with enabled true', async () => {
    vi.mocked(api.put).mockResolvedValue({});
    await notificationPreferencesService.update('member_joined', true);
    expect(api.put).toHaveBeenCalledWith('/notifications/preferences', {
      type: 'member_joined',
      enabled: true,
    });
  });
});
