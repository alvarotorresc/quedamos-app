import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateProposalModal } from './CreateProposalModal';
import { createWrapper } from '../test/test-utils';

// IonModal is a Stencil web component that never presents under jsdom (see
// CreateEventModal.test.tsx) — render children directly when isOpen, like that file does.
vi.mock('@ionic/react', () => ({
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="ion-modal">{children}</div> : null,
}));

// Mock useCreateProposal (../hooks/useProposals) so the error-toast test controls whether
// the mutation resolves or rejects without hitting the real API.
const createProposalMutateAsync = vi.fn();
vi.mock('../hooks/useProposals', () => ({
  useCreateProposal: () => ({ mutateAsync: createProposalMutateAsync, isPending: false }),
}));

// Mock useToast (../hooks/useToast) — useToast pulls in useIonToast from '@ionic/react',
// which the mock above replaces wholesale, so the real hook would crash under jsdom.
const showErrorMock = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: showErrorMock, showSuccess: vi.fn(), showInfo: vi.fn() }),
}));

describe('CreateProposalModal errors', () => {
  beforeEach(() => {
    createProposalMutateAsync.mockReset();
  });

  it('un fallo al crear muestra el toast errors.createProposalFailed y no cierra el modal', async () => {
    createProposalMutateAsync.mockRejectedValueOnce(new Error('network down'));
    const onClose = vi.fn();
    render(<CreateProposalModal isOpen onClose={onClose} groupId="g1" />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByPlaceholderText('proposals.titlePlaceholder'), {
      target: { value: 'Cena el viernes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'proposals.create' }));

    await vi.waitFor(() =>
      expect(showErrorMock).toHaveBeenCalledWith('errors.createProposalFailed'),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
