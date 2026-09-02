import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditEventModal } from './EditEventModal';
import { createWrapper } from '../test/test-utils';
import type { Event } from '../services/events';

// IonModal is a Stencil web component that never presents under jsdom (see
// CreateEventModal.test.tsx) — render children directly when isOpen, like that file does.
vi.mock('@ionic/react', () => ({
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="ion-modal">{children}</div> : null,
}));

// Mock useUpdateEvent (../hooks/useEvents) so the error-toast test controls whether the
// mutation resolves or rejects without hitting the real API.
const updateEventMutateAsync = vi.fn();
vi.mock('../hooks/useEvents', () => ({
  useUpdateEvent: () => ({ mutateAsync: updateEventMutateAsync, isPending: false }),
}));

// Mock useToast (../hooks/useToast) — useToast pulls in useIonToast from '@ionic/react',
// which the mock above replaces wholesale, so the real hook would crash under jsdom.
const showErrorMock = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: showErrorMock, showSuccess: vi.fn(), showInfo: vi.fn() }),
}));

const EVENT: Event = {
  id: 'e1',
  groupId: 'g1',
  title: 'Cena',
  description: 'traer postre',
  location: 'Retiro',
  isOnline: false,
  date: '2026-04-10',
  time: '18:00',
  endTime: '20:00',
  status: 'pending',
  attendees: [],
  createdBy: { id: 'u1', name: 'Álvaro' },
};

describe('EditEventModal errors', () => {
  beforeEach(() => {
    updateEventMutateAsync.mockReset();
  });

  it('un fallo al editar muestra el toast errors.updateEventFailed y no cierra el modal', async () => {
    updateEventMutateAsync.mockRejectedValueOnce(new Error('network down'));
    const onClose = vi.fn();
    render(
      <EditEventModal isOpen onClose={onClose} groupId="g1" event={EVENT} />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole('button', { name: 'plans.edit.submit' }));

    await vi.waitFor(() =>
      expect(showErrorMock).toHaveBeenCalledWith('errors.updateEventFailed'),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('editar con éxito cierra el modal sin mostrar ningún toast de error', async () => {
    updateEventMutateAsync.mockResolvedValueOnce({ id: 'e1' });
    const onClose = vi.fn();
    render(
      <EditEventModal isOpen onClose={onClose} groupId="g1" event={EVENT} />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole('button', { name: 'plans.edit.submit' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(showErrorMock).not.toHaveBeenCalled();
  });
});

describe('EditEventModal — borrar campos envía null, no lo omite ni manda ""', () => {
  beforeEach(() => {
    updateEventMutateAsync.mockReset();
  });

  it('vaciar la ubicación y guardar envía location: null', async () => {
    updateEventMutateAsync.mockResolvedValueOnce({ id: 'e1' });
    render(
      <EditEventModal isOpen onClose={vi.fn()} groupId="g1" event={EVENT} />,
      { wrapper: createWrapper() },
    );

    const locationInput = screen.getByPlaceholderText('plans.create.locationPlaceholder');
    fireEvent.change(locationInput, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'plans.edit.submit' }));

    await waitFor(() => expect(updateEventMutateAsync).toHaveBeenCalledOnce());
    const call = updateEventMutateAsync.mock.calls[0][0] as { data: { location: unknown } };
    expect(call.data.location).toBeNull();
  });

  it('vaciar solo la hora de inicio también borra la hora de fin', async () => {
    updateEventMutateAsync.mockResolvedValueOnce({ id: 'e1' });
    render(
      <EditEventModal isOpen onClose={vi.fn()} groupId="g1" event={EVENT} />,
      { wrapper: createWrapper() },
    );

    const timeInput = screen.getByDisplayValue('18:00');
    fireEvent.change(timeInput, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'plans.edit.submit' }));

    await waitFor(() => expect(updateEventMutateAsync).toHaveBeenCalledOnce());
    const call = updateEventMutateAsync.mock.calls[0][0] as {
      data: { time: unknown; endTime: unknown };
    };
    expect(call.data.time).toBeNull();
    expect(call.data.endTime).toBeNull();
  });
});
