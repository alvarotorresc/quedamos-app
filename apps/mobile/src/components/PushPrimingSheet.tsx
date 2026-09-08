import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import type { PushPermissionValue } from '../stores/push-permission';

/** Asked once per device: a second uninvited sheet would be the same ambush. */
const SEEN_KEY = 'quedamos_push_priming_seen';

function hasBeenAsked(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // Private mode: the sheet may show again on the next launch, which is a far
    // smaller nuisance than never showing it at all.
    return false;
  }
}

function rememberAsked(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Nothing to do; see above.
  }
}

interface PushPrimingSheetProps {
  permission: PushPermissionValue;
  /** Opens the system dialog and registers the device when it is granted. */
  onEnable: () => Promise<void>;
}

/**
 * Explains what the avisos are for before the system dialog appears.
 *
 * The app used to request the permission the moment the tabs mounted: the dialog
 * arrived with no context, and Android only ever shows it once, so a reflex "no"
 * silently killed every notification for good. Asking here first means the system
 * dialog is only spent on someone who already said yes to us.
 */
export function PushPrimingSheet({ permission, onEnable }: PushPrimingSheetProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    // Anything but 'prompt' means there is nothing left to ask — including the
    // moment the user answers the dialog, which closes this sheet behind it.
    if (permission !== 'prompt') {
      setOpen(false);
      return;
    }
    if (hasBeenAsked()) return;
    setOpen(true);
  }, [permission]);

  const dismiss = () => {
    rememberAsked();
    setOpen(false);
  };

  const enable = async () => {
    rememberAsked();
    setEnabling(true);
    try {
      await onEnable();
    } finally {
      setEnabling(false);
      setOpen(false);
    }
  };

  return (
    <Sheet isOpen={open} onClose={dismiss} title={t('push.priming.title')}>
      <p className="text-sm text-text-muted leading-relaxed">{t('push.priming.what')}</p>
      <p className="text-sm text-text-muted leading-relaxed mt-2">{t('push.priming.when')}</p>
      <div className="flex flex-col gap-2 mt-5">
        <Button onClick={enable} loading={enabling}>
          {t('push.priming.enable')}
        </Button>
        <Button variant="ghost" onClick={dismiss}>
          {t('push.priming.later')}
        </Button>
      </div>
    </Sheet>
  );
}

export default PushPrimingSheet;
