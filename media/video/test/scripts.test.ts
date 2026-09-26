import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { comprobarPng, leerPng } from '../scripts/png.mjs';
import { mapear, preparar } from '../scripts/preparar.mjs';

const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const chunk = (tipo: string, datos: Buffer) => {
  const b = Buffer.alloc(12 + datos.length);
  b.writeUInt32BE(datos.length, 0);
  b.write(tipo, 4, 'latin1');
  datos.copy(b, 8);
  return b;
};
const png = (ancho: number, alto: number, tipoColor = 2, extra: string[] = []) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8;
  ihdr[9] = tipoColor;
  return Buffer.concat([FIRMA, chunk('IHDR', ihdr), ...extra.map((t) => chunk(t, Buffer.alloc(1))), chunk('IEND', Buffer.alloc(0))]);
};
const juego = (lang: string, conNombre: boolean) => [
  ...['calendario', 'proponer', 'respuestas', 'quedada', 'grupo', 'perfil'].map((n, i) => (conNombre ? `shot-0${i + 1}-${n}-${lang}.png` : `shot-0${i + 1}-${lang}.png`)),
  `cover-${lang}.png`,
];

describe('png', () => {
  it('lee medidas, tipo de color y chunks', () => {
    expect(leerPng(png(1024, 500, 2, ['tRNS']))).toEqual({ ancho: 1024, alto: 500, profundidad: 8, tipoColor: 2, chunks: ['IHDR', 'tRNS', 'IEND'] });
  });
  it('acepta un RGB sin alfa con la medida exacta', () => expect(comprobarPng(png(1920, 1080), { ancho: 1920, alto: 1080, sinAlfa: true })).toEqual([]));
  it('rechaza alfa cuando se pide sin alfa', () => expect(comprobarPng(png(1024, 500, 6), { ancho: 1024, alto: 500, sinAlfa: true }).join()).toMatch(/tipo de color 6/));
  it('rechaza tRNS cuando se pide sin alfa', () => expect(comprobarPng(png(1024, 500, 2, ['tRNS']), { ancho: 1024, alto: 500, sinAlfa: true }).join()).toMatch(/tRNS/));
  it('rechaza otra medida', () => expect(comprobarPng(png(1080, 1920), { ancho: 1080, alto: 2340 }).join()).toMatch(/mide 1080×1920/));
  it('rechaza lo que no es PNG', () => expect(comprobarPng(Buffer.from('hola'), { ancho: 1, alto: 1 })).toEqual(['no es un PNG']));
});

describe('mapear', () => {
  it('acepta los nombres cortos y los de la galería', () => {
    const { copias, faltan } = mapear([...juego('es', false), ...juego('en', true)]);
    expect(faltan).toEqual([]);
    expect(copias).toHaveLength(14);
    expect(copias.find((c) => c.destino === 'shots/en/shot-03.png')?.origen).toBe('shot-03-respuestas-en.png');
    expect(copias.find((c) => c.destino === 'shots/es/cover.png')?.origen).toBe('cover-es.png');
  });
  it('no confunde cover-mobile con cover ni un idioma con otro', () => {
    const { faltan } = mapear(['cover-mobile-es.png', 'shot-01-en.png']);
    expect(faltan).toContain('cover-es.png');
    expect(faltan).toContain('shot-01-es.png');
    expect(faltan).not.toContain('shot-01-en.png');
  });
  it('marca como ambiguo un slot con dos candidatos', () => {
    expect(mapear(['shot-01-es.png', 'shot-01-calendario-es.png']).faltan.join()).toMatch(/ambiguo/);
  });
});

describe('preparar', () => {
  const dir = mkdtempSync(join(tmpdir(), 'video-src-'));
  const origen = join(dir, 'video-src');
  const publico = join(dir, 'public');
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('copia las 14 capturas y rechaza una medida equivocada', () => {
    rmSync(origen, { recursive: true, force: true });
    mkdirSync(origen, { recursive: true });
    for (const lang of ['es', 'en']) {
      for (const n of juego(lang, true)) writeFileSync(join(origen, n), n.startsWith('cover') ? png(1600, 1000) : png(1080, 2340));
    }
    expect(preparar(origen, publico)).toEqual([]);
    expect(readdirSync(join(publico, 'shots', 'es')).sort()).toEqual(['cover.png', 'shot-01.png', 'shot-02.png', 'shot-03.png', 'shot-04.png', 'shot-05.png', 'shot-06.png']);
    writeFileSync(join(origen, 'cover-en.png'), png(1080, 2340));
    expect(preparar(origen, publico).join()).toMatch(/cover-en\.png: mide 1080×2340/);
  });

  it('lista lo que falta si no existe el origen', () => {
    expect(preparar(join(dir, 'no-existe'), publico)).toHaveLength(14);
  });
});
