import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ResetPasswordPage from './ResetPasswordPage';

describe('ResetPasswordPage expired link', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the expired state once the verification window elapses with no session/event', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ResetPasswordPage />
        </MemoryRouter>,
      );
    });

    expect(screen.getByText('resetPassword.verifying')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(screen.getByText('resetPassword.expired.title')).toBeInTheDocument();
    expect(screen.queryByText('resetPassword.verifying')).not.toBeInTheDocument();
  });
});
