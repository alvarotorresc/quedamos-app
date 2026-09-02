import { describe, it, expect, vi } from 'vitest';
import {
  savePendingRedirect,
  takePendingRedirect,
  clearPendingRedirect,
  PENDING_REDIRECT_KEY,
} from './pending-redirect';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('pending redirect', () => {
  it('devuelve el destino guardado una sola vez', () => {
    savePendingRedirect('/join/12345678');

    expect(takePendingRedirect()).toBe('/join/12345678');
    expect(takePendingRedirect()).toBeNull();
  });

  it('sin nada guardado no hay destino', () => {
    expect(takePendingRedirect()).toBeNull();
  });

  it('no guarda destinos que salen de la app', () => {
    savePendingRedirect('//evil.com');
    expect(takePendingRedirect()).toBeNull();

    savePendingRedirect('https://evil.com');
    expect(takePendingRedirect()).toBeNull();

    savePendingRedirect(null);
    expect(takePendingRedirect()).toBeNull();
  });

  it('tampoco devuelve un destino manipulado a mano en el almacenamiento', () => {
    localStorage.setItem(
      PENDING_REDIRECT_KEY,
      JSON.stringify({ path: '//evil.com', savedAt: Date.now() }),
    );

    expect(takePendingRedirect()).toBeNull();
  });

  it('caduca a las 24 h y suelta el destino', () => {
    localStorage.setItem(
      PENDING_REDIRECT_KEY,
      JSON.stringify({ path: '/join/12345678', savedAt: Date.now() - DAY_MS - 1000 }),
    );

    expect(takePendingRedirect()).toBeNull();
    expect(localStorage.getItem(PENDING_REDIRECT_KEY)).toBeNull();
  });

  it('mantiene un destino guardado hace menos de 24 h', () => {
    localStorage.setItem(
      PENDING_REDIRECT_KEY,
      JSON.stringify({ path: '/join/12345678', savedAt: Date.now() - DAY_MS + 60_000 }),
    );

    expect(takePendingRedirect()).toBe('/join/12345678');
  });

  it('ignora un contenido corrupto sin lanzar', () => {
    localStorage.setItem(PENDING_REDIRECT_KEY, 'no-json{');

    expect(takePendingRedirect()).toBeNull();
    expect(localStorage.getItem(PENDING_REDIRECT_KEY)).toBeNull();
  });

  it('clearPendingRedirect borra el destino', () => {
    savePendingRedirect('/join/12345678');

    clearPendingRedirect();

    expect(takePendingRedirect()).toBeNull();
  });

  it('no rompe si el almacenamiento lanza', () => {
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => savePendingRedirect('/join/12345678')).not.toThrow();

    vi.mocked(localStorage.getItem).mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });
    expect(takePendingRedirect()).toBeNull();

    vi.mocked(localStorage.removeItem).mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });
    expect(() => clearPendingRedirect()).not.toThrow();
  });
});
