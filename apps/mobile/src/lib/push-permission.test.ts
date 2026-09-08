import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { readPushPermission } from './push-permission';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(false) },
}));

type CheckResult = Awaited<ReturnType<typeof PushNotifications.checkPermissions>>;

function setWebPermission(permission: NotificationPermission | undefined): void {
  if (permission === undefined) {
    vi.stubGlobal('Notification', undefined);
    // `'Notification' in window` must be false, not just undefined.
    delete (window as unknown as Record<string, unknown>).Notification;
    return;
  }
  vi.stubGlobal('Notification', { permission });
}

describe('readPushPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the browser permission without asking for it', async () => {
    setWebPermission('default');

    await expect(readPushPermission()).resolves.toBe('prompt');

    expect(PushNotifications.checkPermissions).not.toHaveBeenCalled();
  });

  it('maps the granted and denied browser states', async () => {
    setWebPermission('granted');
    await expect(readPushPermission()).resolves.toBe('granted');

    setWebPermission('denied');
    await expect(readPushPermission()).resolves.toBe('denied');
  });

  it('reports a browser without notifications as unsupported', async () => {
    setWebPermission(undefined);

    await expect(readPushPermission()).resolves.toBe('unsupported');
  });

  it('asks the native plugin on a device', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(PushNotifications.checkPermissions).mockResolvedValue({
      receive: 'granted',
    } as unknown as CheckResult);

    await expect(readPushPermission()).resolves.toBe('granted');
  });

  it('treats the native rationale state as still askable', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(PushNotifications.checkPermissions).mockResolvedValue({
      receive: 'prompt-with-rationale',
    } as unknown as CheckResult);

    await expect(readPushPermission()).resolves.toBe('prompt');
  });

  it('maps the native denial', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(PushNotifications.checkPermissions).mockResolvedValue({
      receive: 'denied',
    } as unknown as CheckResult);

    await expect(readPushPermission()).resolves.toBe('denied');
  });

  it('falls back to unsupported when the native plugin blows up', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(PushNotifications.checkPermissions).mockRejectedValue(new Error('no plugin'));

    await expect(readPushPermission()).resolves.toBe('unsupported');
  });
});
