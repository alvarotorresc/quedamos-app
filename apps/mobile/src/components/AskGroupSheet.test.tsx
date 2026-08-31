import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AskGroupSheet } from './AskGroupSheet';

// IonModal is a Stencil web component that never presents under jsdom (see
// CreateEventModal.test.tsx) — render children directly when isOpen, like that file does.
vi.mock('@ionic/react', () => ({
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="ion-modal">{children}</div> : null,
}));

// Mock useCreatePoll (../hooks/usePolls) — the only piece of business logic this sheet drives.
const createPollMock = vi.fn();
let createPollPending = false;
vi.mock('../hooks/usePolls', () => ({
  useCreatePoll: () => ({ mutateAsync: createPollMock, isPending: createPollPending }),
}));

// Mock useToast (../hooks/useToast) — asserts the 409 (duplicate poll) path surfaces the
// dedicated copy instead of the generic error toast, and that a silenced anti-spam push
// (I3) surfaces its own informative (non-error) toast.
const showErrorMock = vi.fn();
const showInfoMock = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: showErrorMock, showInfo: showInfoMock }),
}));

const DAY = new Date('2026-02-13T00:00:00');

function renderSheet(overrides: Partial<Parameters<typeof AskGroupSheet>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <AskGroupSheet isOpen groupId="group-1" day={DAY} onClose={onClose} {...overrides} />,
  );
  return { onClose };
}

describe('AskGroupSheet', () => {
  beforeEach(() => {
    createPollPending = false;
  });

  it('no pinta nada si isOpen es false', () => {
    renderSheet({ isOpen: false });
    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
  });

  it('por defecto pregunta por el día completo (sin franja)', async () => {
    createPollMock.mockResolvedValueOnce({ notified: true });
    const { onClose } = renderSheet();

    fireEvent.click(screen.getByText('calendar.askAction'));

    expect(createPollMock).toHaveBeenCalledWith({ date: '2026-02-13' });
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(showInfoMock).not.toHaveBeenCalled();
  });

  it('elegir «Tarde» y preguntar crea el sondeo con esa franja', async () => {
    createPollMock.mockResolvedValueOnce({ notified: true });
    const { onClose } = renderSheet();

    fireEvent.click(screen.getByText('calendar.availability.afternoon'));
    fireEvent.click(screen.getByText('calendar.askAction'));

    expect(createPollMock).toHaveBeenCalledWith({ date: '2026-02-13', slot: 'Tarde' });
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('cuando el anti-spam silenció la push (notified=false) avisa con un toast informativo, no de error', async () => {
    createPollMock.mockResolvedValueOnce({ notified: false });
    const { onClose } = renderSheet();

    fireEvent.click(screen.getByText('calendar.askAction'));

    await vi.waitFor(() => expect(showInfoMock).toHaveBeenCalledWith('calendar.askNotNotified'));
    expect(showErrorMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('un 409 (ya hay sondeo abierto) muestra el toast calendar.askDuplicate y no cierra', async () => {
    createPollMock.mockRejectedValueOnce(new Error('An open poll already exists for this day'));
    const { onClose } = renderSheet();

    fireEvent.click(screen.getByText('calendar.askAction'));

    await vi.waitFor(() => expect(showErrorMock).toHaveBeenCalledWith('calendar.askDuplicate'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('un error inesperado muestra el toast genérico', async () => {
    createPollMock.mockRejectedValueOnce(new Error('network down'));
    renderSheet();

    fireEvent.click(screen.getByText('calendar.askAction'));

    await vi.waitFor(() => expect(showErrorMock).toHaveBeenCalledWith('common.unexpectedError'));
  });
});
