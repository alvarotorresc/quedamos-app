import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import App, { PendingRedirectGate } from './App';
import { navigateToDeepLink } from './lib/deep-link';
import { savePendingRedirect, takePendingRedirect } from './lib/pending-redirect';

// La navegación real (window.location.href) no se puede espiar en jsdom: se aísla en
// el helper y aquí se mockea sólo esa función, dejando viva la validación real.
vi.mock('./lib/deep-link', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/deep-link')>();
  return { ...actual, navigateToDeepLink: vi.fn() };
});

// Con isLoading a true, App se queda en el spinner: el efecto de deep links se
// registra igualmente y no hace falta montar el router ni las páginas. `user` sólo
// lo lee PendingRedirectGate, que se monta suelto en su propio bloque.
const initializeAuth = vi.fn();
const initializeTheme = vi.fn();
const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isLoading: true,
}));
vi.mock('./stores/auth', () => ({
  useAuthStore: (
    selector: (s: {
      user: { id: string } | null;
      isLoading: boolean;
      initialize: () => void;
    }) => unknown,
  ) => selector({ ...authState, initialize: initializeAuth }),
}));
vi.mock('./stores/theme', () => ({
  useThemeStore: (selector: (s: { initialize: () => void }) => unknown) =>
    selector({ initialize: initializeTheme }),
}));

// Sólo se sustituyen los dos web components de la rama de carga: @ionic/react-router
// importa el resto del módulo real (ViewStacks) al cargarse.
vi.mock('@ionic/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ionic/react')>();
  return {
    ...actual,
    IonApp: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    IonSpinner: () => <div data-testid="spinner" />,
  };
});

type UrlOpenListener = (event: { url: string }) => void;

function appUrlOpenListener(): UrlOpenListener {
  const call = vi
    .mocked(CapApp.addListener)
    .mock.calls.find(([eventName]) => eventName === 'appUrlOpen');
  if (!call) throw new Error('appUrlOpen listener was never registered');
  return call[1] as UrlOpenListener;
}

describe('App deep links', () => {
  beforeEach(() => {
    vi.mocked(navigateToDeepLink).mockClear();
  });

  it('navigates when the deep link comes from a trusted host', () => {
    render(<App />);
    appUrlOpenListener()({ url: 'https://quedamos.alvarotc.com/join/12345678' });
    expect(navigateToDeepLink).toHaveBeenCalledWith('/join/12345678');
  });

  it('ignores a deep link from a foreign host', () => {
    render(<App />);
    appUrlOpenListener()({ url: 'https://evil.com/join/12345678' });
    expect(navigateToDeepLink).not.toHaveBeenCalled();
  });

  it('ignores a deep link with a path outside the allowlist', () => {
    render(<App />);
    appUrlOpenListener()({ url: 'https://quedamos.alvarotc.com/admin' });
    expect(navigateToDeepLink).not.toHaveBeenCalled();
  });
});

// Cada render del sondeo apunta dónde está el router: así se distingue "no ha
// navegado" de "ha vuelto a navegar al mismo sitio" (que remontaría la página).
const visited: string[] = [];

function LocationProbe() {
  const location = useLocation();
  const path = `${location.pathname}${location.search}`;
  visited.push(path);
  return <div data-testid="location">{path}</div>;
}

// El gate se monta suelto bajo MemoryRouter: montar App entero traería el
// IonRouterOutlet real, que bajo jsdom no presenta ninguna vista.
function renderGate(initialPath: string) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PendingRedirectGate>
        <LocationProbe />
      </PendingRedirectGate>
    </MemoryRouter>,
  );
}

describe('PendingRedirectGate', () => {
  beforeEach(() => {
    visited.length = 0;
  });

  afterEach(() => {
    authState.user = null;
  });

  it('retoma la invitación aparcada en cuanto hay sesión y la consume', () => {
    authState.user = { id: 'user-1' };
    savePendingRedirect('/join/12345678');

    renderGate('/');

    expect(screen.getByTestId('location')).toHaveTextContent('/join/12345678');
    expect(visited).toEqual(['/', '/join/12345678']);
    expect(takePendingRedirect()).toBeNull();
  });

  it('también la retoma si la sesión restaurada aterriza en /tabs', () => {
    authState.user = { id: 'user-1' };
    savePendingRedirect('/join/12345678');

    renderGate('/tabs/calendar');

    expect(visited).toEqual(['/tabs/calendar', '/join/12345678']);
  });

  it('sin destino aparcado no navega', () => {
    authState.user = { id: 'user-1' };

    renderGate('/tabs/calendar');

    expect(visited).toEqual(['/tabs/calendar']);
  });

  it('sin sesión no consume el destino aparcado', () => {
    savePendingRedirect('/join/12345678');

    renderGate('/login?redirect=%2Fjoin%2F12345678');

    expect(visited).toEqual(['/login?redirect=%2Fjoin%2F12345678']);
    expect(takePendingRedirect()).toBe('/join/12345678');
  });

  it('no secuestra el enlace de recuperar contraseña, que llega con sesión', () => {
    authState.user = { id: 'user-1' };
    savePendingRedirect('/join/12345678');

    renderGate('/reset-password');

    expect(visited).toEqual(['/reset-password']);
    expect(takePendingRedirect()).toBe('/join/12345678');
  });

  it('si ya está en el destino lo consume sin volver a navegar', () => {
    authState.user = { id: 'user-1' };
    savePendingRedirect('/join/12345678');

    renderGate('/join/12345678');

    expect(visited).toEqual(['/join/12345678']);
    expect(takePendingRedirect()).toBeNull();
  });
});
