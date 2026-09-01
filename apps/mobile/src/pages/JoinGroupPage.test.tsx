import { StrictMode } from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import JoinGroupPage from './JoinGroupPage';
import { ApiError } from '../lib/api';

// A promise we can resolve/reject on our own schedule, to simulate the join
// request settling after the page has already unmounted.
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// IonPage/IonContent/IonSpinner are Stencil web components that never present under
// jsdom (see AskGroupSheet.test.tsx) — render children directly.
vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonSpinner: () => <div data-testid="spinner" />,
}));

const historyReplaceMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ code: '12345678' }),
  useHistory: () => ({ replace: historyReplaceMock, push: vi.fn() }),
}));

// Logged-in user — otherwise the effect redirects to /login before it ever joins.
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
  ),
}));

vi.mock('../hooks/useAnalytics', () => ({
  useScreenView: () => {},
}));

const joinGroupMock = vi.fn();
vi.mock('../hooks/useGroups', () => ({
  useJoinGroup: () => ({ mutateAsync: joinGroupMock }),
}));

describe('JoinGroupPage', () => {
  it('un 409 muestra group.alreadyMember aunque el mensaje no lo mencione (se detecta por status)', async () => {
    joinGroupMock.mockRejectedValueOnce(new ApiError('Conflict', 409));

    render(<JoinGroupPage />);

    expect(await screen.findByText('group.alreadyMember')).toBeInTheDocument();
    expect(historyReplaceMock).not.toHaveBeenCalledWith(expect.stringContaining('/tabs/group/'));
  });

  it('un error que no es 409 muestra el error genérico de unirse', async () => {
    joinGroupMock.mockRejectedValueOnce(new ApiError('Internal error', 500));

    render(<JoinGroupPage />);

    expect(await screen.findByText('joinGroup.error')).toBeInTheDocument();
  });

  describe('unmount mid-request', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('no navega si el join resuelve después de desmontar el componente', async () => {
      const deferred = createDeferred<{ id: string }>();
      joinGroupMock.mockReturnValueOnce(deferred.promise);
      vi.useFakeTimers();

      const { unmount } = render(<JoinGroupPage />);
      unmount();

      // Resolve the mutation only after the page is gone, then let its .then()
      // and the (would-be) nav timeout run their course.
      await act(async () => {
        deferred.resolve({ id: 'group-1' });
        await Promise.resolve();
        await Promise.resolve();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(historyReplaceMock).not.toHaveBeenCalledWith(expect.stringContaining('/tabs/group/'));
    });

    it('no navega si el componente se desmonta tras el éxito pero antes de que salte el timeout', async () => {
      joinGroupMock.mockResolvedValueOnce({ id: 'group-1' });
      vi.useFakeTimers();

      const { unmount } = render(<JoinGroupPage />);

      // Let the join succeed and the nav timeout get scheduled, then unmount
      // before the 1s timeout fires.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      unmount();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(historyReplaceMock).not.toHaveBeenCalledWith(expect.stringContaining('/tabs/group/'));
    });

    it('navega tras un join exitoso aunque StrictMode remonte el efecto en dev', async () => {
      const deferred = createDeferred<{ id: string }>();
      joinGroupMock.mockReturnValueOnce(deferred.promise);
      vi.useFakeTimers();

      render(
        <StrictMode>
          <JoinGroupPage />
        </StrictMode>,
      );

      await act(async () => {
        deferred.resolve({ id: 'group-1' });
        await Promise.resolve();
        await Promise.resolve();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(historyReplaceMock).toHaveBeenCalledWith('/tabs/group/group-1');
    });
  });
});
