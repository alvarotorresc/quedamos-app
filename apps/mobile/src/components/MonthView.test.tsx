import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
});
