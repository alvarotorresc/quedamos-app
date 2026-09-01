import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditProposalModal } from './EditProposalModal';
import { createWrapper } from '../test/test-utils';
import type { Proposal } from '../services/proposals';

// IonModal is a Stencil web component that never presents under jsdom (see
// CreateEventModal.test.tsx) — render children directly when isOpen, like that file does.
vi.mock('@ionic/react', () => ({
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="ion-modal">{children}</div> : null,
}));

// Mock useUpdateProposal (../hooks/useProposals) so the error-toast test controls whether
// the mutation resolves or rejects without hitting the real API.
const updateProposalMutateAsync = vi.fn();
vi.mock('../hooks/useProposals', () => ({
  useUpdateProposal: () => ({ mutateAsync: updateProposalMutateAsync, isPending: false }),
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

describe('EditProposalModal errors', () => {
  beforeEach(() => {
    updateProposalMutateAsync.mockReset();
  });

  it('un fallo al guardar muestra el toast errors.updateProposalFailed y no cierra el modal', async () => {
    updateProposalMutateAsync.mockRejectedValueOnce(new Error('network down'));
    const onClose = vi.fn();
    render(
      <EditProposalModal isOpen onClose={onClose} groupId="g1" proposal={PROPOSAL} />,
      { wrapper: createWrapper() },
    );

    // Cambiamos el título para forzar un diff real: si no hay cambios, el
    // handler cierra el modal sin llamar a la mutación.
    fireEvent.change(screen.getByPlaceholderText('proposals.titlePlaceholder'), {
      target: { value: 'Cena renovada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'proposals.edit' }));

    await vi.waitFor(() =>
      expect(showErrorMock).toHaveBeenCalledWith('errors.updateProposalFailed'),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('guardar con éxito cierra el modal sin mostrar ningún toast de error', async () => {
    updateProposalMutateAsync.mockResolvedValueOnce({ ...PROPOSAL, title: 'Cena renovada' });
    const onClose = vi.fn();
    render(
      <EditProposalModal isOpen onClose={onClose} groupId="g1" proposal={PROPOSAL} />,
      { wrapper: createWrapper() },
    );

    fireEvent.change(screen.getByPlaceholderText('proposals.titlePlaceholder'), {
      target: { value: 'Cena renovada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'proposals.edit' }));

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(showErrorMock).not.toHaveBeenCalled();
    // Ancla el test al camino real de la mutación: sin esta aserción, el early
    // return por "sin cambios" (que también llama a onClose sin mostrar error)
    // haría pasar el test sin ejercitar runWithErrorToast en absoluto.
    expect(updateProposalMutateAsync).toHaveBeenCalledWith({
      proposalId: 'p1',
      data: { title: 'Cena renovada' },
    });
  });
});
