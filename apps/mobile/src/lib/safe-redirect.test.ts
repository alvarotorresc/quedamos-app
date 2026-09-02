import { describe, it, expect } from 'vitest';
import { safeRedirect } from './safe-redirect';

describe('safeRedirect', () => {
  it('acepta rutas relativas de la propia app', () => {
    expect(safeRedirect('/join/48213956')).toBe('/join/48213956');
    expect(safeRedirect('/tabs/plans?eventId=1')).toBe('/tabs/plans?eventId=1');
    expect(safeRedirect('/')).toBe('/');
  });

  it('cae al destino por defecto sin parámetro', () => {
    expect(safeRedirect(null)).toBe('/tabs');
    expect(safeRedirect(undefined)).toBe('/tabs');
    expect(safeRedirect('')).toBe('/tabs');
  });

  it('rechaza destinos que salen de la app', () => {
    expect(safeRedirect('//evil.com')).toBe('/tabs');
    expect(safeRedirect('/\\evil.com')).toBe('/tabs');
    expect(safeRedirect('http://evil.com')).toBe('/tabs');
    expect(safeRedirect('https://evil.com')).toBe('/tabs');
    expect(safeRedirect('javascript:alert(1)')).toBe('/tabs');
    expect(safeRedirect('tabs/plans')).toBe('/tabs');
  });

  it('rechaza los caracteres de control que el navegador borra de la URL', () => {
    // Chrome strips tabs/newlines before parsing, so "/\n/evil.com" would end up
    // as the protocol-relative "//evil.com".
    expect(safeRedirect('/\n/evil.com')).toBe('/tabs');
    expect(safeRedirect('/\t/evil.com')).toBe('/tabs');
  });

  it('admite otro destino por defecto', () => {
    expect(safeRedirect('//evil.com', '/login')).toBe('/login');
  });
});
