import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { useAuthStore } from '../stores/auth';
import { useToast } from '../hooks/useToast';

/** Supabase refuses a second confirmation email within a minute anyway. */
const COOLDOWN_SECONDS = 60;

interface ResendConfirmationProps {
  /** Address the confirmation email is sent to again. */
  email: string;
  /**
   * Resolves a fresh captcha token, or null when the challenge produced none.
   *
   * The widget belongs to the page: the register screen mounts one on its success
   * state and the login screen already has one for the form, so this component
   * never puts a second challenge on the same page.
   */
  requestCaptchaToken: () => Promise<string | null>;
}

/**
 * "Send me that confirmation email again", with a minute of cooldown.
 *
 * Shared by the two screens where an unconfirmed account is a dead end: right after
 * signing up, and when signing in fails because the email was never confirmed.
 */
export function ResendConfirmation({ email, requestCaptchaToken }: ResendConfirmationProps) {
  const { t } = useTranslation();
  const resendConfirmation = useAuthStore((s) => s.resendConfirmation);
  const { showSuccess, showError } = useToast();
  const [sending, setSending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const waiting = secondsLeft > 0;

  // One interval for the whole countdown, started and stopped by `waiting` alone: a
  // timeout re-scheduled on every tick would depend on each render landing in time.
  useEffect(() => {
    if (!waiting) return;
    const ticker = setInterval(() => setSecondsLeft((left) => Math.max(0, left - 1)), 1000);
    return () => clearInterval(ticker);
  }, [waiting]);

  const handleResend = async () => {
    if (sending || secondsLeft > 0) return;
    setSending(true);
    try {
      const token = await requestCaptchaToken();
      if (!token) {
        showError('common.captchaError');
        return;
      }
      await resendConfirmation(email, token);
      showSuccess('resendConfirmation.sent');
      // Only a send that actually left starts the cooldown: a failed one would
      // otherwise lock the button for a minute for nothing.
      setSecondsLeft(COOLDOWN_SECONDS);
    } catch {
      showError('resendConfirmation.error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleResend}
      loading={sending}
      disabled={waiting}
      className="mt-4"
    >
      {waiting ? t('resendConfirmation.cooldown', { seconds: secondsLeft }) : t('resendConfirmation.action')}
    </Button>
  );
}

export default ResendConfirmation;
