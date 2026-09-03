import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ApiError } from '../lib/api';
import { DeleteAccountSheet } from './DeleteAccountSheet';

// IonModal es un web component de Stencil que nunca se presenta bajo jsdom (ver
// Sheet.test.tsx): se pintan los hijos cuando isOpen.
vi.mock('@ionic/react', () => ({
  IonModal: (props: { isOpen: boolean; children: ReactNode }) =>
    props.isOpen ? <div data-testid="ion-modal">{props.children}</div> : null,
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      if (k === 'profile.deleteAccount.confirmWord') return 'ELIMINAR';
      return o && Object.keys(o).length ? `${k}:${Object.values(o).join(',')}` : k;
    },
  }),
}));

describe('DeleteAccountSheet', () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn<() => Promise<void>>();

  beforeEach(() => {
    vi.clearAllMocks();
    onConfirm.mockResolvedValue(undefined);
  });

  function renderSheet(isOpen = true) {
    return render(<DeleteAccountSheet isOpen={isOpen} onClose={onClose} onConfirm={onConfirm} />);
  }

  it('no pinta nada cuando está cerrada', () => {
    renderSheet(false);
    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
  });

  it('explica qué se borra y qué pasa con los grupos', () => {
    renderSheet();
    expect(screen.getByRole('heading', { name: 'profile.deleteAccount.title' })).toBeInTheDocument();
    expect(screen.getByText('profile.deleteAccount.bulletProfile')).toBeInTheDocument();
    expect(screen.getByText('profile.deleteAccount.bulletSoloGroups')).toBeInTheDocument();
    expect(screen.getByText('profile.deleteAccount.bulletFoundedGroups')).toBeInTheDocument();
    expect(screen.getByText('profile.deleteAccount.bulletCreatedContent')).toBeInTheDocument();
    expect(screen.getByText('profile.deleteAccount.typeToConfirm:ELIMINAR')).toBeInTheDocument();
  });

  it('solo habilita el botón cuando se escribe la palabra, sin distinguir mayúsculas', () => {
    renderSheet();
    // El mock de framer-motion vuelve a montar el botón en cada render: se consulta cada vez.
    const confirm = () => screen.getByRole('button', { name: 'profile.deleteAccount.confirm' });
    const input = screen.getByLabelText('profile.deleteAccount.typeToConfirm:ELIMINAR');
    expect(confirm()).toBeDisabled();

    fireEvent.change(input, { target: { value: 'ELIMIN' } });
    expect(confirm()).toBeDisabled();

    fireEvent.change(input, { target: { value: ' eliminar ' } });
    expect(confirm()).toBeEnabled();

    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancelar cierra la hoja y olvida lo escrito', () => {
    renderSheet();
    const input = screen.getByLabelText('profile.deleteAccount.typeToConfirm:ELIMINAR');
    fireEvent.change(input, { target: { value: 'ELIMINAR' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('');
  });

  it('un 503 explica que el borrado no está disponible y deja reintentar', async () => {
    onConfirm.mockRejectedValueOnce(new ApiError('Account deletion is not available', 503));
    renderSheet();
    fireEvent.change(screen.getByLabelText('profile.deleteAccount.typeToConfirm:ELIMINAR'), {
      target: { value: 'ELIMINAR' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'profile.deleteAccount.confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('profile.deleteAccount.unavailable');
    expect(screen.getByRole('button', { name: 'profile.deleteAccount.confirm' })).toBeEnabled();
  });

  it('cualquier otro fallo muestra el error genérico', async () => {
    onConfirm.mockRejectedValueOnce(new Error('network'));
    renderSheet();
    fireEvent.change(screen.getByLabelText('profile.deleteAccount.typeToConfirm:ELIMINAR'), {
      target: { value: 'ELIMINAR' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'profile.deleteAccount.confirm' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('profile.deleteAccount.error');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'profile.deleteAccount.confirm' })).toBeEnabled(),
    );
  });
});
