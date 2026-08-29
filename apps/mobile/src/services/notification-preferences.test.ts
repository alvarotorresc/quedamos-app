import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NOTIFICATION_TYPES,
  NOTIF_SECTIONS,
  notificationPreferencesService,
} from './notification-preferences';
import { api } from '../lib/api';
import es from '../i18n/locales/es.json';
import en from '../i18n/locales/en.json';

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

describe('notification settings catalogue', () => {
  const listedTypes = NOTIF_SECTIONS.flatMap((section) => section.types.map((t) => t.type));

  it('includes the poll types', () => {
    expect(NOTIFICATION_TYPES).toContain('new_poll');
    expect(NOTIFICATION_TYPES).toContain('poll_completed');
  });

  it('offers a settings row for every notification type, exactly once', () => {
    expect([...listedTypes].sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });

  function translation(locale: Record<string, unknown>, key: string): unknown {
    return key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object'
            ? (node as Record<string, unknown>)[part]
            : undefined,
        locale,
      );
  }

  it('has a Spanish and English label for every row', () => {
    for (const section of NOTIF_SECTIONS) {
      expect(typeof translation(es, section.headerKey)).toBe('string');
      expect(typeof translation(en, section.headerKey)).toBe('string');
      for (const row of section.types) {
        expect(typeof translation(es, row.labelKey)).toBe('string');
        expect(typeof translation(en, row.labelKey)).toBe('string');
      }
    }
  });
});
