import { describe, expect, it } from 'vitest';
import {
  buildAvailability,
  countByDate,
  monthDays,
  parseIsoDate,
  pickEventDate,
  pickPollDate,
  utcToday,
} from './plan.js';

const SEED = '2026-10-01'; // jueves

describe('parseIsoDate', () => {
  it('acepta fechas reales y rechaza las imposibles', () => {
    expect(parseIsoDate('2026-10-03').getUTCDay()).toBe(6);
    expect(() => parseIsoDate('2026-02-30')).toThrow(/Fecha no válida/);
    expect(() => parseIsoDate('1-2-3')).toThrow(/Fecha no válida/);
  });
});

describe('utcToday', () => {
  it('usa el día UTC', () => {
    expect(utcToday(new Date('2026-10-10T23:30:00Z'))).toBe('2026-10-10');
  });
});

describe('monthDays', () => {
  it('devuelve todos los días del mes de SEED_TODAY', () => {
    const days = monthDays(SEED);
    expect(days).toHaveLength(31);
    expect(days[0]).toBe('2026-10-01');
    expect(days[30]).toBe('2026-10-31');
  });
});

describe('buildAvailability', () => {
  const entries = buildAvailability(SEED);
  const counts = countByDate(entries);

  it('genera el número esperado de filas', () => {
    // 5 sábados (4 + 5*4) + 5 viernes * 3 + 4 miércoles * 3 + 4 domingos * 2
    expect(entries).toHaveLength(59);
  });

  it('mezcla días de cinco, de tres y vacíos', () => {
    expect(counts.get('2026-10-03')).toBe(4); // primer sábado, sin Leo
    expect(counts.get('2026-10-10')).toBe(5);
    expect(counts.get('2026-10-02')).toBe(3); // viernes
    expect(counts.get('2026-10-07')).toBe(3); // miércoles
    expect(counts.get('2026-10-04')).toBe(2); // domingo
    expect(counts.get('2026-10-05')).toBeUndefined(); // lunes vacío
  });

  it('no repite usuario y fecha (UNIQUE en la base)', () => {
    const keys = entries.map((e) => `${e.user}|${e.date}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('usa los tipos que admite la API', () => {
    const friday = entries.find((e) => e.date === '2026-10-02');
    expect(friday).toMatchObject({ type: 'slots', slots: ['Tarde', 'Noche'] });
    const wednesday = entries.find((e) => e.date === '2026-10-07');
    expect(wednesday).toMatchObject({ type: 'range', startTime: '19:00', endTime: '22:00' });
  });
});

describe('pickEventDate', () => {
  const entries = buildAvailability(SEED);

  it('elige el primer sábado con los cinco desde SEED_TODAY', () => {
    expect(pickEventDate(entries, SEED, new Date('2026-09-26T10:00:00Z'))).toBe('2026-10-10');
  });

  it('no elige un sábado pasado respecto al hoy real', () => {
    expect(pickEventDate(entries, SEED, new Date('2026-10-20T10:00:00Z'))).toBe('2026-10-24');
  });

  it('acepta el propio sábado de hoy', () => {
    expect(pickEventDate(entries, SEED, new Date('2026-10-10T23:30:00Z'))).toBe('2026-10-10');
  });

  it('falla nombrando SEED_TODAY si no queda ninguno', () => {
    expect(() => pickEventDate(entries, SEED, new Date('2026-11-02T10:00:00Z'))).toThrow(/SEED_TODAY/);
  });
});

describe('pickPollDate', () => {
  it('elige el primer viernes con tres personas', () => {
    const entries = buildAvailability(SEED);
    expect(pickPollDate(entries, SEED, new Date('2026-09-26T10:00:00Z'))).toBe('2026-10-02');
  });
});
