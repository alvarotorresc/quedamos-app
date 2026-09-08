import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResendConfirmation } from './ResendConfirmation';

// El mock global de react-i18next descarta los valores; aquí hacen falta para ver
// la cuenta atrás.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key,
    i18n: { language: 'es' },
  }),
}));

const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showSuccess, showError, showInfo: vi.fn() }),
}));

const resendConfirmation = vi.fn(() => Promise.resolve());
vi.mock('../stores/auth', () => ({
  useAuthStore: (selector: (s: { resendConfirmation: () => Promise<void> }) => unknown) =>
    selector({ resendConfirmation }),
}));

function renderResend(getToken = () => Promise.resolve<string | null>('tok')) {
  render(<ResendConfirmation email="vera@example.com" requestCaptchaToken={getToken} />);
}

async function clickResend(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByText('resendConfirmation.action'));
  });
}

describe('ResendConfirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resendConfirmation.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resends the email with a fresh captcha token', async () => {
    renderResend();

    await clickResend();

    expect(resendConfirmation).toHaveBeenCalledWith('vera@example.com', 'tok');
    expect(showSuccess).toHaveBeenCalledWith('resendConfirmation.sent');
  });

  it('holds the button for a minute so nobody hammers the mailbox', async () => {
    renderResend();

    await clickResend();

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByText('resendConfirmation.cooldown:60')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    expect(screen.getByText('resendConfirmation.cooldown:1')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText('resendConfirmation.action')).toBeInTheDocument();
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('refuses a second send while the cooldown is running', async () => {
    renderResend();

    await clickResend();
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(resendConfirmation).toHaveBeenCalledTimes(1);
  });

  it('warns and keeps the button usable when the captcha yields nothing', async () => {
    renderResend(() => Promise.resolve(null));

    await clickResend();

    expect(resendConfirmation).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith('common.captchaError');
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('warns and does not start the cooldown when the send fails', async () => {
    resendConfirmation.mockRejectedValue(new Error('Email rate limit exceeded'));
    renderResend();

    await clickResend();

    expect(showError).toHaveBeenCalledWith('resendConfirmation.error');
    expect(screen.getByRole('button')).not.toBeDisabled();
  });
});
