import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PlansPage from './PlansPage';

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonSpinner: () => <div data-testid="spinner" />,
  IonLoading: () => null,
  IonAlert: () => null,
}));
let search = '';
// Stable across renders so tests can assert on it (a fresh object per call would lose
// every recorded push/replace).
const history = { push: vi.fn(), replace: vi.fn() };
vi.mock('react-router-dom', () => ({
  useHistory: () => history,
  useLocation: () => ({ search, pathname: '/tabs/plans' }),
}));
const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: mockT, i18n: { language: 'es', changeLanguage: vi.fn() } }),
}));
vi.mock('react-icons/hi2', () => ({
  HiOutlineCalendar: () => <span data-testid="icon-calendar" />,
}));
vi.mock('../hooks/useAnalytics', () => ({ useScreenView: () => {}, useAnalytics: () => ({ track: vi.fn() }) }));
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }),
}));
vi.mock('../hooks/useGroupSync', () => ({ useGroupSync: () => {} }));
vi.mock('../hooks/useMyColor', () => ({ useMyColor: () => '#60A5FA' }));
vi.mock('../hooks/useWeather', () => ({ useGroupWeather: () => ({ data: [] }) }));
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector?: (s: { user: { id: string; name: string } }) => unknown) => {
    const state = { user: { id: 'u1', name: 'Vera' } };
    return selector ? selector(state) : state;
  }),
}));
const GROUP = { id: 'g1', name: 'La cuadrilla', emoji: '🏔️', createdById: 'u1', createdAt: '', members: [] };
let groupsList: (typeof GROUP)[] = [GROUP];
// One state object for the whole render, with stable function identities: useAutoSelectGroup
// reads it through three separate selector calls and depends on them not changing.
const setCurrentGroup = vi.fn();
const getPersistedGroupId = vi.fn(() => null as string | null);
const groupState = {
  currentGroup: null as typeof GROUP | null,
  setCurrentGroup,
  getPersistedGroupId,
};
vi.mock('../stores/group', () => ({
  useGroupStore: vi.fn((selector?: (s: typeof groupState) => unknown) =>
    selector ? selector(groupState) : groupState,
  ),
}));
vi.mock('../hooks/useGroups', () => ({
  useGroups: () => ({ data: groupsList, isLoading: false }),
  useGroup: () => ({ data: GROUP, isLoading: false }),
  useGroupInvite: () => ({ data: undefined }),
}));
let proposals: Array<Record<string, unknown>> = [];
vi.mock('../hooks/useProposals', () => ({
  useProposals: () => ({ data: proposals, isLoading: false }),
  useVoteProposal: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCloseProposal: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));

const prop = (id: string, status: string) => ({
  id,
  groupId: 'g1',
  title: `Propuesta ${id}`,
  status,
  createdBy: { id: 'u1', name: 'Vera' },
  votes: [],
});

let events: Array<Record<string, unknown>> = [];
vi.mock('../hooks/useEvents', () => ({
  useEvents: () => ({ data: events, isLoading: false }),
  useDeleteEvent: () => ({ mutateAsync: vi.fn() }),
  useCancelEvent: () => ({ mutateAsync: vi.fn() }),
  useConfirmEvent: () => ({ mutateAsync: vi.fn() }),
  useRespondEvent: () => ({ mutate: vi.fn(), isPending: false }),
}));

// La tarjeta se prueba en EventCard.test.tsx; aquí solo importa a cuál se destaca.
vi.mock('../components/EventCard', () => ({
  EventCard: ({ event, featured }: { event: { title: string }; featured?: boolean }) => (
    <div data-testid={featured ? 'event-featured' : 'event-card'}>{event.title}</div>
  ),
}));
vi.mock('../components/ProposalCard', () => ({ ProposalCard: () => null }));
vi.mock('../components/CreateProposalModal', () => ({ CreateProposalModal: () => null }));
vi.mock('../components/EditProposalModal', () => ({ EditProposalModal: () => null }));
vi.mock('../components/ConvertProposalModal', () => ({ ConvertProposalModal: () => null }));
vi.mock('../components/EditEventModal', () => ({ EditEventModal: () => null }));

const ev = (id: string, title: string, date: string, status: string, myStatus = 'confirmed') => ({
  id,
  groupId: 'g1',
  title,
  date,
  status,
  isOnline: false,
  attendees: [{ userId: 'u1', status: myStatus, user: { id: 'u1', name: 'Vera', avatarEmoji: '😊' } }],
  createdBy: { id: 'u1', name: 'Vera' },
});

describe('PlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search = '';
    proposals = [];
    groupsList = [GROUP];
    groupState.currentGroup = GROUP;
    getPersistedGroupId.mockReturnValue(null);
    events = [
      ev('e2', 'Pádel y cañas', '2099-02-01', 'pending', 'pending'),
      ev('e1', 'Cena en casa de Iris', '2099-01-05', 'confirmed'),
      ev('e0', 'Ruta al Veleta', '2020-01-01', 'confirmed'),
    ];
  });

  it('la cabecera cuenta las próximas y las que están en el aire', () => {
    render(<PlansPage />);
    expect(screen.getByRole('heading', { name: 'plans.title' })).toBeInTheDocument();
    expect(mockT).toHaveBeenCalledWith('plans.upcomingCount', { count: 2 });
    expect(mockT).toHaveBeenCalledWith('plans.pendingCount', { count: 1 });
  });

  it('destaca la próxima quedada cuando ya está confirmada y lista el resto', () => {
    render(<PlansPage />);
    expect(screen.getByTestId('event-featured')).toHaveTextContent('Cena en casa de Iris');
    expect(screen.getByTestId('event-card')).toHaveTextContent('Pádel y cañas');
  });

  it('no destaca nada si la próxima sigue en el aire', () => {
    events = [ev('e2', 'Pádel y cañas', '2099-02-01', 'pending', 'pending')];
    render(<PlansPage />);
    expect(screen.queryByTestId('event-featured')).toBeNull();
    expect(screen.getByTestId('event-card')).toHaveTextContent('Pádel y cañas');
  });

  it('la sección de próximas lleva el icono de calendario', () => {
    render(<PlansPage />);
    expect(screen.getByTestId('icon-calendar')).toBeInTheDocument();
    expect(screen.getByText('plans.upcoming')).toBeInTheDocument();
  });

  it('sin grupos, el botón de ir a grupos usa el primario del sistema', () => {
    groupsList = [];
    render(<PlansPage />);
    const btn = screen.getByRole('button', { name: 'plans.goToGroups' });
    expect(btn.className).toContain('bg-primary-solid');
    expect(btn.className).not.toContain('bg-primary-dark');
  });

  it('al quedarse sin grupos, suelta el que había seleccionado', () => {
    // La copia que vivía aquí no tenía la rama `groups.length === 0` de
    // useAutoSelectGroup: al salir del último grupo, Planes seguía apuntando a él.
    groupsList = [];
    groupState.currentGroup = GROUP;

    render(<PlansPage />);

    expect(setCurrentGroup).toHaveBeenCalledWith(null);
  });

  it('el groupId del enlace de la notificación manda sobre el grupo seleccionado', () => {
    // El service worker no puede tocar el localStorage: el groupId de la URL es el único
    // canal que le llega, y Planes lo ignoraba.
    const otro = { ...GROUP, id: 'g2', name: 'La otra' };
    groupsList = [GROUP, otro];
    groupState.currentGroup = GROUP;
    search = '?eventId=e1&groupId=g2';

    render(<PlansPage />);

    expect(setCurrentGroup).toHaveBeenCalledWith(otro);
  });

  it('el vacío de propuestas describe con una clave real de i18n', () => {
    events = [];
    render(<PlansPage />);
    fireEvent.click(screen.getByText('plans.tabs.proposals'));
    expect(mockT).toHaveBeenCalledWith('proposals.emptyDescription');
  });

  describe('llegar desde una notificación', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      search = '?eventId=e1';
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('lleva el foco a la quedada y la resalta un rato', () => {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;

      render(<PlansPage />);
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
      expect(document.getElementById('event-e1')?.className).toContain('ring-primary');

      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(document.getElementById('event-e1')?.className).not.toContain('ring-primary');
    });

    it('abre la pestaña de propuestas y resalta la propuesta del enlace', () => {
      // new_proposal / proposal_voted caían en Planes con la pestaña de Quedadas
      // delante: la propuesta ni siquiera estaba en pantalla.
      search = '?proposalId=p1';
      proposals = [prop('p1', 'open')];
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;

      render(<PlansPage />);
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
      expect(document.getElementById('proposal-p1')?.className).toContain('ring-primary');

      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(document.getElementById('proposal-p1')?.className).not.toContain('ring-primary');
    });

    it('despliega las cerradas para llegar a una propuesta ya convertida', () => {
      search = '?proposalId=p9';
      proposals = [prop('p1', 'open'), prop('p9', 'converted')];
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;

      render(<PlansPage />);
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(document.getElementById('proposal-p9')).not.toBeNull();
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    });

    it('despliega las pasadas y llega igualmente a una quedada vieja', () => {
      // Abrir la sección de pasadas vuelve a lanzar el efecto: la limpieza no puede
      // dejar el scroll por el camino.
      search = '?eventId=e0';
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;

      render(<PlansPage />);
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    });

    it('al desmontar no deja temporizadores de scroll colgando', () => {
      const { unmount } = render(<PlansPage />);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });

    it('desmontar tras el scroll tampoco deja vivo el temporizador del resalte', () => {
      Element.prototype.scrollIntoView = vi.fn();

      const { unmount } = render(<PlansPage />);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
