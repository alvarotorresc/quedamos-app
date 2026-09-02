import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

// IonModal es un web component de Stencil que nunca se presenta bajo jsdom:
// se sustituye por un div que pinta los hijos cuando isOpen y expone las props.
const modalProps = vi.fn();
vi.mock('@ionic/react', () => ({
  IonModal: (props: { isOpen: boolean; children: ReactNode }) => {
    modalProps(props);
    return props.isOpen ? <div data-testid="ion-modal">{props.children}</div> : null;
  },
}));

import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('no pinta nada cuando está cerrada', () => {
    render(
      <Sheet isOpen={false} onClose={() => {}}>
        <p>cuerpo</p>
      </Sheet>,
    );
    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
  });

  it('pinta título, subtítulo, cuerpo y pie cuando está abierta', () => {
    render(
      <Sheet isOpen onClose={() => {}} title="Disponibilidad" subtitle="viernes 5" footer={<button>Guardar</button>}>
        <p>cuerpo</p>
      </Sheet>,
    );
    expect(screen.getByRole('heading', { name: 'Disponibilidad' })).toBeInTheDocument();
    expect(screen.getByText('viernes 5')).toBeInTheDocument();
    expect(screen.getByText('cuerpo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });

  it('pinta headerEnd junto al título', () => {
    render(
      <Sheet isOpen onClose={() => {}} title="Cena" headerEnd={<span>Confirmada</span>}>
        <p>cuerpo</p>
      </Sheet>,
    );
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
  });

  it('usa el modal de alto automático: clase sheet y sin breakpoints', () => {
    render(
      <Sheet isOpen onClose={() => {}} className="extra">
        <p>cuerpo</p>
      </Sheet>,
    );
    const props = modalProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(String(props.className).split(' ')).toEqual(expect.arrayContaining(['sheet', 'extra']));
    expect(props.breakpoints).toBeUndefined();
    expect(props.initialBreakpoint).toBeUndefined();
  });

  it('avisa a onClose cuando el modal se cierra', () => {
    const onClose = vi.fn();
    render(
      <Sheet isOpen onClose={onClose}>
        <p>cuerpo</p>
      </Sheet>,
    );
    const props = modalProps.mock.calls.at(-1)?.[0] as { onDidDismiss: () => void };
    props.onDidDismiss();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
