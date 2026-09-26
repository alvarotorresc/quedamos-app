import { describe, expect, it } from 'vitest';
import { en } from '../src/copy/en';
import { es, type CopyKey } from '../src/copy/es';

const claves = Object.keys(es) as CopyKey[];
const largo = (texto: string) => [...texto].length;

// El guion del spec (docs/superpowers/specs/2026-09-26-media-web-design.md, Entregable 2) fija estos
// tres rótulos ingleses literalmente y son algo más largos que su español. Se aceptan tal cual, fijados
// al literal, siempre que no pasen de un 25 % más de caracteres. Cualquier otro inglés más largo falla.
const EXCEPCIONES_LARGO: Partial<Record<CopyKey, string>> = {
  'intro.eslogan': 'Your group wants to meet. Nobody knows when.',
  'calendario.rotulo': "Everyone marks when they're free",
  'cierre.plataformas': 'Android and web',
};

describe('copy', () => {
  it('los dos idiomas tienen las mismas claves', () => {
    expect(Object.keys(en).sort()).toEqual([...claves].sort());
  });

  it.each(claves)('%s: el inglés no es más largo que el español', (k) => {
    const literal = EXCEPCIONES_LARGO[k];
    if (literal !== undefined) {
      expect(en[k]).toBe(literal);
      expect(largo(en[k])).toBeLessThanOrEqual(Math.ceil(largo(es[k]) * 1.25));
      return;
    }
    expect(largo(en[k])).toBeLessThanOrEqual(largo(es[k]));
  });

  it.each(claves)('%s: ningún texto vacío', (k) => {
    expect(es[k].trim().length).toBeGreaterThan(0);
    expect(en[k].trim().length).toBeGreaterThan(0);
  });

  it('sin emojis ni menciones a IA', () => {
    for (const k of claves) {
      for (const t of [es[k], en[k]]) {
        expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(t).not.toMatch(/(?<!\p{L})(IA|AI)(?!\p{L})/u);
      }
    }
  });
});
