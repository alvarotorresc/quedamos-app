import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { usePushPermissionStore } from '../stores/push-permission';

/**
 * Says out loud that the system is swallowing the avisos.
 *
 * Until now a denied permission looked exactly like a granted one: the settings
 * screen happily showed eighteen switches "on" while nothing could ever arrive.
 * Nothing in the app can undo the refusal — only the system settings can — so this
 * is a sign, not a button.
 */
export function PushPermissionBanner() {
  const { t } = useTranslation();
  const permission = usePushPermissionStore((s) => s.permission);
  const refresh = usePushPermissionStore((s) => s.refresh);

  // Re-read on mount: the user may have just come back from the system settings.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (permission !== 'denied') return null;

  return (
    <div className="bg-error-tint border border-subtle rounded-btn p-3.5 mb-3">
      <p className="text-sm font-bold text-text">{t('push.blocked.title')}</p>
      <p className="text-xs text-text-muted mt-1 leading-relaxed">
        {Capacitor.isNativePlatform() ? t('push.blocked.android') : t('push.blocked.web')}
      </p>
    </div>
  );
}

export default PushPermissionBanner;
