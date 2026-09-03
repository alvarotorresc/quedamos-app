import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfilePage from './ProfilePage';
import { NOTIF_SECTIONS } from '../services/notification-preferences';
import { accountService } from '../services/account';
import { saveExport } from '../lib/export-data';
import { reloadToRoot } from '../lib/reload';

// Los web components de Ionic no se presentan bajo jsdom (ver AskGroupSheet.test.tsx):
// se pintan los hijos directamente, como en el resto de tests de páginas.
vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="ion-modal">{children}</div> : null,
  useIonViewWillEnter: () => {},
}));

const showSuccessMock = vi.fn();
const showErrorMock = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showSuccess: showSuccessMock, showError: showErrorMock, showInfo: vi.fn() }),
}));
vi.mock('../services/account', () => ({
  accountService: { exportData: vi.fn(), deleteAccount: vi.fn() },
}));
vi.mock('../lib/export-data', () => ({ saveExport: vi.fn() }));
// La navegación real no se puede espiar en jsdom: se aísla en el helper y se mockea.
vi.mock('../lib/reload', () => ({ reloadToRoot: vi.fn() }));

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
const deleteAccountMock = vi.fn();
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn(
    (
      selector: (s: {
        user: { id: string; name: string; email: string; avatarEmoji: string; timeSlots?: Record<string, string> } | null;
        signOut: () => Promise<void>;
        deleteAccount: () => Promise<void>;
        updateName: () => Promise<void>;
        updateEmail: () => Promise<void>;
        updatePassword: () => Promise<void>;
        updateTimeSlots: () => Promise<void>;
      }) => unknown,
    ) =>
      selector({
        user: {
          id: 'user-1',
          name: 'Álvaro Torres',
          email: 'alvaro@ejemplo.com',
          avatarEmoji: '😊',
          timeSlots: {
            morningStart: '07:30',
            morningEnd: '13:00',
            afternoonStart: '13:00',
            afternoonEnd: '20:00',
            nightStart: '20:00',
            nightEnd: '02:00',
          },
        },
        signOut: signOutMock,
        deleteAccount: deleteAccountMock,
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
    fireEvent.click(screen.getByRole('tab', { name: 'EN' }));
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

  it('cerrar sesión llama a signOut y recarga en la landing', async () => {
    render(<ProfilePage />);
    fireEvent.click(screen.getByRole('button', { name: 'profile.logout' }));
    expect(signOutMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(reloadToRoot).toHaveBeenCalledTimes(1));
  });

  describe('mis datos', () => {
    it('pide el export a la API, lo guarda y confirma', async () => {
      const dump = { profile: { id: 'user-1' } };
      vi.mocked(accountService.exportData).mockResolvedValue(dump);
      vi.mocked(saveExport).mockResolvedValue({ saved: true });
      render(<ProfilePage />);

      fireEvent.click(screen.getByRole('button', { name: /profile\.exportData\.action/ }));

      await waitFor(() => expect(saveExport).toHaveBeenCalledWith(dump));
      expect(showSuccessMock).toHaveBeenCalledWith('profile.exportData.done');
      expect(showErrorMock).not.toHaveBeenCalled();
    });

    it('no confirma nada si el usuario cierra la hoja de compartir', async () => {
      vi.mocked(accountService.exportData).mockResolvedValue({});
      vi.mocked(saveExport).mockResolvedValue({ saved: false });
      render(<ProfilePage />);

      fireEvent.click(screen.getByRole('button', { name: /profile\.exportData\.action/ }));

      await waitFor(() => expect(saveExport).toHaveBeenCalled());
      expect(showSuccessMock).not.toHaveBeenCalled();
    });

    it('avisa cuando la descarga falla', async () => {
      vi.mocked(accountService.exportData).mockRejectedValue(new Error('500'));
      render(<ProfilePage />);

      fireEvent.click(screen.getByRole('button', { name: /profile\.exportData\.action/ }));

      await waitFor(() => expect(showErrorMock).toHaveBeenCalledWith('profile.exportData.error'));
      expect(saveExport).not.toHaveBeenCalled();
      // Queda listo para reintentar.
      expect(screen.getByRole('button', { name: /profile\.exportData\.action/ })).toBeEnabled();
    });
  });

  describe('eliminar cuenta', () => {
    it('abre la hoja de confirmación desde la fila de cuenta', () => {
      render(<ProfilePage />);
      expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'profile.deleteAccount.action' }));

      expect(screen.getByRole('heading', { name: 'profile.deleteAccount.title' })).toBeInTheDocument();
      expect(deleteAccountMock).not.toHaveBeenCalled();
    });

    it('al confirmar borra la cuenta, avisa y programa la recarga en la landing', async () => {
      // La recarga se difiere para que el toast se lea: se comprueba el temporizador, no se espera.
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
      deleteAccountMock.mockResolvedValue(undefined);
      render(<ProfilePage />);
      fireEvent.click(screen.getByRole('button', { name: 'profile.deleteAccount.action' }));
      fireEvent.change(screen.getByLabelText(/profile\.deleteAccount\.typeToConfirm/), {
        // El mock de t devuelve la clave: esa es la palabra que espera la hoja.
        target: { value: 'profile.deleteAccount.confirmWord' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'profile.deleteAccount.confirm' }));

      await waitFor(() => expect(deleteAccountMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(showSuccessMock).toHaveBeenCalledWith('profile.deleteAccount.done'));
      expect(setTimeoutSpy).toHaveBeenCalledWith(reloadToRoot, 1500);
      expect(reloadToRoot).not.toHaveBeenCalled();
      setTimeoutSpy.mockRestore();
    });

    it('si el borrado falla la hoja muestra el error y no se recarga', async () => {
      deleteAccountMock.mockRejectedValue(new Error('network'));
      render(<ProfilePage />);
      fireEvent.click(screen.getByRole('button', { name: 'profile.deleteAccount.action' }));
      fireEvent.change(screen.getByLabelText(/profile\.deleteAccount\.typeToConfirm/), {
        target: { value: 'profile.deleteAccount.confirmWord' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'profile.deleteAccount.confirm' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('profile.deleteAccount.error');
      expect(showSuccessMock).not.toHaveBeenCalled();
      expect(reloadToRoot).not.toHaveBeenCalled();
    });
  });

describe('ProfilePage — franjas', () => {
  it('la ficha muestra las franjas guardadas, y una edición sin guardar no las pisa al cerrar el editor', () => {
    render(<ProfilePage />);
    expect(screen.getByText('07:30–13:00')).toBeInTheDocument();

    const tile = screen.getByRole('button', { expanded: false, name: /07:30/ });
    fireEvent.click(tile);
    const inputs = screen.getAllByDisplayValue('07:30');
    fireEvent.change(inputs[0], { target: { value: '06:00' } });
    // The preview keeps the saved value while the buffer holds 06:00, so it is still named by 07:30.
    fireEvent.click(screen.getByRole('button', { expanded: true, name: /07:30/ }));

    expect(screen.getByText('07:30–13:00')).toBeInTheDocument();
    expect(screen.queryByText('06:00–13:00')).toBeNull();
  });
});
});
