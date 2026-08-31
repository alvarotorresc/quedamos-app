import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WeekView } from './WeekView';
import { formatDateKey, getWeekDays } from '../lib/date-utils';

function buildProps() {
  const week = getWeekDays(new Date(), 0);
  const bestKey = formatDateKey(week[4]);
  const availabilityByDate = new Map([
    [bestKey, [
      { userId: 'u1', type: 'day' }, { userId: 'u2', type: 'day' },
    ] as never[]],
  ]);
  return {
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
    const day = week[0]; // fila normal, no el panel de mejor día (week[4])
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
    const day = week[0];
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
});
