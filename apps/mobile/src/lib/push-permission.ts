import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

/**
 * What the platform currently says about notifications.
 *
 * - `granted`: avisos on, nothing to ask.
 * - `denied`: the user (or the system) said no; only the settings app can undo it.
 * - `prompt`: nobody has been asked yet.
 * - `unsupported`: this browser has no notifications at all.
 */
export type PushPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

/**
 * Reads the permission WITHOUT asking for it.
 *
 * `registerForPush()` requests as a side effect, which is why the app used to fire
 * the system dialog the moment someone opened the tabs, with no explanation and no
 * second chance. Everything that only needs to *know* asks here instead.
 */
export async function readPushPermission(): Promise<PushPermission> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { receive } = await PushNotifications.checkPermissions();
      if (receive === 'granted') return 'granted';
      if (receive === 'denied') return 'denied';
      // 'prompt' and 'prompt-with-rationale' both mean "still askable".
      return 'prompt';
    } catch {
      // An old WebView or a plugin that failed to load: treat it as "no push here"
      // rather than promising avisos the device can't deliver.
      return 'unsupported';
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';

  const permission = Notification.permission;
  if (permission === 'granted') return 'granted';
  if (permission === 'denied') return 'denied';
  return 'prompt';
}
