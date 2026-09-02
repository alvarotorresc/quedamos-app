import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventCard } from './EventCard';
import type { Event } from '../services/events';

// Mock hooks
const mockMutate = vi.fn();
vi.mock('../hooks/useEvents', () => ({
  useRespondEvent: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

// Mock auth store — default: user-1
let mockUserId = 'user-1';
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { id: string } }) => unknown) =>
    selector({ user: { id: mockUserId } }),
  ),
}));

// Invite link the shareable card links back to — mutable per test via `mockInvite`.
let mockInvite: { inviteUrl: string } | undefined;
vi.mock('../hooks/useGroups', () => ({
  useGroupInvite: () => ({ data: mockInvite }),
}));

const mockShowError = vi.fn();
const mockShowInfo = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: vi.fn(), showInfo: mockShowInfo }),
}));

const mockTrack = vi.fn();
vi.mock('../hooks/useAnalytics', () => ({
  useAnalytics: () => ({ track: mockTrack }),
}));

const mockRenderTarjetaSellada = vi.fn();
vi.mock('../lib/tarjeta', () => ({
  renderTarjetaSellada: (...args: unknown[]) => mockRenderTarjetaSellada(...args),
}));

const mockShareTarjeta = vi.fn();
vi.mock('../lib/share-tarjeta', () => ({
  shareTarjeta: (...args: unknown[]) => mockShareTarjeta(...args),
}));

// Mock react-i18next locally (overrides the global setup.ts mock for this file) so we can
// assert on the exact key + interpolation params passed to t(), not just the rendered key text.
const mockT = vi.fn((key: string) => key);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
    i18n: { language: 'es', changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Mock Ionic
vi.mock('@ionic/react', () => ({
  IonSpinner: ({ className }: { className?: string }) => (
    <span data-testid="spinner" className={className} />
  ),
}));

// Mock react-icons
vi.mock('react-icons/hi2', () => ({
  HiOutlineMapPin: () => <span data-testid="icon-map" />,
  HiOutlineClock: () => <span data-testid="icon-clock" />,
  HiOutlinePencil: () => <span data-testid="icon-pencil" />,
  HiOutlineVideoCamera: () => <span data-testid="icon-video" />,
  HiOutlineArrowDownTray: () => <span data-testid="icon-download" />,
  HiOutlineShare: () => <span data-testid="icon-share" />,
  HiOutlineCalendar: () => <span data-testid="icon-calendar" />,
}));

// Mock ics-utils
vi.mock('../lib/ics-utils', () => ({
  downloadICS: vi.fn(() => Promise.resolve()),
}));

// Mock WeatherWidget
vi.mock('./WeatherWidget', () => ({
  WeatherBadge: () => <span data-testid="weather-badge" />,
  getWeatherIcon: () => '☀️',
  getWeatherDescKey: () => 'weather.desc.clear',
}));

// Helpers

const CURRENT_USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const CREATOR_ID = 'user-3';

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    groupId: 'group-1',
    title: 'Cena en el centro',
    date: '2026-04-15',
    status: 'pending',
    isOnline: false,
    meetingUrl: undefined,
    attendees: [],
    createdBy: { id: CREATOR_ID, name: 'Creator' },
    ...overrides,
  };
}

function createAttendee(
  userId: string,
  status: 'pending' | 'confirmed' | 'declined',
  name = 'User',
) {
  return {
    userId,
    status,
    user: { id: userId, name, avatarEmoji: '😊' },
  };
}

const defaultProps = {
  groupId: 'group-1',
  memberColorMap: new Map<string, string>([
    [CURRENT_USER_ID, '#60A5FA'],
    [OTHER_USER_ID, '#F59E0B'],
    [CREATOR_ID, '#34D399'],
  ]),
};

describe('EventCard', () => {
  beforeEach(() => {
    mockUserId = CURRENT_USER_ID;
    vi.clearAllMocks();
    mockInvite = { inviteUrl: 'https://quedamos.app/i/ABC123' };
    mockRenderTarjetaSellada.mockReset().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    mockShareTarjeta.mockReset().mockResolvedValue({ shared: true });
  });

  // --- Test 1: Invited user with pending status sees confirm/decline buttons ---

  it('should show confirm and decline buttons when user is invited with pending status', () => {
    const event = createEvent({
      attendees: [
        createAttendee(CURRENT_USER_ID, 'pending', 'Alvaro'),
        createAttendee(OTHER_USER_ID, 'confirmed', 'Misa'),
      ],
    });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.getByText('plans.confirm')).toBeInTheDocument();
    expect(screen.getByText('plans.decline')).toBeInTheDocument();
  });

  // --- Test 2: Non-invited user does NOT see confirm/decline buttons ---

  it('should not show confirm or decline buttons when user is not in attendees', () => {
    const event = createEvent({
      attendees: [
        createAttendee(OTHER_USER_ID, 'pending', 'Misa'),
        createAttendee(CREATOR_ID, 'confirmed', 'Creator'),
      ],
    });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.queryByText('plans.confirm')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.decline')).not.toBeInTheDocument();
  });

  // --- Test 3: Invited user with confirmed status sees status badge, NOT pending buttons ---

  it('should show confirmed status button and not show pending buttons when user has confirmed', () => {
    const event = createEvent({
      attendees: [
        createAttendee(CURRENT_USER_ID, 'confirmed', 'Alvaro'),
        createAttendee(OTHER_USER_ID, 'pending', 'Misa'),
      ],
    });

    render(<EventCard event={event} {...defaultProps} />);

    // Should NOT see the pending confirm/decline buttons
    expect(screen.queryByText('plans.confirm')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.decline')).not.toBeInTheDocument();

    // Should see the confirmed status text
    expect(screen.getByText('plans.youConfirmed')).toBeInTheDocument();
  });

  // --- Additional edge case tests ---

  it('should not show respond buttons when user is not invited and event has no attendees', () => {
    const event = createEvent({
      attendees: [],
    });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.queryByText('plans.confirm')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.decline')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.youConfirmed')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.youDeclined')).not.toBeInTheDocument();
  });

  it('should show declined status button when user has declined', () => {
    const event = createEvent({
      attendees: [createAttendee(CURRENT_USER_ID, 'declined', 'Alvaro')],
    });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.queryByText('plans.confirm')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.decline')).not.toBeInTheDocument();
    expect(screen.getByText('plans.youDeclined')).toBeInTheDocument();
  });

  it('should not show respond buttons when event is cancelled even if user is pending', () => {
    const event = createEvent({
      status: 'cancelled',
      attendees: [createAttendee(CURRENT_USER_ID, 'pending', 'Alvaro')],
    });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.queryByText('plans.confirm')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.decline')).not.toBeInTheDocument();
  });

  it('should render event title and date', () => {
    const event = createEvent({ title: 'Partido de padel' });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.getByText('Partido de padel')).toBeInTheDocument();
  });

  it('should show attendee counts via the attendee ring and going-count line', () => {
    const event = createEvent({
      attendees: [
        createAttendee(CURRENT_USER_ID, 'confirmed', 'Alvaro'),
        createAttendee(OTHER_USER_ID, 'confirmed', 'Misa'),
        createAttendee(CREATOR_ID, 'declined', 'Creator'),
      ],
    });

    render(<EventCard event={event} {...defaultProps} />);

    // Ring: 1 base track circle + 1 arc per confirmed member (2 confirmed of 3 members)
    const ring = screen.getByTestId('attendee-ring');
    expect(ring.querySelectorAll('circle')).toHaveLength(3);

    // Going-count line uses the new i18n key (mocked t() returns the key itself)
    expect(screen.getByText('plans.goingCount')).toBeInTheDocument();
  });

  it('should compute the going-count line against invited attendees, not the whole group', () => {
    // Group has 4 members, but only 2 (Alvaro, Misa) are invited to this event and both
    // confirmed. missing must be 0 (invite-list-relative), not 2 (full-group-relative).
    const fourMemberColorMap = new Map<string, string>([
      [CURRENT_USER_ID, '#60A5FA'],
      [OTHER_USER_ID, '#F59E0B'],
      [CREATOR_ID, '#34D399'],
      ['user-4', '#A78BFA'],
    ]);
    const event = createEvent({
      attendees: [
        createAttendee(CURRENT_USER_ID, 'confirmed', 'Alvaro'),
        createAttendee(OTHER_USER_ID, 'confirmed', 'Misa'),
      ],
    });

    render(<EventCard event={event} groupId="group-1" memberColorMap={fourMemberColorMap} />);

    expect(mockT).toHaveBeenCalledWith('plans.goingCount', { confirmed: 2, missing: 0 });
  });

  it('should render an attendee ring in the header', () => {
    const event = createEvent();

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.getByTestId('attendee-ring')).toBeInTheDocument();
  });

  it('should show the confirmed status in a bg-success badge', () => {
    const event = createEvent({ status: 'confirmed' });

    render(<EventCard event={event} {...defaultProps} />);

    const badge = screen.getByText('plans.status.confirmed');
    expect(badge.className).toContain('bg-success');
  });

  it('should overlay a check mark on the ring when the event is confirmed', () => {
    const event = createEvent({ status: 'confirmed' });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.getByTestId('attendee-ring-check')).toBeInTheDocument();
  });

  it('should not overlay a check mark on the ring when the event is not confirmed', () => {
    const event = createEvent({ status: 'pending' });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.queryByTestId('attendee-ring-check')).not.toBeInTheDocument();
  });

  it('should render as a hairline block instead of a card', () => {
    const event = createEvent();

    const { container } = render(<EventCard event={event} {...defaultProps} />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('border-t');
    expect(root.className).toContain('border-subtle');
    expect(root.className).not.toContain('bg-bg-light');
    expect(root.className).not.toContain('rounded-lg');
  });

  describe('online events', () => {
    it('should show video icon for online events', () => {
      const event = createEvent({ isOnline: true });

      render(<EventCard event={event} {...defaultProps} />);

      expect(screen.getAllByTestId('icon-video').length).toBeGreaterThan(0);
    });

    it('should show meeting link for online events with meetingUrl', () => {
      const event = createEvent({
        isOnline: true,
        meetingUrl: 'https://meet.google.com/abc',
      });

      render(<EventCard event={event} {...defaultProps} />);

      expect(screen.getByText('online.joinMeeting')).toBeInTheDocument();
      const link = screen.getByText('online.joinMeeting').closest('a');
      expect(link).toHaveAttribute('href', 'https://meet.google.com/abc');
    });

    it('should not show weather for online events', () => {
      const event = createEvent({ isOnline: true });
      const weather = [
        {
          city: 'Madrid',
          date: '2026-12-01',
          weatherCode: 0,
          tempMax: 25,
          tempMin: 15,
          description: 'Clear sky',
        },
      ];

      render(<EventCard event={event} {...defaultProps} weather={weather} />);

      expect(screen.queryByTestId('weather-badge')).not.toBeInTheDocument();
    });

    it('should show location for presencial events', () => {
      const event = createEvent({
        isOnline: false,
        location: 'Retiro Park',
      });

      render(<EventCard event={event} {...defaultProps} />);

      expect(screen.getByText('Retiro Park')).toBeInTheDocument();
    });
  });

  describe('compartir la tarjeta sellada', () => {
    it('muestra el botón Compartir solo cuando el evento está confirmado', () => {
      const confirmedEvent = createEvent({ status: 'confirmed' });
      const { rerender } = render(<EventCard event={confirmedEvent} {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'group.share' })).toBeInTheDocument();

      const pendingEvent = createEvent({ status: 'pending' });
      rerender(<EventCard event={pendingEvent} {...defaultProps} />);
      expect(screen.queryByRole('button', { name: 'group.share' })).not.toBeInTheDocument();
    });

    it('al pulsar Compartir renderiza la tarjeta sellada y la comparte con el blob y el inviteUrl', async () => {
      const blob = new Blob(['png'], { type: 'image/png' });
      mockRenderTarjetaSellada.mockResolvedValue(blob);
      const event = createEvent({ status: 'confirmed', title: 'Cena en el centro' });

      render(<EventCard event={event} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      await waitFor(() => expect(mockShareTarjeta).toHaveBeenCalledOnce());
      const call = mockShareTarjeta.mock.calls[0][0];
      expect(call.blob).toBe(blob);
      expect(call.inviteUrl).toBe('https://quedamos.app/i/ABC123');
      expect(call.filename).toBe('quedamos-tarjeta.png');
      expect(call.showInfo).toBe(mockShowInfo);

      const opts = mockRenderTarjetaSellada.mock.calls[0][0];
      expect(opts.plan).toBe('Cena en el centro');
      // Sin adjuntos confirmados en el evento, cae al grupo entero (fallback de seguridad).
      expect(opts.memberColors).toEqual(['#60A5FA', '#F59E0B', '#34D399']);
    });

    it('usa share.cardSellada como título de la tarjeta sellada, no calendar.letsMeet', async () => {
      const event = createEvent({ status: 'confirmed' });

      render(<EventCard event={event} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      await waitFor(() => expect(mockRenderTarjetaSellada).toHaveBeenCalledOnce());
      const opts = mockRenderTarjetaSellada.mock.calls[0][0];
      expect(opts.titulo).toBe('share.cardSellada');
    });

    it('pasa el inviteUrl sin esquema como pie de la tarjeta', async () => {
      const event = createEvent({ status: 'confirmed' });

      render(<EventCard event={event} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      await waitFor(() => expect(mockRenderTarjetaSellada).toHaveBeenCalledOnce());
      const opts = mockRenderTarjetaSellada.mock.calls[0][0];
      expect(opts.pie).toBe('quedamos.app/i/ABC123');
    });

    it('la tarjeta sellada solo pinta a quienes confirmaron asistencia, en orden de slot', async () => {
      const event = createEvent({
        status: 'confirmed',
        attendees: [
          createAttendee(CURRENT_USER_ID, 'confirmed', 'Alvaro'),
          createAttendee(CREATOR_ID, 'confirmed', 'Creator'),
          createAttendee(OTHER_USER_ID, 'declined', 'Misa'),
        ],
      });

      render(<EventCard event={event} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      await waitFor(() => expect(mockRenderTarjetaSellada).toHaveBeenCalledOnce());
      const opts = mockRenderTarjetaSellada.mock.calls[0][0];
      // CURRENT_USER_ID y CREATOR_ID confirmaron; OTHER_USER_ID rechazó y queda fuera.
      // El orden sigue siendo el de slot de memberColorMap, no el de attendees.
      expect(opts.memberColors).toEqual(['#60A5FA', '#34D399']);
    });

    it('interpola share.tarjetaSellada con el título y la fecha localizada del evento, sin hora si no hay', async () => {
      const event = createEvent({ status: 'confirmed', title: 'Cena en el centro', date: '2026-04-15' });

      render(<EventCard event={event} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      // Mock i18n.language es 'es' (ver mock arriba): "miércoles 15", sin franja horaria.
      await waitFor(() =>
        expect(mockT).toHaveBeenCalledWith('share.tarjetaSellada', {
          titulo: 'Cena en el centro',
          fechaHora: 'miércoles, 15 de abril',
        }),
      );
    });

    it('añade la franja horaria a fechaHora cuando el evento tiene hora', async () => {
      const event = createEvent({
        status: 'confirmed',
        title: 'Cena en el centro',
        date: '2026-04-15',
        time: '21:00:00',
      });

      render(<EventCard event={event} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      await waitFor(() =>
        expect(mockT).toHaveBeenCalledWith('share.tarjetaSellada', {
          titulo: 'Cena en el centro',
          fechaHora: 'miércoles, 15 de abril · 21:00',
        }),
      );

      await waitFor(() => expect(mockRenderTarjetaSellada).toHaveBeenCalledOnce());
      const opts = mockRenderTarjetaSellada.mock.calls[0][0];
      expect(opts.fechaHora).toBe('miércoles, 15 de abril · 21:00');
    });

    it('fallo del renderer muestra el toast errors.shareTarjetaFailed, sin lanzar', async () => {
      mockRenderTarjetaSellada.mockRejectedValue(new Error('boom'));
      const event = createEvent({ status: 'confirmed' });

      render(<EventCard event={event} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('errors.shareTarjetaFailed'));
      expect(mockShareTarjeta).not.toHaveBeenCalled();
    });

    it('la cancelación de shareTarjeta no muestra ningún toast de error ni trackea', async () => {
      mockShareTarjeta.mockResolvedValue({ shared: false }); // shareTarjeta resuelve { shared: false } al cancelar
      const event = createEvent({ status: 'confirmed' });

      render(<EventCard event={event} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      await waitFor(() => expect(mockShareTarjeta).toHaveBeenCalledOnce());
      expect(mockShowError).not.toHaveBeenCalled();
      expect(mockTrack).not.toHaveBeenCalled();
    });

    it('trackea share_tarjeta con momento sellada cuando shareTarjeta resuelve shared: true', async () => {
      mockShareTarjeta.mockResolvedValue({ shared: true });
      const event = createEvent({ status: 'confirmed' });

      render(<EventCard event={event} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      await waitFor(() =>
        expect(mockTrack).toHaveBeenCalledWith('share_tarjeta', { momento: 'sellada' }),
      );
    });

    it('sin inviteUrl cargado todavía, no renderiza ni comparte nada (no crashea)', async () => {
      mockInvite = undefined;
      const event = createEvent({ status: 'confirmed' });

      render(<EventCard event={event} {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      // Da tiempo a cualquier microtask pendiente antes de comprobar que no pasó nada.
      await Promise.resolve();
      expect(mockRenderTarjetaSellada).not.toHaveBeenCalled();
      expect(mockShareTarjeta).not.toHaveBeenCalled();
      expect(mockShowError).not.toHaveBeenCalled();
    });

    it('el doble click rápido en Compartir solo llama a shareTarjeta una vez (guard en vuelo)', async () => {
      let resolveShare!: (value: { shared: boolean }) => void;
      mockShareTarjeta.mockImplementation(
        () =>
          new Promise<{ shared: boolean }>((resolve) => {
            resolveShare = resolve;
          }),
      );
      const event = createEvent({ status: 'confirmed' });

      render(<EventCard event={event} {...defaultProps} />);

      // Re-query after each interaction instead of holding a stale node reference —
      // motion.button remounts its underlying DOM element on prop-driven re-renders.
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));
      fireEvent.click(screen.getByRole('button', { name: 'group.share' }));

      await waitFor(() => expect(mockShareTarjeta).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('button', { name: 'group.share' })).toBeDisabled();

      resolveShare({ shared: true });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'group.share' })).not.toBeDisabled(),
      );
      expect(mockShareTarjeta).toHaveBeenCalledTimes(1);
    });
  });
});

describe('EventCard · agenda y destacada', () => {
  it('pinta el día en una columna con el número grande y el día de la semana', () => {
    render(<EventCard event={createEvent({ date: '2026-04-15' })} {...defaultProps} />);
    const day = screen.getByTestId('event-day');
    expect(day).toHaveTextContent('15');
    expect(day).toHaveTextContent('MIÉ');
  });

  it('la ficha destacada lleva su etiqueta, la pastilla de calendario y compartir', () => {
    const event = createEvent({
      status: 'confirmed',
      attendees: [createAttendee(CURRENT_USER_ID, 'confirmed'), createAttendee(OTHER_USER_ID, 'confirmed')],
    });
    const { container } = render(<EventCard event={event} {...defaultProps} featured />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('rounded-lg');
    expect(root.className).toContain('bg-bg-light');
    expect(screen.getByText('plans.nextEvent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'plans.addToCalendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'group.share' })).toBeInTheDocument();
    expect(mockT).toHaveBeenCalledWith('plans.sealedWith', expect.objectContaining({ count: 2 }));
  });

  it('con una sola confirmación que no es la mía, "sellada" nombra a quien va', () => {
    const event = createEvent({
      status: 'confirmed',
      attendees: [createAttendee(OTHER_USER_ID, 'confirmed', 'Misa'), createAttendee(CURRENT_USER_ID, 'pending', 'Alvaro')],
    });
    render(<EventCard event={event} {...defaultProps} featured />);
    expect(mockT).toHaveBeenCalledWith('plans.sealedWith', { count: 1, name: 'Misa' });
  });

  it('si la única confirmación es la mía, dice que voy yo', () => {
    const event = createEvent({
      status: 'confirmed',
      attendees: [createAttendee(CURRENT_USER_ID, 'confirmed', 'Alvaro'), createAttendee(OTHER_USER_ID, 'pending', 'Misa')],
    });
    render(<EventCard event={event} {...defaultProps} featured />);
    expect(mockT).toHaveBeenCalledWith('plans.sealedWithYou');
  });

  it('sin destacar sigue siendo un bloque de lista con las acciones en iconos', () => {
    render(<EventCard event={createEvent({ status: 'confirmed' })} {...defaultProps} />);
    expect(screen.queryByText('plans.nextEvent')).toBeNull();
    expect(screen.queryByRole('button', { name: 'plans.addToCalendar' })).toBeNull();
    expect(screen.getByTestId('icon-download')).toBeInTheDocument();
  });
});
