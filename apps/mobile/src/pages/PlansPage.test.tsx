import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push: vi.fn(), replace: vi.fn() }),
  useLocation: () => ({ search: '' }),
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
vi.mock('../stores/group', () => ({
  useGroupStore: vi.fn((selector?: (s: { currentGroup: typeof GROUP; setCurrentGroup: () => void }) => unknown) => {
    const state = { currentGroup: GROUP, setCurrentGroup: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));
vi.mock('../hooks/useGroups', () => ({
  useGroups: () => ({ data: [GROUP], isLoading: false }),
  useGroup: () => ({ data: GROUP, isLoading: false }),
  useGroupInvite: () => ({ data: undefined }),
}));
vi.mock('../hooks/useProposals', () => ({
  useProposals: () => ({ data: [] }),
  useVoteProposal: () => ({ mutateAsync: vi.fn() }),
  useCloseProposal: () => ({ mutateAsync: vi.fn() }),
}));

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
});
