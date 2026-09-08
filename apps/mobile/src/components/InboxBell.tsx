import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiOutlineBell } from 'react-icons/hi2';
import { useInbox, useInboxSync } from '../hooks/useInbox';
import { InboxSheet } from './InboxSheet';

/**
 * The bell in the header, next to the avatar and the same 32 px tall. It owns the sheet
 * so the three pages that show it only have to drop in one tag.
 *
 * The counter is hidden at zero rather than shown as a «0»: a badge that is always there
 * stops meaning anything.
 */
export function InboxBell() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useInbox();

  useInboxSync();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t('inbox.open')}
        className="relative w-8 h-8 flex items-center justify-center rounded-full border-none text-text"
        style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}
      >
        <HiOutlineBell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span
            data-testid="inbox-unread-count"
            className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-pill bg-primary-solid text-on-primary text-[9px] font-bold leading-[15px] text-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <InboxSheet isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export default InboxBell;
