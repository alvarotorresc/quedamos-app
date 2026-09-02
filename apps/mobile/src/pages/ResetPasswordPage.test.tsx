import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ResetPasswordPage from './ResetPasswordPage';
import { supabase } from '../lib/supabase';

const replaceMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useHistory: () => ({ replace: replaceMock }) };
});

const signOutMock = vi.fn(() => Promise.resolve());
const updatePasswordMock = vi.fn(() => Promise.resolve());
vi.mock('../stores/auth', () => ({
  useAuthStore: (
    selector: (s: { signOut: () => Promise<void>; updatePassword: () => Promise<void> }) => unknown,
  ) => selector({ signOut: signOutMock, updatePassword: updatePasswordMock }),
}));

function renderPage() {
  return act(async () => {
    render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>,
    );
  });
}

describe('ResetPasswordPage expired link', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the expired state once the verification window elapses with no session/event', async () => {
    await renderPage();

    expect(screen.getByText('resetPassword.verifying')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(screen.getByText('resetPassword.expired.title')).toBeInTheDocument();
    expect(screen.queryByText('resetPassword.verifying')).not.toBeInTheDocument();
  });

  it('leaves the expired state when the recovery event arrives late', async () => {
    let emit: ((event: string) => void) | undefined;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((cb: (e: string) => void) => {
      emit = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    await renderPage();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(screen.getByText('resetPassword.expired.title')).toBeInTheDocument();

    await act(async () => {
      emit?.('PASSWORD_RECOVERY');
    });

    expect(screen.queryByText('resetPassword.expired.title')).not.toBeInTheDocument();
    expect(screen.getByText('resetPassword.title')).toBeInTheDocument();
  });

  it('signs the recovery session out before asking for a new link', async () => {
    await renderPage();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('resetPassword.expired.resend'));
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith('/forgot-password');
    expect(signOutMock.mock.invocationCallOrder[0]).toBeLessThan(
      replaceMock.mock.invocationCallOrder[0],
    );
  });
});
