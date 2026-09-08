import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GroupDetailPage from './GroupDetailPage';
import { Share } from '@capacitor/share';
import { ApiError } from '../lib/api';

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
  IonModal: ({ isOpen, children }: { isOpen: boolean; children?: React.ReactNode }) =>
    isOpen ? <div data-testid="sheet">{children}</div> : null,
  IonAlert: ({
    isOpen,
    header,
    buttons,
  }: {
    isOpen: boolean;
    header?: string;
    buttons?: Array<{ text: string; handler?: () => void }>;
  }) =>
    isOpen ? (
      <div role="alertdialog">
        {header}
        {(buttons ?? []).map((b) => (
          <button key={b.text} data-testid={`alert-${b.text}`} onClick={() => b.handler?.()}>
            {b.text}
          </button>
        ))}
      </div>
    ) : null,
  IonActionSheet: ({ isOpen, header }: { isOpen: boolean; header?: string }) =>
    isOpen ? <div role="menu">{header}</div> : null,
}));

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'g1' }),
  useHistory: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: mockT, i18n: { language: 'es', changeLanguage: vi.fn() } }),
}));

vi.mock('@capacitor/share', () => ({ Share: { canShare: vi.fn(), share: vi.fn() } }));
vi.mock('@emoji-mart/react', () => ({ default: () => null }));
vi.mock('@emoji-mart/data', () => ({ default: {} }));
vi.mock('../hooks/useAnalytics', () => ({
  useScreenView: () => {},
  useAnalytics: () => ({ track: vi.fn() }),
}));
const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: mockShowSuccess, showInfo: vi.fn() }),
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
// A4: la pantalla tiene tres caras (cargando, error, grupo) y cada prueba elige
// la suya, asi que el resultado de useGroup se lee tarde desde esta variable.
const mockDeleteGroup = vi.fn();
type GroupQuery = { data: typeof GROUP | undefined; isLoading: boolean; isError: boolean };
const LOADED: GroupQuery = { data: GROUP, isLoading: false, isError: false };
let groupQuery: GroupQuery = LOADED;
vi.mock('../hooks/useGroups', () => ({
  useGroup: () => groupQuery,
  useGroupInvite: () => ({
    data: { inviteCode: '48213956', inviteUrl: 'https://quedamos.alvarotc.com/join/48213956' },
  }),
  useRefreshInvite: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useLeaveGroup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateMemberRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useKickMember: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteGroup: () => ({ mutateAsync: mockDeleteGroup, isPending: false }),
  useUpdateGroup: () => ({ mutateAsync: mockUpdateGroup, isPending: false }),
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
const mockUpdateGroup = vi.fn();
const mockClosePoll = vi.fn();
let mockPollCreatedById = 'u5';
vi.mock('../hooks/usePolls', () => ({
  useClosePoll: () => ({ mutateAsync: mockClosePoll, isPending: false }),
  usePolls: () => ({
    data: [
      {
        id: 'p1',
        groupId: 'g1',
        createdById: mockPollCreatedById,
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
  beforeEach(() => {
    vi.clearAllMocks();
    groupQuery = LOADED;
    mockDeleteGroup.mockResolvedValue({ success: true });
    mockClosePoll.mockResolvedValue({ id: 'p1', status: 'closed' });
    mockPollCreatedById = 'u5';
    mockUpdateGroup.mockResolvedValue(GROUP);
  });

  // A4: `if (!group) return null` dejaba la pantalla en blanco — sin cabecera y
  // sin el atras — cuando la API responde 404 (grupo borrado o ya no eres miembro).
  describe('cuando el grupo no esta disponible', () => {
    it('mientras carga ensena esqueletos, no una pantalla en blanco', () => {
      groupQuery = { data: undefined, isLoading: true, isError: false };
      const { container } = render(<GroupDetailPage />);
      expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
      expect(screen.queryByRole('heading', { name: 'La cuadrilla' })).toBeNull();
    });

    it('si la API responde con error lo dice y deja volver a los grupos', () => {
      groupQuery = { data: undefined, isLoading: false, isError: true };
      render(<GroupDetailPage />);
      expect(screen.getByText('group.unavailableTitle')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'group.backToGroups' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'group.backToGroups' }));
      expect(mockReplace).toHaveBeenCalledWith('/tabs/group');
    });

    it('conserva la cabecera con el boton atras en el estado de error', () => {
      groupQuery = { data: undefined, isLoading: false, isError: true };
      render(<GroupDetailPage />);
      expect(screen.getByRole('button', { name: 'back' })).toBeInTheDocument();
    });

    it('trata un grupo ausente sin error como no disponible, no como pantalla en blanco', () => {
      groupQuery = { data: undefined, isLoading: false, isError: false };
      render(<GroupDetailPage />);
      expect(screen.getByText('group.unavailableTitle')).toBeInTheDocument();
    });
  });

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

  // A5: la API solo deja borrar a quien creó el grupo (createdById), pero el botón
  // se ofrecía a cualquier admin, que se comía un 403 al pulsarlo.
  describe('eliminar el grupo', () => {
    const asAdminNotCreator = () => {
      groupQuery = {
        data: { ...GROUP, createdById: 'u9' },
        isLoading: false,
        isError: false,
      };
    };

    it('quien creó el grupo ve el botón de eliminarlo', () => {
      render(<GroupDetailPage />);
      expect(screen.getByRole('button', { name: 'group.deleteGroup' })).toBeInTheDocument();
    });

    it('un admin que no lo creó no ve el botón', () => {
      asAdminNotCreator();
      render(<GroupDetailPage />);
      expect(screen.queryByRole('button', { name: 'group.deleteGroup' })).toBeNull();
      // Sigue siendo admin para lo demás: regenerar el código no se toca.
      expect(screen.getByRole('button', { name: /group.regenerateCode/ })).toBeInTheDocument();
    });

    it('si la API responde 403 lo dice con su propio aviso', async () => {
      mockDeleteGroup.mockRejectedValue(new ApiError('Forbidden', 403));
      render(<GroupDetailPage />);
      fireEvent.click(screen.getByRole('button', { name: 'group.deleteGroup' }));
      fireEvent.click(screen.getByTestId('alert-group.deleteGroup'));

      await waitFor(() =>
        expect(mockShowError).toHaveBeenCalledWith('errors.deleteGroupNotCreator'),
      );
    });

    it('cualquier otro fallo cae en el aviso genérico de borrado', async () => {
      mockDeleteGroup.mockRejectedValue(new Error('network'));
      render(<GroupDetailPage />);
      fireEvent.click(screen.getByRole('button', { name: 'group.deleteGroup' }));
      fireEvent.click(screen.getByTestId('alert-group.deleteGroup'));

      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('errors.deleteGroupFailed'));
    });
  });

  // B4: la API ya sabía cerrar una pregunta (POST .../close), pero la app no lo
  // ofrecía en ninguna pantalla; solo la puede cerrar quien la hizo.
  describe('cerrar la pregunta en el aire', () => {
    const asAskerOfTheOpenPoll = () => {
      mockPollCreatedById = 'u1';
    };

    it('no se lo ofrece a quien no hizo la pregunta', () => {
      render(<GroupDetailPage />);
      expect(screen.queryByRole('button', { name: 'group.closePoll' })).toBeNull();
    });

    it('quien preguntó puede cerrarla, con confirmación de por medio', async () => {
      asAskerOfTheOpenPoll();
      render(<GroupDetailPage />);

      fireEvent.click(screen.getByRole('button', { name: 'group.closePoll' }));
      // Confirmar primero: cerrar no se deshace.
      expect(mockClosePoll).not.toHaveBeenCalled();
      expect(screen.getByRole('alertdialog')).toHaveTextContent('group.closePollConfirm');

      fireEvent.click(screen.getByTestId('alert-group.closePoll'));
      await waitFor(() => expect(mockClosePoll).toHaveBeenCalledWith('p1'));
      expect(mockShowSuccess).toHaveBeenCalledWith('group.pollClosed');
    });

    it('cerrar no navega al calendario por debajo del botón', () => {
      asAskerOfTheOpenPoll();
      render(<GroupDetailPage />);

      fireEvent.click(screen.getByRole('button', { name: 'group.closePoll' }));

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('avisa si la API no deja cerrarla', async () => {
      asAskerOfTheOpenPoll();
      mockClosePoll.mockRejectedValue(new ApiError('Forbidden', 403));
      render(<GroupDetailPage />);

      fireEvent.click(screen.getByRole('button', { name: 'group.closePoll' }));
      fireEvent.click(screen.getByTestId('alert-group.closePoll'));

      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('errors.closePollFailed'));
    });
  });

  // B3: el nombre y el emoji del grupo eran de solo lectura en toda la app.
  describe('editar el grupo', () => {
    const asPlainMember = () => {
      groupQuery = {
        data: {
          ...GROUP,
          createdById: 'u9',
          members: GROUP.members.map((m) =>
            m.userId === 'u1' ? { ...m, role: 'member' } : m,
          ),
        },
        isLoading: false,
        isError: false,
      };
    };

    it('un admin ve el botón de editar en la ficha del grupo', () => {
      render(<GroupDetailPage />);
      expect(screen.getByRole('button', { name: 'group.editGroup' })).toBeInTheDocument();
    });

    it('un miembro raso no lo ve', () => {
      asPlainMember();
      render(<GroupDetailPage />);
      expect(screen.queryByRole('button', { name: 'group.editGroup' })).toBeNull();
    });

    it('la hoja se abre con el nombre y el emoji que ya tiene', () => {
      render(<GroupDetailPage />);
      fireEvent.click(screen.getByRole('button', { name: 'group.editGroup' }));

      expect(screen.getByTestId('sheet')).toBeInTheDocument();
      expect(screen.getByLabelText('group.groupName')).toHaveValue('La cuadrilla');
      expect(screen.getByRole('button', { name: 'group.emoji' })).toHaveTextContent('🏔️');
    });

    it('guardar manda el nombre nuevo recortado y avisa', async () => {
      render(<GroupDetailPage />);
      fireEvent.click(screen.getByRole('button', { name: 'group.editGroup' }));
      fireEvent.change(screen.getByLabelText('group.groupName'), {
        target: { value: '  Los del monte  ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'group.save' }));

      await waitFor(() =>
        expect(mockUpdateGroup).toHaveBeenCalledWith({ name: 'Los del monte', emoji: '🏔️' }),
      );
      expect(mockShowSuccess).toHaveBeenCalledWith('group.groupUpdated');
    });

    it('no deja guardar un nombre vacío', () => {
      render(<GroupDetailPage />);
      fireEvent.click(screen.getByRole('button', { name: 'group.editGroup' }));
      fireEvent.change(screen.getByLabelText('group.groupName'), { target: { value: '   ' } });

      expect(screen.getByRole('button', { name: 'group.save' })).toBeDisabled();
    });

    it('avisa si la API rechaza el cambio', async () => {
      mockUpdateGroup.mockRejectedValue(new ApiError('Forbidden', 403));
      render(<GroupDetailPage />);
      fireEvent.click(screen.getByRole('button', { name: 'group.editGroup' }));
      fireEvent.click(screen.getByRole('button', { name: 'group.save' }));

      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('errors.updateGroupFailed'));
    });
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
