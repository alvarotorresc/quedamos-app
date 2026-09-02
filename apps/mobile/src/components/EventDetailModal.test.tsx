import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Event } from '../services/events';

// IonModal es un web component de Stencil que nunca se presenta bajo jsdom:
// se pintan los hijos directamente cuando isOpen (mismo patrón que AskGroupSheet).
vi.mock('@ionic/react', () => ({
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div data-testid="ion-modal">{children}</div> : null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: { name?: string }) => (opts?.name ? `${k}:${opts.name}` : k),
    i18n: { language: 'es' },
  }),
}));

import { EventDetailModal } from './EventDetailModal';

const EVENT: Event = {
  id: 'e1',
  groupId: 'g1',
  title: 'Cena en Monachil',
  location: 'El Chiquito',
  isOnline: false,
  date: '2026-09-05',
  time: '21:00:00',
  status: 'confirmed',
  createdBy: { id: 'u1', name: 'Álvaro' },
  attendees: [
    { userId: 'u1', status: 'confirmed', user: { id: 'u1', name: 'Álvaro', avatarEmoji: '😊' } },
    { userId: 'u2', status: 'pending', user: { id: 'u2', name: 'Marta', avatarEmoji: '😊' } },
  ],
};

describe('EventDetailModal', () => {
  it('no pinta nada sin evento', () => {
    render(<EventDetailModal isOpen onClose={() => {}} event={null} />);
    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
  });

  it('muestra título, estado, lugar y asistentes por estado', () => {
    render(<EventDetailModal isOpen onClose={() => {}} event={EVENT} />);
    expect(screen.getByRole('heading', { name: 'Cena en Monachil' })).toBeInTheDocument();
    expect(screen.getByText('plans.status.confirmed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'El Chiquito' })).toBeInTheDocument();
    expect(screen.getByText('plans.confirm (1)')).toBeInTheDocument();
    expect(screen.getByText('plans.status.pending (1)')).toBeInTheDocument();
    expect(screen.getByText('calendar.eventDetail.createdBy:Álvaro')).toBeInTheDocument();
  });
});
