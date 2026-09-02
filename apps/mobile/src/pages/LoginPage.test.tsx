import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from './LoginPage';

// Los web components de Ionic no se presentan bajo jsdom: se pintan los hijos.
vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  IonContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const replaceMock = vi.fn();
let search = '';
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ replace: replaceMock, goBack: vi.fn() }),
  useLocation: () => ({ search }),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

// hCaptcha monta un iframe real: se sustituye por un ref que devuelve un token.
const resetCaptchaMock = vi.fn();
vi.mock('@hcaptcha/react-hcaptcha', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef((_props: Record<string, unknown>, ref) => {
      React.useImperativeHandle(ref, () => ({
        execute: () => Promise.resolve({ response: 'tok' }),
        resetCaptcha: resetCaptchaMock,
      }));
      return <div data-testid="captcha" />;
    }),
  };
});

vi.mock('../hooks/useAnalytics', () => ({ useScreenView: () => {} }));

const signInMock = vi.fn(() => Promise.resolve());
vi.mock('../stores/auth', () => ({
  useAuthStore: (selector: (s: { signIn: () => Promise<void> }) => unknown) =>
    selector({ signIn: signInMock }),
}));

function submitLogin() {
  fireEvent.change(screen.getByPlaceholderText('common.emailPlaceholder'), {
    target: { value: 'a@b.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('common.passwordPlaceholder'), {
    target: { value: 'secret' },
  });
  fireEvent.submit(screen.getByText('login.submit').closest('form') as HTMLFormElement);
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search = '';
  });

  it('los campos no anulan el foco visible global de index.css', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText('common.emailPlaceholder').className).not.toContain(
      'outline-none',
    );
    expect(screen.getByPlaceholderText('common.passwordPlaceholder').className).not.toContain(
      'outline-none',
    );
  });

  it('ofrece crear cuenta conservando el destino de la invitación', () => {
    search = '?redirect=%2Fjoin%2F48213956';
    render(<LoginPage />);
    expect(screen.getByText('login.register').closest('a')).toHaveAttribute(
      'href',
      '/register?redirect=%2Fjoin%2F48213956',
    );
  });

  it('sin destino, el enlace de registro va limpio', () => {
    render(<LoginPage />);
    expect(screen.getByText('login.register').closest('a')).toHaveAttribute('href', '/register');
  });

  it('un destino fuera de la app no viaja ni al registro ni al login', async () => {
    search = '?redirect=%2F%2Fevil.com';
    render(<LoginPage />);

    expect(screen.getByText('login.register').closest('a')).toHaveAttribute('href', '/register');

    submitLogin();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/tabs'));
  });

  it('entra al destino de la invitación tras iniciar sesión', async () => {
    search = '?redirect=%2Fjoin%2F48213956';
    render(<LoginPage />);

    submitLogin();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/join/48213956'));
  });
});
