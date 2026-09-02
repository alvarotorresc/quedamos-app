import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfilePage from './ProfilePage';
import { NOTIF_SECTIONS } from '../services/notification-preferences';

// Los web components de Ionic no se presentan bajo jsdom (ver AskGroupSheet.test.tsx):
// se pintan los hijos directamente, como en el resto de tests de páginas.
vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useIonViewWillEnter: () => {},
}));

const pushMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push: pushMock, replace: vi.fn() }),
}));

const changeLanguageMock = vi.fn();
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o && Object.keys(o).length ? `${k}:${Object.values(o).join(',')}` : k,
    i18n: { language: 'es', changeLanguage: changeLanguageMock },
  }),
}));

const signOutMock = vi.fn();
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn(
    (
      selector: (s: {
        user: { id: string; name: string; email: string; avatarEmoji: string } | null;
        signOut: () => Promise<void>;
        updateName: () => Promise<void>;
        updateEmail: () => Promise<void>;
        updatePassword: () => Promise<void>;
        updateTimeSlots: () => Promise<void>;
      }) => unknown,
    ) =>
      selector({
        user: { id: 'user-1', name: 'Álvaro Torres', email: 'alvaro@ejemplo.com', avatarEmoji: '😊' },
        signOut: signOutMock,
        updateName: vi.fn(),
        updateEmail: vi.fn(),
        updatePassword: vi.fn(),
        updateTimeSlots: vi.fn(),
      }),
  ),
}));

const toggleThemeMock = vi.fn();
let darkMode = true;
vi.mock('../stores/theme', () => ({
  useThemeStore: vi.fn((selector: (s: { darkMode: boolean; toggle: () => void }) => unknown) =>
    selector({ darkMode, toggle: toggleThemeMock }),
  ),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { refreshSession: () => Promise.resolve() } } }));
vi.mock('../hooks/useAnalytics', () => ({ useScreenView: () => {} }));
vi.mock('../hooks/useMyColor', () => ({ useMyColor: () => '#60A5FA' }));
vi.mock('../hooks/useGroups', () => ({
  useGroups: () => ({ data: [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }], isLoading: false }),
}));
vi.mock('../hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: () => ({
    data: [
      { type: 'event_declined', enabled: false },
      { type: 'proposal_voted', enabled: false },
    ],
  }),
}));

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    darkMode = true;
  });

  it('presenta la identidad con el color y el número de grupos', () => {
    render(<ProfilePage />);
    expect(screen.getByRole('heading', { name: 'Álvaro Torres' })).toBeInTheDocument();
    // en la identidad y en la fila de email de la cuenta
    expect(screen.getAllByText('alvaro@ejemplo.com')).toHaveLength(2);
    expect(screen.getByText(/profile\.groupsCount:3/)).toBeInTheDocument();
  });

  it('la ficha de avisos cuenta los activos y lleva a notificaciones', () => {
    render(<ProfilePage />);
    const total = NOTIF_SECTIONS.flatMap((s) => s.types).length;
    const tile = screen.getByRole('button', { name: /profile\.tiles\.notifications/ });
    // dos tipos desactivados en el mock
    expect(tile).toHaveTextContent(String(total - 2));
    expect(tile).toHaveTextContent(`profile.tiles.activeOf:${total}`);
    fireEvent.click(tile);
    expect(pushMock).toHaveBeenCalledWith('/tabs/profile/notifications');
  });

  it('el toggle de tema refleja el modo y lo cambia', () => {
    render(<ProfilePage />);
    const sw = screen.getByRole('switch', { name: 'profile.theme' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toHaveStyle({ background: '#60A5FA' });
    fireEvent.click(sw);
    expect(toggleThemeMock).toHaveBeenCalledTimes(1);
  });

  it('el idioma se cambia con las pastillas', () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(changeLanguageMock).toHaveBeenCalledWith('en');
  });

  it('reportar error abre el formulario de Tally en otra pestaña', () => {
    render(<ProfilePage />);
    const link = screen.getByRole('link', { name: /profile\.reportBug/ });
    expect(link).toHaveAttribute('href', 'https://tally.so/r/ODMzOa');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('la fila de nombre despliega su editor', () => {
    render(<ProfilePage />);
    expect(screen.queryByPlaceholderText('profile.newName')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /profile\.name/ }));
    expect(screen.getByPlaceholderText('profile.newName')).toBeInTheDocument();
  });

  it('cerrar sesión llama a signOut', () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'profile.logout' }));
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
