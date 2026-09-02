import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvailabilityModal } from './AvailabilityModal';
import { createWrapper } from '../test/test-utils';

// IonModal is a Stencil web component that never presents under jsdom (see
// CreateEventModal.test.tsx) — render children directly when isOpen, like that file does.
vi.mock('@ionic/react', () => ({
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="ion-modal">{children}</div> : null,
}));

// Mock useCreateAvailability/useDeleteAvailability (../hooks/useAvailability) — the only
// business logic this modal drives.
const createMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();
vi.mock('../hooks/useAvailability', () => ({
  useCreateAvailability: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useDeleteAvailability: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
}));

// Mock useToast (../hooks/useToast) — asserts a failed save/delete surfaces an error toast
// instead of leaving an unhandled promise rejection, and that the modal stays open.
const showErrorMock = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: showErrorMock, showSuccess: vi.fn(), showInfo: vi.fn() }),
}));

const SELECTED_DAY = new Date('2026-03-10T00:00:00');

describe('AvailabilityModal errors', () => {
  beforeEach(() => {
    createMutateAsync.mockReset();
    deleteMutateAsync.mockReset();
  });

  it('un fallo al guardar muestra el toast errors.saveAvailabilityFailed y no cierra el modal', async () => {
    createMutateAsync.mockRejectedValueOnce(new Error('network down'));
    const onClose = vi.fn();
    render(
      <AvailabilityModal isOpen onClose={onClose} selectedDay={SELECTED_DAY} groupId="g1" />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByText('calendar.availability.save'));

    await vi.waitFor(() =>
      expect(showErrorMock).toHaveBeenCalledWith('errors.saveAvailabilityFailed'),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('un fallo al eliminar muestra el toast errors.deleteAvailabilityFailed y no cierra el modal', async () => {
    deleteMutateAsync.mockRejectedValueOnce(new Error('network down'));
    const onClose = vi.fn();
    render(
      <AvailabilityModal
        isOpen
        onClose={onClose}
        selectedDay={SELECTED_DAY}
        groupId="g1"
        existingAvailability={{
          id: 'a1',
          userId: 'u1',
          groupId: 'g1',
          date: '2026-03-10',
          type: 'day',
        }}
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByText('calendar.availability.delete'));

    await vi.waitFor(() =>
      expect(showErrorMock).toHaveBeenCalledWith('errors.deleteAvailabilityFailed'),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('AvailabilityModal success', () => {
  beforeEach(() => {
    createMutateAsync.mockReset();
    deleteMutateAsync.mockReset();
    showErrorMock.mockReset();
  });

  it('guardar con éxito cierra el modal sin mostrar ningún toast de error', async () => {
    createMutateAsync.mockResolvedValueOnce({});
    const onClose = vi.fn();
    render(
      <AvailabilityModal isOpen onClose={onClose} selectedDay={SELECTED_DAY} groupId="g1" />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByText('calendar.availability.save'));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(showErrorMock).not.toHaveBeenCalled();
  });

  it('eliminar con éxito cierra el modal sin mostrar ningún toast de error', async () => {
    deleteMutateAsync.mockResolvedValueOnce({ success: true });
    const onClose = vi.fn();
    render(
      <AvailabilityModal
        isOpen
        onClose={onClose}
        selectedDay={SELECTED_DAY}
        groupId="g1"
        existingAvailability={{
          id: 'a1',
          userId: 'u1',
          groupId: 'g1',
          date: '2026-03-10',
          type: 'day',
        }}
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByText('calendar.availability.delete'));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(showErrorMock).not.toHaveBeenCalled();
  });
});
