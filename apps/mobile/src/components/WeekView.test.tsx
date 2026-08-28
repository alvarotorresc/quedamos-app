import { render, screen } from '@testing-library/react';
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
});
