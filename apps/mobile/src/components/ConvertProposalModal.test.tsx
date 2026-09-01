import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConvertProposalModal } from './ConvertProposalModal';
import { createWrapper } from '../test/test-utils';
import type { Proposal } from '../services/proposals';

// IonModal is a Stencil web component that never presents under jsdom (see
// CreateEventModal.test.tsx) — render children directly when isOpen, like that file does.
vi.mock('@ionic/react', () => ({
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="ion-modal">{children}</div> : null,
}));

// Mock useConvertProposal (../hooks/useProposals) so the error-toast test controls whether
// the mutation resolves or rejects without hitting the real API.
const convertProposalMutateAsync = vi.fn();
vi.mock('../hooks/useProposals', () => ({
  useConvertProposal: () => ({ mutateAsync: convertProposalMutateAsync, isPending: false }),
}));

// Mock useToast (../hooks/useToast) — useToast pulls in useIonToast from '@ionic/react',
// which the mock above replaces wholesale, so the real hook would crash under jsdom.
const showErrorMock = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: showErrorMock, showSuccess: vi.fn(), showInfo: vi.fn() }),
}));

const PROPOSAL: Proposal = {
  id: 'p1',
  groupId: 'g1',
  title: 'Cena',
  isOnline: false,
  proposedDate: '2026-04-10',
  status: 'open',
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: { id: 'u1', name: 'Álvaro' },
  votes: [],
};

describe('ConvertProposalModal errors', () => {
  beforeEach(() => {
    convertProposalMutateAsync.mockReset();
  });

  it('un fallo al convertir muestra el toast errors.convertProposalFailed y no cierra el modal', async () => {
    convertProposalMutateAsync.mockRejectedValueOnce(new Error('network down'));
    const onClose = vi.fn();
    render(
      <ConvertProposalModal isOpen onClose={onClose} groupId="g1" proposal={PROPOSAL} />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole('button', { name: 'proposals.convert' }));

    await vi.waitFor(() =>
      expect(showErrorMock).toHaveBeenCalledWith('errors.convertProposalFailed'),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('convertir con éxito cierra el modal sin mostrar ningún toast de error', async () => {
    convertProposalMutateAsync.mockResolvedValueOnce({ id: 'e1' });
    const onClose = vi.fn();
    render(
      <ConvertProposalModal isOpen onClose={onClose} groupId="g1" proposal={PROPOSAL} />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole('button', { name: 'proposals.convert' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(showErrorMock).not.toHaveBeenCalled();
  });
});

describe('ConvertProposalModal — fecha mínima en local, no UTC', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('con la hora del sistema pasada la medianoche UTC, el mínimo del selector de fecha es el día local, no el día UTC', () => {
    // Fijamos TZ explícitamente en vez de depender del huso horario ambiente del runner:
    // CI corre en ubuntu-latest (TZ=UTC), donde la fecha ISO y la fecha local coinciden y
    // este test pasaría sin ejercitar el bug. Europe/Madrid está en UTC+1 en marzo (antes
    // del cambio de horario), así que 2026-03-01T23:30:00Z ya es 2026-03-02 en local. El
    // bug usaba toISOString() (siempre UTC), que se habría quedado en 2026-03-01.
    vi.stubEnv('TZ', 'Europe/Madrid');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T23:30:00Z'));

    const { container } = render(
      <ConvertProposalModal isOpen onClose={vi.fn()} groupId="g1" proposal={null} />,
      { wrapper: createWrapper() },
    );

    const dateInput = container.querySelector('input[type="date"]');
    expect(dateInput).toHaveAttribute('min', '2026-03-02');
  });
});
