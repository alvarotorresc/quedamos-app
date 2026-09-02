import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GroupPage from './GroupPage';
import { ApiError } from '../lib/api';

// Ionic web components never present under jsdom (see AskGroupSheet.test.tsx) —
// render children directly, like other page/component tests do.
vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonSpinner: () => <div data-testid="spinner" />,
}));

// The emoji picker is only reached via the "create group" form (not exercised
// here) but is imported unconditionally by GroupPage — stub it out so its
// real custom-element registration never runs under jsdom.
vi.mock('@emoji-mart/react', () => ({ default: () => null }));
vi.mock('@emoji-mart/data', () => ({ default: {} }));

vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { id: string; name: string } | null }) => unknown) =>
    selector({ user: { id: 'user-1', name: 'Álvaro' } }),
  ),
}));

vi.mock('../hooks/useAnalytics', () => ({
  useScreenView: () => {},
}));

vi.mock('../hooks/useMyColor', () => ({
  useMyColor: () => '#60A5FA',
}));

const createGroupMock = vi.fn();
const joinGroupMock = vi.fn();
vi.mock('../hooks/useGroups', () => ({
  useGroups: () => ({ data: [], isLoading: false }),
  useCreateGroup: () => ({ mutateAsync: createGroupMock, isPending: false }),
  useJoinGroup: () => ({ mutateAsync: joinGroupMock, isPending: false }),
}));

function openJoinFormAndSubmit(code: string) {
  render(<GroupPage />);

  // No groups yet -> EmptyState's secondary action opens the join form.
  fireEvent.click(screen.getByText('group.welcome.haveCode'));

  const input = screen.getByPlaceholderText('group.inviteCodePlaceholder');
  fireEvent.change(input, { target: { value: code } });

  // Two buttons share this label: the top toggle and the form's submit button —
  // the submit one is the last rendered.
  const joinButtons = screen.getAllByText('group.joinWithCode');
  fireEvent.click(joinButtons[joinButtons.length - 1]);
}

describe('GroupPage — sin grupos', () => {
  it('la bienvenida sale de i18n', () => {
    render(<GroupPage />);
    expect(screen.getByText('group.welcome.title')).toBeInTheDocument();
    expect(screen.getByText('group.welcome.description')).toBeInTheDocument();
    expect(screen.getByText('group.createGroup')).toBeInTheDocument();
  });
});

describe('GroupPage — unirse con código', () => {
  it('un 409 muestra group.alreadyMember aunque el mensaje no lo mencione (se detecta por status)', async () => {
    joinGroupMock.mockRejectedValueOnce(new ApiError('Conflict', 409));

    openJoinFormAndSubmit('12345678');

    expect(await screen.findByText('group.alreadyMember')).toBeInTheDocument();
  });

  it('un error que no es 409 muestra el error genérico de unirse', async () => {
    joinGroupMock.mockRejectedValueOnce(new ApiError('Internal error', 500));

    openJoinFormAndSubmit('12345678');

    expect(await screen.findByText('group.joinError')).toBeInTheDocument();
  });
});
