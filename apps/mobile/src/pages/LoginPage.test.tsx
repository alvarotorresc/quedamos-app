import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from './LoginPage';
import { takePendingRedirect } from '../lib/pending-redirect';

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

// translateAuthError habla con la instancia real de i18next: se sustituye sólo esa
// traducción para no atar el test al copy, dejando viva la detección de "sin confirmar".
vi.mock('../lib/auth-errors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth-errors')>();
  return {
    ...actual,
    translateAuthError: (error: unknown) => `translated:${(error as Error).message}`,
  };
});

// El botón de reenvío tiene sus propios tests; aquí sólo importa que aparezca con el
// email tecleado (y lleva un toast de Ionic que este mock de @ionic/react no presenta).
vi.mock('../components/ResendConfirmation', () => ({
  ResendConfirmation: ({ email }: { email: string }) => <div data-testid="resend">{email}</div>,
}));

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

  it('ofrece reenviar el email cuando la cuenta está sin confirmar', async () => {
    signInMock.mockRejectedValueOnce(
      Object.assign(new Error('Email not confirmed'), { code: 'email_not_confirmed' }),
    );
    render(<LoginPage />);

    submitLogin();

    await waitFor(() => expect(screen.getByText('login.notConfirmed.title')).toBeInTheDocument());
    expect(screen.getByTestId('resend')).toHaveTextContent('a@b.com');
    expect(screen.queryByText('translated:Email not confirmed')).not.toBeInTheDocument();
  });

  it('deja el error genérico para el resto de fallos', async () => {
    signInMock.mockRejectedValueOnce(new Error('Invalid login credentials'));
    render(<LoginPage />);

    submitLogin();

    await waitFor(() =>
      expect(screen.getByText('translated:Invalid login credentials')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('resend')).not.toBeInTheDocument();
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

  it('aparca el destino: el email de confirmación abre la app sin el parámetro', () => {
    search = '?redirect=%2Fjoin%2F48213956';
    render(<LoginPage />);

    expect(takePendingRedirect()).toBe('/join/48213956');
  });

  it('sin destino no aparca nada', () => {
    render(<LoginPage />);

    expect(takePendingRedirect()).toBeNull();
  });

  it('un destino fuera de la app tampoco se aparca', () => {
    search = '?redirect=%2F%2Fevil.com';
    render(<LoginPage />);

    expect(takePendingRedirect()).toBeNull();
  });
});
