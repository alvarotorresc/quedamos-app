import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as CapApp } from '@capacitor/app';
import App from './App';
import { navigateToDeepLink } from './lib/deep-link';

// La navegación real (window.location.href) no se puede espiar en jsdom: se aísla en
// el helper y aquí se mockea sólo esa función, dejando viva la validación real.
vi.mock('./lib/deep-link', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/deep-link')>();
  return { ...actual, navigateToDeepLink: vi.fn() };
});

// Con isLoading a true, App se queda en el spinner: el efecto de deep links se
// registra igualmente y no hace falta montar el router ni las páginas.
const initializeAuth = vi.fn();
const initializeTheme = vi.fn();
vi.mock('./stores/auth', () => ({
  useAuthStore: (selector: (s: { isLoading: boolean; initialize: () => void }) => unknown) =>
    selector({ isLoading: true, initialize: initializeAuth }),
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
