import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeekView } from './WeekView';
import { formatDateKey, getWeekDays } from '../lib/date-utils';

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

const mockRenderTarjetaCerrada = vi.fn();
vi.mock('../lib/tarjeta', () => ({
  renderTarjetaCerrada: (...args: unknown[]) => mockRenderTarjetaCerrada(...args),
}));

const mockShareTarjeta = vi.fn();
vi.mock('../lib/share-tarjeta', () => ({
  shareTarjeta: (...args: unknown[]) => mockShareTarjeta(...args),
}));

function buildProps() {
  const week = getWeekDays(new Date(), 0);
  const bestKey = formatDateKey(week[4]);
  const availabilityByDate = new Map([
    [bestKey, [
      { userId: 'u1', type: 'day' }, { userId: 'u2', type: 'day' },
    ] as never[]],
  ]);
  return {
    groupId: 'group-1',
    weekOffset: 0, onWeekChange: vi.fn(),
    selectedDay: null, onSelectDay: vi.fn(),
    availabilityByDate,
    myAvailabilityByDate: new Map(),
    memberColorMap: new Map([['u1', '#60A5FA'], ['u2', '#F59E0B']]),
    totalMembers: 2,
    bestDayKey: bestKey, secondBestDayKey: null,
    onMarkAvailability: vi.fn(), onCreateEvent: vi.fn(), onViewDetail: vi.fn(),
  };
}

describe('WeekView rediseñada', () => {
  beforeEach(() => {
    mockInvite = { inviteUrl: 'https://quedamos.app/i/ABC123' };
    mockRenderTarjetaCerrada.mockReset().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    mockShareTarjeta.mockReset().mockResolvedValue({ shared: true });
    mockShowError.mockReset();
    mockShowInfo.mockReset();
    mockTrack.mockReset();
    mockT.mockClear();
  });

  it('pinta 7 filas de día', () => {
    render(<WeekView {...buildProps()} />);
    // el mejor día es panel, no fila
    expect(screen.getAllByTestId('day-row')).toHaveLength(6);
    expect(screen.getByTestId('best-day-panel')).toBeInTheDocument();
  });
  it('el mejor día con todos ofrece Quedamos y dispara onCreateEvent', () => {
    const props = buildProps();
    render(<WeekView {...props} />);
    screen.getByText('calendar.letsMeet').click();
    expect(props.onCreateEvent).toHaveBeenCalledOnce();
  });
  it('cuenta disponibles con la clave plural', () => {
    render(<WeekView {...buildProps()} />);
    expect(screen.getByText('calendar.allCan')).toBeInTheDocument();
  });
  it('el mejor día con una quedada ya creada se pinta como fila normal, no como panel', () => {
    const props = buildProps();
    const eventsByDate = new Map([
      [props.bestDayKey!, [{ id: 'e1', title: 'Cena', time: '21:00:00' }] as never[]],
    ]);
    render(<WeekView {...props} eventsByDate={eventsByDate} />);
    expect(screen.queryByTestId('best-day-panel')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('day-row')).toHaveLength(7);
    expect(screen.getByText(/Cena/)).toBeInTheDocument();
  });
  it('en la fila expandida ofrece el chip Preguntar cuando se pasa onAskGroup', () => {
    const props = buildProps();
    const week = getWeekDays(new Date(), 0);
    // week[6] = domingo, último día de la semana actual: nunca es pasado (hoy o futuro
    // dentro de la semana en curso), a diferencia de week[0] (lunes), que sí es pasado
    // cualquier día que no sea lunes — y el chip se oculta en días pasados (M2). Tampoco
    // vale week[4]: es el panel de mejor día, no una fila normal.
    const day = week[6];
    const onAskGroup = vi.fn<(day: Date) => void>();
    render(<WeekView {...props} selectedDay={day} onAskGroup={onAskGroup} />);
    fireEvent.click(screen.getByText('calendar.ask'));
    expect(onAskGroup).toHaveBeenCalledOnce();
    // Comparamos por clave de fecha: WeekView recalcula `new Date()` internamente,
    // así que el Date exacto puede diferir en milisegundos del `day` de este test.
    expect(formatDateKey(onAskGroup.mock.calls[0][0])).toBe(formatDateKey(day));
  });
  it('no pinta el chip Preguntar si no se pasa onAskGroup', () => {
    const props = buildProps();
    const week = getWeekDays(new Date(), 0);
    // week[6] (domingo): nunca es pasado dentro de la semana actual — ver comentario en
    // el test anterior.
    const day = week[6];
    render(<WeekView {...props} selectedDay={day} />);
    expect(screen.queryByText('calendar.ask')).not.toBeInTheDocument();
  });
  it('no pinta el chip Preguntar en un día pasado, aunque se pase onAskGroup (M2)', () => {
    const props = buildProps();
    // Semana completa anterior a hoy — cualquiera de sus días es pasado sin importar en
    // qué día de la semana se ejecute el test.
    const pastWeek = getWeekDays(new Date(), -1);
    const day = pastWeek[0];
    const onAskGroup = vi.fn<(day: Date) => void>();
    render(<WeekView {...props} weekOffset={-1} selectedDay={day} onAskGroup={onAskGroup} />);
    expect(screen.queryByText('calendar.ask')).not.toBeInTheDocument();
  });

  describe('compartir la tarjeta del mejor día', () => {
    it('muestra el botón Compartir dentro del panel de mejor día', () => {
      render(<WeekView {...buildProps()} />);
      const panel = screen.getByTestId('best-day-panel');
      expect(within(panel).getByText('group.share')).toBeInTheDocument();
    });

    it('no muestra Compartir en una fila normal (sin aro cerrado)', () => {
      const props = buildProps();
      const eventsByDate = new Map([
        [props.bestDayKey!, [{ id: 'e1', title: 'Cena', time: '21:00:00' }] as never[]],
      ]);
      render(<WeekView {...props} eventsByDate={eventsByDate} />);
      expect(screen.queryByText('group.share')).not.toBeInTheDocument();
    });

    it('al pulsar Compartir renderiza la tarjeta y la comparte con el blob y el inviteUrl', async () => {
      const blob = new Blob(['png'], { type: 'image/png' });
      mockRenderTarjetaCerrada.mockResolvedValue(blob);
      render(<WeekView {...buildProps()} />);

      fireEvent.click(screen.getByText('group.share'));

      await waitFor(() => expect(mockShareTarjeta).toHaveBeenCalledOnce());
      const call = mockShareTarjeta.mock.calls[0][0];
      expect(call.blob).toBe(blob);
      expect(call.inviteUrl).toBe('https://quedamos.app/i/ABC123');
      expect(call.filename).toBe('quedamos-tarjeta.png');
      expect(call.texto).toBe('share.tarjetaCerrada');
      expect(call.showInfo).toBe(mockShowInfo);
    });

    it('interpola share.tarjetaCerrada solo con fecha, sin count', async () => {
      render(<WeekView {...buildProps()} />);

      fireEvent.click(screen.getByText('group.share'));

      await waitFor(() => expect(mockT).toHaveBeenCalledWith('share.tarjetaCerrada', expect.any(Object)));
      const call = mockT.mock.calls.find(([key]) => key === 'share.tarjetaCerrada');
      expect(call?.[1]).toHaveProperty('fecha');
      expect(call?.[1]).not.toHaveProperty('count');
    });

    it('usa share.cardCerrada como título de la tarjeta cerrada, no calendar.bestDayQuestion', async () => {
      render(<WeekView {...buildProps()} />);

      fireEvent.click(screen.getByText('group.share'));

      await waitFor(() => expect(mockRenderTarjetaCerrada).toHaveBeenCalledOnce());
      const opts = mockRenderTarjetaCerrada.mock.calls[0][0];
      expect(opts.titulo).toBe('share.cardCerrada');
    });

    it('renderiza el aro con los colores de todos los miembros del grupo, en orden de slot', async () => {
      render(<WeekView {...buildProps()} />);

      fireEvent.click(screen.getByText('group.share'));

      await waitFor(() => expect(mockRenderTarjetaCerrada).toHaveBeenCalledOnce());
      const opts = mockRenderTarjetaCerrada.mock.calls[0][0];
      expect(opts.memberColors).toEqual(['#60A5FA', '#F59E0B']);
      expect(opts.theme).toBe('noche');
    });

    it('fallo del renderer muestra el toast errors.shareTarjetaFailed, sin lanzar', async () => {
      mockRenderTarjetaCerrada.mockRejectedValue(new Error('boom'));
      render(<WeekView {...buildProps()} />);

      fireEvent.click(screen.getByText('group.share'));

      await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('errors.shareTarjetaFailed'));
      expect(mockShareTarjeta).not.toHaveBeenCalled();
    });

    it('la cancelación de shareTarjeta no muestra ningún toast de error ni trackea', async () => {
      mockShareTarjeta.mockResolvedValue({ shared: false }); // shareTarjeta resuelve { shared: false } al cancelar
      render(<WeekView {...buildProps()} />);

      fireEvent.click(screen.getByText('group.share'));

      await waitFor(() => expect(mockShareTarjeta).toHaveBeenCalledOnce());
      expect(mockShowError).not.toHaveBeenCalled();
      expect(mockTrack).not.toHaveBeenCalled();
    });

    it('trackea share_tarjeta con momento cerrada cuando shareTarjeta resuelve shared: true', async () => {
      mockShareTarjeta.mockResolvedValue({ shared: true });
      render(<WeekView {...buildProps()} />);

      fireEvent.click(screen.getByText('group.share'));

      await waitFor(() =>
        expect(mockTrack).toHaveBeenCalledWith('share_tarjeta', { momento: 'cerrada' }),
      );
    });

    it('sin inviteUrl cargado todavía, no renderiza ni comparte nada (no crashea)', async () => {
      mockInvite = undefined;
      render(<WeekView {...buildProps()} />);

      fireEvent.click(screen.getByText('group.share'));

      // Da tiempo a cualquier microtask pendiente antes de comprobar que no pasó nada.
      await Promise.resolve();
      expect(mockRenderTarjetaCerrada).not.toHaveBeenCalled();
      expect(mockShareTarjeta).not.toHaveBeenCalled();
      expect(mockShowError).not.toHaveBeenCalled();
    });
  });
});
