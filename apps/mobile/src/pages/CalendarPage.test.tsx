import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CalendarPage from './CalendarPage';

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
vi.mock('../hooks/useAnalytics', () => ({ useScreenView: () => {}, useAnalytics: () => ({ track: vi.fn() }) }));
vi.mock('../hooks/useGroupSync', () => ({ useGroupSync: () => {} }));
vi.mock('../hooks/useMyColor', () => ({ useMyColor: () => '#60A5FA' }));
vi.mock('../hooks/useWeather', () => ({ useGroupWeather: () => ({ data: [] }) }));
vi.mock('../hooks/usePollDeepLink', () => ({
  usePollDeepLink: () => ({ focusPollId: null, presetAnswer: null, groupId: null, clear: vi.fn() }),
}));
vi.mock('../hooks/useAutoSelectGroup', () => ({ useAutoSelectGroup: () => {} }));
vi.mock('../hooks/useWidgetGroupsSync', () => ({ useWidgetGroupsSync: () => {} }));
vi.mock('../hooks/useAvailability', () => ({
  useAvailability: () => ({ data: [], isLoading: false }),
  useMyAvailability: () => ({ data: [] }),
}));
vi.mock('../hooks/useEvents', () => ({ useEvents: () => ({ data: [] }) }));
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector?: (s: { user: { id: string; name: string } }) => unknown) => {
    const state = { user: { id: 'u1', name: 'Vera' } };
    return selector ? selector(state) : state;
  }),
}));
const GROUP = { id: 'g1', name: 'La cuadrilla', emoji: '🏔️', createdById: 'u1', createdAt: '', members: [] };
let groupsList: (typeof GROUP)[] = [GROUP];
vi.mock('../stores/group', () => ({
  useGroupStore: vi.fn((selector?: (s: { currentGroup: typeof GROUP | null; setCurrentGroup: () => void }) => unknown) => {
    const state = { currentGroup: groupsList[0] ?? null, setCurrentGroup: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));
vi.mock('../hooks/useGroups', () => ({
  useGroups: () => ({ data: groupsList, isLoading: false }),
  useGroup: () => ({ data: groupsList[0], isLoading: false }),
}));
// Las vistas se prueban en sus propios tests; aquí solo importa qué offset reciben.
vi.mock('../components/WeekView', () => ({
  WeekView: ({ weekOffset, onWeekChange }: { weekOffset: number; onWeekChange: (o: number) => void }) => (
    <div>
      <span data-testid="week-offset">{weekOffset}</span>
      <button onClick={() => onWeekChange(weekOffset + 1)}>next-week</button>
    </div>
  ),
}));
vi.mock('../components/MonthView', () => ({
  MonthView: ({ monthOffset }: { monthOffset: number }) => <span data-testid="month-offset">{monthOffset}</span>,
}));
vi.mock('../components/ListView', () => ({ ListView: () => <div data-testid="list-view" /> }));
vi.mock('../components/MonthSummary', () => ({ MonthSummary: () => null }));
vi.mock('../components/AvailabilityModal', () => ({ AvailabilityModal: () => null }));
vi.mock('../components/AvailabilityDetailModal', () => ({ AvailabilityDetailModal: () => null }));
vi.mock('../components/CreateEventModal', () => ({ CreateEventModal: () => null }));
vi.mock('../components/EventDetailModal', () => ({ EventDetailModal: () => null }));
vi.mock('../components/AskGroupSheet', () => ({ AskGroupSheet: () => null }));
vi.mock('../components/MazoGate', () => ({ MazoGate: () => null }));

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groupsList = [GROUP];
  });

  it('sin grupos, el botón de ir a grupos usa el primario del sistema', () => {
    groupsList = [];
    render(<CalendarPage />);
    const btn = screen.getByRole('button', { name: 'calendar.goToGroups' });
    expect(btn.className).toContain('bg-primary-solid');
    expect(btn.className).not.toContain('bg-primary-dark');
  });

  it('cambiar de vista vuelve a la semana actual: el offset no se arrastra de una visita anterior', () => {
    render(<CalendarPage />);
    fireEvent.click(screen.getByText('next-week'));
    fireEvent.click(screen.getByText('next-week'));
    expect(screen.getByTestId('week-offset').textContent).toBe('2');

    fireEvent.click(screen.getByText('calendar.month'));
    expect(screen.getByTestId('month-offset').textContent).toBe('0');

    fireEvent.click(screen.getByText('calendar.week'));
    expect(screen.getByTestId('week-offset').textContent).toBe('0');
  });
});
