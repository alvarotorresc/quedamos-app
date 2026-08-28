import { describe, it, expect } from 'vitest';
import { buildMemberColorMap, memberColorByIndex } from './member-colors';
import { MEMBER_COLORS } from './constants';

const m = (userId: string, joinedAt: string) => ({ userId, joinedAt });

describe('buildMemberColorMap', () => {
  it('asigna por orden de entrada al grupo, sin repetir hasta 7+', () => {
    const map = buildMemberColorMap([
      m('c', '2026-01-03T00:00:00Z'),
      m('a', '2026-01-01T00:00:00Z'),
      m('b', '2026-01-02T00:00:00Z'),
    ]);
    expect(map.get('a')).toBe(MEMBER_COLORS[0]);
    expect(map.get('b')).toBe(MEMBER_COLORS[1]);
    expect(map.get('c')).toBe(MEMBER_COLORS[2]);
  });
  it('cicla la paleta a partir del séptimo', () => {
    const members = Array.from({ length: 8 }, (_, i) =>
      m(`u${i}`, `2026-01-0${i + 1}T00:00:00Z`));
    const map = buildMemberColorMap(members);
    expect(map.get('u6')).toBe(MEMBER_COLORS[0]);
    expect(map.get('u7')).toBe(MEMBER_COLORS[1]);
  });
  it('desempata joinedAt idéntico por userId (estable)', () => {
    const map = buildMemberColorMap([m('z', '2026-01-01T00:00:00Z'), m('a', '2026-01-01T00:00:00Z')]);
    expect(map.get('a')).toBe(MEMBER_COLORS[0]);
    expect(map.get('z')).toBe(MEMBER_COLORS[1]);
  });
});

describe('memberColorByIndex', () => {
  it('indexa con módulo', () => {
    expect(memberColorByIndex(0)).toBe(MEMBER_COLORS[0]);
    expect(memberColorByIndex(7)).toBe(MEMBER_COLORS[1]);
  });
});
