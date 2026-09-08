import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { returnObjects?: boolean }) => (opts?.returnObjects ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'] : k),
    i18n: { language: 'es' },
  }),
}));

import { MonthView } from './MonthView';

describe('MonthView', () => {
  it('el botón de marcar disponibilidad del día seleccionado usa el primario del sistema', () => {
    render(
      <MonthView
        monthOffset={0}
        onMonthChange={() => {}}
        selectedDay={new Date()}
        onSelectDay={() => {}}
        availabilityByDate={new Map()}
        myAvailabilityByDate={new Map()}
        memberColorMap={new Map()}
        totalMembers={3}
        onMarkAvailability={() => {}}
        onCreateEvent={() => {}}
        onViewDetail={() => {}}
      />,
    );
    const btn = screen.getByRole('button', { name: 'calendar.available' });
    expect(btn.className).toContain('bg-primary-solid');
    expect(btn.className).not.toContain('bg-primary-dark');
  });

  // B8: preguntar al grupo solo se ofrecia en la vista Semana; el mes enseña el
  // mismo dia seleccionado y no tenia por donde preguntar.
  describe('preguntar al grupo', () => {
    const dayAfterTomorrow = () => {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      return d;
    };
    const yesterday = () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d;
    };

    const renderMonth = (
      selectedDay: Date | null,
      onAskGroup?: (day: Date) => void,
    ) =>
      render(
        <MonthView
          monthOffset={0}
          onMonthChange={() => {}}
          selectedDay={selectedDay}
          onSelectDay={() => {}}
          availabilityByDate={new Map()}
          myAvailabilityByDate={new Map()}
          memberColorMap={new Map()}
          totalMembers={3}
          onMarkAvailability={() => {}}
          onCreateEvent={() => {}}
          onViewDetail={() => {}}
          onAskGroup={onAskGroup}
        />,
      );

    it('ofrece preguntar en un dia futuro y avisa con ese dia', () => {
      const onAskGroup = vi.fn();
      const day = dayAfterTomorrow();
      renderMonth(day, onAskGroup);

      fireEvent.click(screen.getByRole('button', { name: 'calendar.ask' }));

      expect(onAskGroup).toHaveBeenCalledTimes(1);
      expect(onAskGroup.mock.calls[0][0]).toBe(day);
    });

    it('tambien lo ofrece hoy', () => {
      renderMonth(new Date(), vi.fn());
      expect(screen.getByRole('button', { name: 'calendar.ask' })).toBeInTheDocument();
    });

    it('no lo ofrece en un dia pasado: la pregunta seria invisible e inutil', () => {
      renderMonth(yesterday(), vi.fn());
      expect(screen.queryByRole('button', { name: 'calendar.ask' })).toBeNull();
    });

    it('no lo ofrece si la pantalla no pasa onAskGroup', () => {
      renderMonth(dayAfterTomorrow());
      expect(screen.queryByRole('button', { name: 'calendar.ask' })).toBeNull();
    });
  });
});
