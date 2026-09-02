import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GroupDetailPage from './GroupDetailPage';
import { Share } from '@capacitor/share';

// Los web components de Ionic no se presentan bajo jsdom: se pintan los hijos
// (mismo patrón que GroupPage.test.tsx). Las alertas muestran su cabecera al abrirse.
vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonButtons: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonBackButton: () => <button type="button">back</button>,
  IonTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonSpinner: () => <div data-testid="spinner" />,
  IonLoading: () => null,
  IonAlert: ({ isOpen, header }: { isOpen: boolean; header?: string }) =>
    isOpen ? <div role="alertdialog">{header}</div> : null,
  IonActionSheet: ({ isOpen, header }: { isOpen: boolean; header?: string }) =>
    isOpen ? <div role="menu">{header}</div> : null,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'g1' }),
  useHistory: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: mockT, i18n: { language: 'es', changeLanguage: vi.fn() } }),
}));

vi.mock('@capacitor/share', () => ({ Share: { canShare: vi.fn(), share: vi.fn() } }));
vi.mock('../hooks/useAnalytics', () => ({
  useScreenView: () => {},
  useAnalytics: () => ({ track: vi.fn() }),
}));
const mockShowError = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: vi.fn(), showInfo: vi.fn() }),
}));
vi.mock('../hooks/useGroupSync', () => ({ useGroupSync: () => {} }));
vi.mock('../hooks/useMyColor', () => ({ useMyColor: () => '#60A5FA' }));
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector?: (s: { user: { id: string; name: string } }) => unknown) => {
    const state = { user: { id: 'u1', name: 'Vera' } };
    return selector ? selector(state) : state;
  }),
}));

const NAMES = ['Vera', 'Hugo', 'Noa', 'Leo', 'Iris', 'Teo'];
const users = NAMES.map((name, i) => ({ id: `u${i + 1}`, name, avatarEmoji: '😊' }));
const GROUP = {
  id: 'g1',
  name: 'La cuadrilla',
  emoji: '🏔️',
  createdById: 'u1',
  createdAt: '2026-01-10T10:00:00Z',
  members: users.map((u, i) => ({
    userId: u.id,
    joinedAt: `2026-01-1${i}T10:00:00Z`,
    role: i === 0 ? 'admin' : 'member',
    user: u,
  })),
};
vi.mock('../hooks/useGroups', () => ({
  useGroup: () => ({ data: GROUP, isLoading: false }),
  useGroupInvite: () => ({
    data: { inviteCode: '48213956', inviteUrl: 'https://quedamos.alvarotc.com/join/48213956' },
  }),
  useRefreshInvite: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useLeaveGroup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateMemberRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useKickMember: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteGroup: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const attendee = (id: string, status: string) => ({
  userId: id,
  status,
  user: users.find((u) => u.id === id),
});
vi.mock('../hooks/useEvents', () => ({
  useEvents: () => ({
    data: [
      {
        id: 'e-past',
        groupId: 'g1',
        title: 'Ruta al Veleta',
        date: '2020-01-01',
        status: 'confirmed',
        isOnline: false,
        attendees: [],
        createdBy: { id: 'u4', name: 'Leo' },
      },
      {
        id: 'e-later',
        groupId: 'g1',
        title: 'Pádel y cañas',
        date: '2099-02-01',
        time: '12:00:00',
        status: 'pending',
        isOnline: false,
        attendees: [attendee('u1', 'confirmed')],
        createdBy: { id: 'u2', name: 'Hugo' },
      },
      {
        id: 'e-next',
        groupId: 'g1',
        title: 'Cena en casa de Iris',
        date: '2099-01-05',
        time: '21:00:00',
        location: 'Casa de Iris',
        status: 'confirmed',
        isOnline: false,
        attendees: users.map((u) => attendee(u.id, 'confirmed')),
        createdBy: { id: 'u5', name: 'Iris' },
      },
    ],
    isLoading: false,
  }),
}));
vi.mock('../hooks/usePolls', () => ({
  usePolls: () => ({
    data: [
      {
        id: 'p1',
        groupId: 'g1',
        createdById: 'u5',
        date: '2099-01-05',
        slot: 'Noche',
        status: 'open',
        createdAt: '2026-09-01T09:00:00Z',
        createdBy: users[4],
        responses: users.slice(0, 5).map((u) => ({ userId: u.id, answer: 'yes', respondedAt: '', user: u })),
      },
    ],
  }),
}));
vi.mock('../hooks/useWeather', () => ({
  useGroupWeather: () => ({
    data: [{ city: 'Granada', date: '2099-01-05', tempMax: 27, tempMin: 14, weatherCode: 0, description: '' }],
  }),
}));
vi.mock('../hooks/useGroupCities', () => ({
  useGroupCities: () => ({ data: [{ id: 'c1', name: 'Granada', lat: 37.18, lon: -3.6 }] }),
  useAddCity: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveCity: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../hooks/useCitySearch', () => ({ useCitySearch: () => ({ data: [], isLoading: false }) }));

describe('GroupDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('presenta el grupo con su aro, su nombre y tu color', () => {
    render(<GroupDetailPage />);
    expect(screen.getByRole('heading', { name: 'La cuadrilla' })).toBeInTheDocument();
    expect(mockT).toHaveBeenCalledWith('group.heroSubtitle', { color: 'colors.blue' });
    expect(mockT).toHaveBeenCalledWith('group.memberCount', { count: 6 });
  });

  it('la ficha de próxima quedada enseña la primera que queda por venir', () => {
    render(<GroupDetailPage />);
    expect(screen.getByText('group.tiles.nextEvent')).toBeInTheDocument();
    expect(screen.getByText('Cena en casa de Iris')).toBeInTheDocument();
    expect(screen.queryByText('Pádel y cañas')).toBeNull();
    expect(screen.queryByText('Ruta al Veleta')).toBeNull();
  });

  it('la ficha en el aire dice qué pregunta hay abierta y quién falta', () => {
    render(<GroupDetailPage />);
    expect(screen.getByText('group.tiles.openQuestion')).toBeInTheDocument();
    expect(mockT).toHaveBeenCalledWith('group.tiles.missing', { names: 'Teo', count: 1 });
  });

  it('la ficha de invitar enseña el código con su guion', () => {
    render(<GroupDetailPage />);
    expect(screen.getByText('4821-3956')).toBeInTheDocument();
  });

  it('el tiempo enseña la ciudad y las temperaturas', () => {
    render(<GroupDetailPage />);
    expect(screen.getByText('Granada')).toBeInTheDocument();
    expect(screen.getByText(/27°/)).toBeInTheDocument();
  });

  it('los miembros van en filas con el rol de quien lo tiene', () => {
    render(<GroupDetailPage />);
    for (const name of NAMES) expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    expect(screen.getByText('group.creator')).toBeInTheDocument();
  });

  it('salir del grupo pide confirmación', () => {
    render(<GroupDetailPage />);
    fireEvent.click(screen.getByRole('button', { name: 'group.leaveGroup' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('group.leaveTitle');
  });

  describe('compartir la invitación', () => {
    it('si se cierra la hoja de compartir no se cae al portapapeles ni avisa de un error', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('no clipboard'));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      vi.mocked(Share.share).mockRejectedValueOnce(new DOMException('canceled', 'AbortError'));

      render(<GroupDetailPage />);
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      await waitFor(() => expect(Share.share).toHaveBeenCalled());
      expect(writeText).not.toHaveBeenCalled();
      expect(mockShowError).not.toHaveBeenCalled();
    });

    it('si compartir falla de verdad se cae al portapapeles', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      vi.mocked(Share.share).mockRejectedValueOnce(new Error('no share target'));

      render(<GroupDetailPage />);
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      await waitFor(() => expect(writeText).toHaveBeenCalledWith('48213956'));
    });
  });
});
