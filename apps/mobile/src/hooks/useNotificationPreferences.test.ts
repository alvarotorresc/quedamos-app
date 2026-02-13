import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNotificationPreferences, useUpdateNotificationPreference } from './useNotificationPreferences';
import { notificationPreferencesService } from '../services/notification-preferences';
import { createWrapper } from '../test/test-utils';

vi.mock('../services/notification-preferences', () => ({
  notificationPreferencesService: {
    getAll: vi.fn(),
    update: vi.fn(),
  },
}));

describe('useNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch preferences', async () => {
    const prefs = [
      { type: 'new_event', enabled: true },
      { type: 'member_joined', enabled: false },
    ];
    vi.mocked(notificationPreferencesService.getAll).mockResolvedValue(prefs as any);

    const { result } = renderHook(() => useNotificationPreferences(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(prefs);
  });
});

describe('useUpdateNotificationPreference', () => {
  it('should update preference', async () => {
    vi.mocked(notificationPreferencesService.update).mockResolvedValue({} as any);
    vi.mocked(notificationPreferencesService.getAll).mockResolvedValue([]);

    const { result } = renderHook(() => useUpdateNotificationPreference(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ type: 'new_event', enabled: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notificationPreferencesService.update).toHaveBeenCalledWith('new_event', false);
  });

  it('should update with enabled true', async () => {
    vi.mocked(notificationPreferencesService.update).mockResolvedValue({} as any);
    vi.mocked(notificationPreferencesService.getAll).mockResolvedValue([]);

    const { result } = renderHook(() => useUpdateNotificationPreference(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ type: 'member_left', enabled: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notificationPreferencesService.update).toHaveBeenCalledWith('member_left', true);
  });
});
