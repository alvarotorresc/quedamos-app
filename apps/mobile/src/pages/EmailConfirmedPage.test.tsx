import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EmailConfirmedPage from './EmailConfirmedPage';
import { supabase } from '../lib/supabase';
import { savePendingRedirect } from '../lib/pending-redirect';

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const replaceMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock('../hooks/useAnalytics', () => ({ useScreenView: () => {} }));

type GetSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;
type AuthChangeCallback = (event: string, session: unknown) => void;

function withSession(session: unknown): void {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session },
    error: null,
  } as unknown as GetSessionResult);
}

/** The listener the page attached, so a test can deliver the event late. */
function authListener(): AuthChangeCallback {
  const call = vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1);
  if (!call) throw new Error('the page never listened for auth changes');
  return call[0] as unknown as AuthChangeCallback;
}

describe('EmailConfirmedPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    replaceMock.mockClear();
    withSession(null);
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits while Supabase reads the token out of the link', async () => {
    render(<EmailConfirmedPage />);

    expect(screen.getByText('emailConfirmed.waiting')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('confirms and continues to the tabs when the link opened a session', async () => {
    withSession({ user: { id: 'user-1' } });

    render(<EmailConfirmedPage />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('emailConfirmed.title')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(replaceMock).toHaveBeenCalledWith('/tabs');
  });

  it('resumes the invite parked before signing up instead of the tabs', async () => {
    savePendingRedirect('/join/12345678');
    withSession({ user: { id: 'user-1' } });

    render(<EmailConfirmedPage />);
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(replaceMock).toHaveBeenCalledWith('/join/12345678');
  });

  it('continues right away when the user taps the button', async () => {
    withSession({ user: { id: 'user-1' } });

    render(<EmailConfirmedPage />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByText('emailConfirmed.continue'));

    expect(replaceMock).toHaveBeenCalledWith('/tabs');
  });

  it('confirms when the session only shows up after mounting', async () => {
    render(<EmailConfirmedPage />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      authListener()('SIGNED_IN', { user: { id: 'user-1' } });
    });

    expect(screen.getByText('emailConfirmed.title')).toBeInTheDocument();
  });

  it('offers a way back when no session ever arrives', async () => {
    render(<EmailConfirmedPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });

    expect(screen.getByText('emailConfirmed.failed.title')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('emailConfirmed.failed.login'));
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('drops the failure screen when a slow session finally lands', async () => {
    render(<EmailConfirmedPage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(screen.getByText('emailConfirmed.failed.title')).toBeInTheDocument();

    await act(async () => {
      authListener()('SIGNED_IN', { user: { id: 'user-1' } });
    });

    expect(screen.getByText('emailConfirmed.title')).toBeInTheDocument();
  });
});
