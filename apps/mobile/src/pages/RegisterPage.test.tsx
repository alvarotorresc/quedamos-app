import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegisterPage from './RegisterPage';
import { takePendingRedirect } from '../lib/pending-redirect';

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

let search = '';
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ replace: vi.fn(), goBack: vi.fn() }),
  useLocation: () => ({ search }),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

// hCaptcha monta un iframe real: se sustituye por un ref que devuelve un token.
vi.mock('@hcaptcha/react-hcaptcha', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef((_props: Record<string, unknown>, ref) => {
      React.useImperativeHandle(ref, () => ({
        execute: () => Promise.resolve({ response: 'tok' }),
        resetCaptcha: vi.fn(),
      }));
      return <div data-testid="captcha" />;
    }),
  };
});

vi.mock('../hooks/useAnalytics', () => ({ useScreenView: () => {} }));

const signUpMock = vi.fn(() => Promise.resolve());
vi.mock('../stores/auth', () => ({
  useAuthStore: (selector: (s: { signUp: () => Promise<void> }) => unknown) =>
    selector({ signUp: signUpMock }),
}));

const VALID_PASSWORD = 'Quedamos2026!';

async function registerAndWaitForSuccess() {
  render(<RegisterPage />);
  fireEvent.change(screen.getByPlaceholderText('register.namePlaceholder'), {
    target: { value: 'Vera' },
  });
  fireEvent.change(screen.getByPlaceholderText('common.emailPlaceholder'), {
    target: { value: 'vera@example.com' },
  });
  const [password, confirm] = screen.getAllByPlaceholderText('common.passwordPlaceholder');
  fireEvent.change(password, { target: { value: VALID_PASSWORD } });
  fireEvent.change(confirm, { target: { value: VALID_PASSWORD } });
  fireEvent.submit(screen.getByText('register.submit').closest('form') as HTMLFormElement);

  await waitFor(() => expect(screen.getByText('register.success.title')).toBeInTheDocument());
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search = '';
  });

  it('tras registrarse, el enlace de entrar conserva el destino de la invitación', async () => {
    search = '?redirect=%2Fjoin%2F48213956';
    await registerAndWaitForSuccess();

    expect(screen.getByText('register.success.login').closest('a')).toHaveAttribute(
      'href',
      '/login?redirect=%2Fjoin%2F48213956',
    );
  });

  it('sin destino, el enlace de entrar va limpio', async () => {
    await registerAndWaitForSuccess();

    expect(screen.getByText('register.success.login').closest('a')).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('un destino fuera de la app no viaja al login', async () => {
    search = '?redirect=%2F%2Fevil.com';
    await registerAndWaitForSuccess();

    expect(screen.getByText('register.success.login').closest('a')).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('aparca el destino: el enlace del email de confirmación llega sin parámetro', async () => {
    search = '?redirect=%2Fjoin%2F48213956';
    await registerAndWaitForSuccess();

    expect(takePendingRedirect()).toBe('/join/48213956');
  });

  it('sin destino no aparca nada', async () => {
    await registerAndWaitForSuccess();

    expect(takePendingRedirect()).toBeNull();
  });
});
