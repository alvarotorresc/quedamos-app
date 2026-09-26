import { describe, expect, it } from 'vitest';
import { en } from '../src/copy/en';
import { es, type CopyKey } from '../src/copy/es';

const claves = Object.keys(es) as CopyKey[];
const largo = (texto: string) => [...texto].length;

// El inglés ocupa el mismo hueco que el español en el vídeo. El guion
// (docs/superpowers/specs/2026-09-26-video-flujo-design.md) fija varios rótulos ingleses algo más largos
// que su español ("See who's in and who's out", "Leo · Not going"), así que el margen es de un 25 % más
// de caracteres para todos; más que eso ya no cabe en la franja del rótulo ni en la etiqueta de Leo.
const MARGEN = 1.25;

// Literales del guion: si alguien los cambia, que sea a propósito y cambiando también el spec.
const LITERALES_SPEC: Partial<Record<CopyKey, [string, string]>> = {
  'intro.golpe1': ['Tu grupo quiere verse.', 'Your group wants to meet.'],
  'intro.golpe2': ['Nadie sabe cuándo.', 'Nobody knows when.'],
  'calendario.rotulo': ['Todos marcan cuándo pueden', "Everyone marks when they're free"],
  'proponer.rotulo': ['Marta propone el viernes', 'Marta suggests Friday'],
  'responder.aviso': ['Nueva quedada', 'New plan'],
  'responder.rotulo': ['A todos les llega. Un toque para responder', 'Everyone gets it. One tap to answer'],
  'respuestas.leo': ['Leo · No voy', 'Leo · Not going'],
  'respuestas.rotulo': ['Se ve quién va y quién no', "See who's in and who's out"],
  'fijada.rotulo': ['Y queda fijada', "And it's set"],
  'cierre.plataformas': ['Android y web', 'Android and web'],
};

describe('copy', () => {
  it('los dos idiomas tienen las mismas claves', () => {
    expect(Object.keys(en).sort()).toEqual([...claves].sort());
  });

  it.each(claves)('%s: el inglés no pasa de un 25 %% más que el español', (k) => {
    expect(largo(en[k])).toBeLessThanOrEqual(Math.ceil(largo(es[k]) * MARGEN));
  });

  it.each(Object.keys(LITERALES_SPEC) as CopyKey[])('%s: coincide con el guion', (k) => {
    expect([es[k], en[k]]).toEqual(LITERALES_SPEC[k]);
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
