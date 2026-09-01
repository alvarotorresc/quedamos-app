import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import JoinGroupPage from './JoinGroupPage';
import { ApiError } from '../lib/api';

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
});
