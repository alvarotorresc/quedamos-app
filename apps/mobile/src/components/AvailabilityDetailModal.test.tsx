import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Availability } from '../services/availability';

// IonModal es un web component de Stencil que nunca se presenta bajo jsdom:
// se pintan los hijos directamente cuando isOpen (mismo patrón que AskGroupSheet).
vi.mock('@ionic/react', () => ({
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div data-testid="ion-modal">{children}</div> : null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}));

import { AvailabilityDetailModal } from './AvailabilityDetailModal';

const DAY = new Date('2026-09-05T00:00:00');
const avail = (id: string, name: string): Availability => ({
  id,
  userId: `u-${id}`,
  groupId: 'g1',
  date: '2026-09-05',
  type: 'day',
  user: { id: `u-${id}`, name, avatarEmoji: '😊' },
});

describe('AvailabilityDetailModal', () => {
  it('lista a quien puede ese día', () => {
    render(
      <AvailabilityDetailModal
        isOpen
        onClose={() => {}}
        selectedDay={DAY}
        availabilities={[avail('1', 'Sara López'), avail('2', 'Juan Ruiz')]}
        memberColorMap={new Map()}
        onMarkAvailability={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'calendar.availabilityDetail.title' })).toBeInTheDocument();
    expect(screen.getByText('Sara López')).toBeInTheDocument();
    expect(screen.getByText('Juan Ruiz')).toBeInTheDocument();
  });

  it('el botón de marcar cierra la hoja y avisa para abrir la de disponibilidad', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onMark = vi.fn();
    render(
      <AvailabilityDetailModal
        isOpen
        onClose={onClose}
        selectedDay={DAY}
        availabilities={[]}
        memberColorMap={new Map()}
        onMarkAvailability={onMark}
      />,
    );
    expect(screen.getByText('calendar.noAvailability')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'calendar.markAvailable' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    expect(onMark).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('el botón de marcar usa el primario del sistema y no el azul heredado', () => {
    render(
      <AvailabilityDetailModal
        isOpen
        onClose={() => {}}
        selectedDay={DAY}
        availabilities={[]}
        memberColorMap={new Map()}
        onMarkAvailability={() => {}}
      />,
    );
    const btn = screen.getByRole('button', { name: 'calendar.markAvailable' });
    expect(btn.className).toContain('bg-primary-solid');
    expect(btn.className).not.toContain('bg-primary-dark');
  });
});
