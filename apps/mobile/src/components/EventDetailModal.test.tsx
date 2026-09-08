import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

// B7: la hoja pasa de solo mirar a poder responder; el «voy / no voy» vive en
// useEventResponse, compartido con EventCard.
const mockRespond = vi.fn();
let responseState = {
  myStatus: 'pending' as 'pending' | 'confirmed' | 'declined',
  isInvited: true,
  isPending: true,
  isPastEvent: false,
  isCancelled: false,
  canRespond: true,
  isResponding: false,
  justConfirmed: false,
  respond: mockRespond,
};
vi.mock('../hooks/useEventResponse', () => ({
  useEventResponse: () => responseState,
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

const DEFAULT_RESPONSE = { ...responseState };

describe('EventDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responseState = { ...DEFAULT_RESPONSE, respond: mockRespond };
  });

  it('no pinta nada sin evento', () => {
    render(<EventDetailModal isOpen onClose={() => {}} event={null} />);
    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
  });

  it('muestra título, estado, lugar y asistentes por estado', () => {
    render(<EventDetailModal isOpen onClose={() => {}} event={EVENT} />);
    expect(screen.getByRole('heading', { name: 'Cena en Monachil' })).toBeInTheDocument();
    expect(screen.getByText('plans.status.confirmed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'El Chiquito' })).toBeInTheDocument();
    expect(screen.getByText('calendar.eventDetail.confirmed (1)')).toBeInTheDocument();
    expect(screen.getByText('calendar.eventDetail.pending (1)')).toBeInTheDocument();
    expect(screen.getByText('calendar.eventDetail.createdBy:Álvaro')).toBeInTheDocument();
  });

  // A15: las listas de asistentes son un recuento («Confirmados» / «Rechazados»),
  // no la acción que se ofrece en la ficha («Confirmar» / «Rechazar»).
  it('encabeza las listas de asistentes con el participio, no con el verbo de la acción', () => {
    render(
      <EventDetailModal
        isOpen
        onClose={() => {}}
        event={{
          ...EVENT,
          attendees: [
            ...EVENT.attendees,
            { userId: 'u3', status: 'declined', user: { id: 'u3', name: 'Noa', avatarEmoji: '😊' } },
          ],
        }}
      />,
    );
    expect(screen.getByText('calendar.eventDetail.confirmed (1)')).toBeInTheDocument();
    expect(screen.getByText('calendar.eventDetail.declined (1)')).toBeInTheDocument();
    expect(screen.queryByText(/^plans\.confirm \(/)).toBeNull();
    expect(screen.queryByText(/^plans\.decline \(/)).toBeNull();
  });

  describe('responder desde la hoja', () => {
    it('ofrece voy / no voy cuando aún no has respondido', () => {
      render(<EventDetailModal isOpen onClose={() => {}} event={EVENT} />);

      fireEvent.click(screen.getByRole('button', { name: 'plans.confirm' }));
      expect(mockRespond).toHaveBeenCalledWith('confirmed');

      fireEvent.click(screen.getByRole('button', { name: 'plans.decline' }));
      expect(mockRespond).toHaveBeenCalledWith('declined');
    });

    it('enseña tu respuesta y deja cambiarla de un toque', () => {
      responseState = { ...responseState, isPending: false, myStatus: 'confirmed' };
      render(<EventDetailModal isOpen onClose={() => {}} event={EVENT} />);

      expect(screen.queryByRole('button', { name: 'plans.confirm' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'plans.youConfirmed' }));
      expect(mockRespond).toHaveBeenCalledWith('declined');
    });

    it('desde «no voy» el toque te devuelve a «voy»', () => {
      responseState = { ...responseState, isPending: false, myStatus: 'declined' };
      render(<EventDetailModal isOpen onClose={() => {}} event={EVENT} />);

      fireEvent.click(screen.getByRole('button', { name: 'plans.youDeclined' }));
      expect(mockRespond).toHaveBeenCalledWith('confirmed');
    });

    it('no ofrece nada en una quedada cancelada', () => {
      responseState = { ...responseState, isCancelled: true, canRespond: false };
      render(
        <EventDetailModal isOpen onClose={() => {}} event={{ ...EVENT, status: 'cancelled' }} />,
      );

      expect(screen.queryByRole('button', { name: 'plans.confirm' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'plans.decline' })).toBeNull();
    });

    it('no ofrece nada en una quedada que ya pasó', () => {
      responseState = { ...responseState, isPastEvent: true, canRespond: false };
      render(<EventDetailModal isOpen onClose={() => {}} event={EVENT} />);

      expect(screen.queryByRole('button', { name: 'plans.confirm' })).toBeNull();
    });

    it('no ofrece nada a quien no está invitado', () => {
      responseState = { ...responseState, isInvited: false, isPending: false, canRespond: false };
      render(<EventDetailModal isOpen onClose={() => {}} event={EVENT} />);

      expect(screen.queryByRole('button', { name: 'plans.confirm' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'plans.youConfirmed' })).toBeNull();
    });

    it('bloquea los botones mientras la respuesta va en camino', () => {
      responseState = { ...responseState, isResponding: true };
      render(<EventDetailModal isOpen onClose={() => {}} event={EVENT} />);

      expect(screen.getByRole('button', { name: 'plans.confirm' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'plans.decline' })).toBeDisabled();
    });
  });
});
