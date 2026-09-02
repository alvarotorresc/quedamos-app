import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotificationsSettingsPage from './NotificationsSettingsPage';
import { NOTIF_SECTIONS } from '../services/notification-preferences';

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonButtons: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonBackButton: () => <button type="button">back</button>,
  IonContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o && Object.keys(o).length ? `${k}:${Object.values(o).join(',')}` : k,
    i18n: { language: 'es' },
  }),
}));

const mutateMock = vi.fn();
vi.mock('../hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: () => ({ data: [{ type: 'event_declined', enabled: false }] }),
  useUpdateNotificationPreference: () => ({ mutate: mutateMock }),
}));
vi.mock('../hooks/useAnalytics', () => ({ useScreenView: () => {} }));
const showErrorMock = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: showErrorMock, showSuccess: vi.fn(), showInfo: vi.fn() }),
}));
vi.mock('../hooks/useMyColor', () => ({ useMyColor: () => '#60A5FA' }));

describe('NotificationsSettingsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cada tipo es un switch accesible con su estado', () => {
    render(<NotificationsSettingsPage />);
    const total = NOTIF_SECTIONS.flatMap((s) => s.types).length;
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(total);
    const off = screen.getByRole('switch', { name: 'profile.notifications.eventDeclined' });
    expect(off).toHaveAttribute('aria-checked', 'false');
    const on = screen.getByRole('switch', { name: 'profile.notifications.newEvent' });
    expect(on).toHaveAttribute('aria-checked', 'true');
    expect(on).toHaveStyle({ background: '#60A5FA' });
  });

  it('el subtítulo cuenta los activos', () => {
    render(<NotificationsSettingsPage />);
    const total = NOTIF_SECTIONS.flatMap((s) => s.types).length;
    expect(screen.getByText(`profile.notifications.subtitle:${total - 1},${total}`)).toBeInTheDocument();
  });

  it('pulsar un switch guarda el estado contrario', () => {
    render(<NotificationsSettingsPage />);
    fireEvent.click(screen.getByRole('switch', { name: 'profile.notifications.newEvent' }));
    expect(mutateMock).toHaveBeenCalledWith(
      { type: 'new_event', enabled: false },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it('si guardar falla, además de revertir avisa con un toast', () => {
    mutateMock.mockImplementation(
      (_vars: unknown, opts?: { onError?: (e: Error) => void }) =>
        opts?.onError?.(new Error('boom')),
    );
    render(<NotificationsSettingsPage />);
    fireEvent.click(screen.getByRole('switch', { name: 'profile.notifications.newEvent' }));
    expect(showErrorMock).toHaveBeenCalledWith('errors.updateNotificationPreferenceFailed');
  });
});
