import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PushPrimingSheet } from './PushPrimingSheet';
import type { PushPermissionValue } from '../stores/push-permission';

// IonModal never presents under jsdom: render the children when it is open.
vi.mock('@ionic/react', () => ({
  IonModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="ion-modal">{children}</div> : null,
}));

const SEEN_KEY = 'quedamos_push_priming_seen';

function renderSheet(permission: PushPermissionValue = 'prompt') {
  const onEnable = vi.fn(() => Promise.resolve());
  const view = render(<PushPrimingSheet permission={permission} onEnable={onEnable} />);
  return { onEnable, view };
}

describe('PushPrimingSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('explains the avisos before the system dialog when nobody has been asked yet', () => {
    renderSheet('prompt');

    expect(screen.getByText('push.priming.title')).toBeInTheDocument();
    expect(screen.getByText('push.priming.enable')).toBeInTheDocument();
  });

  it('stays out of the way once the permission is settled', () => {
    renderSheet('granted');

    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
  });

  it('does not ask a device that already answered the sheet', () => {
    localStorage.setItem(SEEN_KEY, '1');

    renderSheet('prompt');

    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
  });

  it('asks for the permission and closes when the user opts in', async () => {
    const { onEnable } = renderSheet('prompt');

    await act(async () => {
      fireEvent.click(screen.getByText('push.priming.enable'));
    });

    expect(onEnable).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
    expect(localStorage.getItem(SEEN_KEY)).toBe('1');
  });

  it('remembers a "ahora no" so it never nags again', () => {
    const { onEnable } = renderSheet('prompt');

    fireEvent.click(screen.getByText('push.priming.later'));

    expect(onEnable).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
    expect(localStorage.getItem(SEEN_KEY)).toBe('1');
  });

  it('closes itself when the permission stops being askable', () => {
    const onEnable = vi.fn(() => Promise.resolve());
    const { rerender } = render(
      <PushPrimingSheet permission="prompt" onEnable={onEnable} />,
    );
    expect(screen.getByTestId('ion-modal')).toBeInTheDocument();

    rerender(<PushPrimingSheet permission="denied" onEnable={onEnable} />);

    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
  });
});
