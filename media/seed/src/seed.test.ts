import { describe, expect, it } from 'vitest';
import { createFakeDeps, createWorld } from './fake-api.js';
import { DEMO_USERS } from './plan.js';
import { runSeed } from './seed.js';

const EMAILS = DEMO_USERS.map((u) => u.email).sort();

describe('runSeed', () => {
  it('siembra el grupo completo contra la API', async () => {
    const world = createWorld();
    const deps = createFakeDeps(world);
    const summary = await runSeed(deps);

    expect(world.authUsers.map((u) => u.email).sort()).toEqual(EMAILS);
    expect(Object.keys(deps.saved).sort()).toEqual(['hugo', 'julia', 'leo', 'marta', 'noa']);
    expect(world.profiles.size).toBe(5);

    expect(world.groups).toHaveLength(1);
    const group = world.groups[0];
    const marta = world.authUsers.find((u) => u.email === 'demo-marta@quedamos.alvarotc.com');
    const hugo = world.authUsers.find((u) => u.email === 'demo-hugo@quedamos.alvarotc.com');
    expect(group?.name).toBe('Ruta 2026');
    expect(group?.createdById).toBe(marta?.id);
    expect(group?.members).toHaveLength(5);

    expect(world.availability).toHaveLength(59);
    expect(summary.availabilityCreated).toBe(59);
    expect(summary.eventDate).toBe('2026-10-10');
    expect(summary.pollDate).toBe('2026-10-02');

    expect(world.proposals).toHaveLength(1);
    const votes = world.proposals[0]?.votes ?? [];
    // 4 votos explícitos del plan + el "yes" automático del creador (hugo) al crearla.
    expect(votes).toHaveLength(5);
    expect(votes.some((v) => v.userId === hugo?.id && v.vote === 'yes')).toBe(true);
    expect(new Set(votes.map((v) => v.vote))).toEqual(new Set(['yes', 'no']));

    expect(world.polls).toHaveLength(1);
    expect(world.polls[0]?.responses).toHaveLength(5);
    expect(world.polls[0]?.responses.map((r) => r.answer)).toContain('unsure');

    expect(world.events).toHaveLength(1);
    expect(world.events[0]).toMatchObject({
      title: 'Ruta por la sierra',
      date: '2026-10-10T00:00:00.000Z',
      time: '10:00',
      status: 'confirmed',
    });
    expect(world.events[0]?.attendees.every((a) => a.status === 'confirmed')).toBe(true);
  });

  it('es idempotente: la segunda pasada no duplica nada', async () => {
    const world = createWorld();
    const first = createFakeDeps(world);
    await runSeed(first);

    const second = createFakeDeps(world, first.saved);
    const summary = await runSeed(second);

    expect(summary.availabilityCreated).toBe(0);
    expect(second.saved).toEqual({});
    expect(world.authUsers).toHaveLength(5);
    expect(world.groups).toHaveLength(1);
    expect(world.groups[0]?.members).toHaveLength(5);
    expect(world.availability).toHaveLength(59);
    expect(world.proposals).toHaveLength(1);
    expect(world.polls).toHaveLength(1);
    expect(world.events).toHaveLength(1);
  });

  it('regenera la contraseña si la cuenta existe pero falta en .env', async () => {
    const world = createWorld();
    await runSeed(createFakeDeps(world));

    const again = createFakeDeps(world, {});
    await runSeed(again);

    expect(Object.keys(again.saved)).toHaveLength(5);
    expect(world.authUsers).toHaveLength(5);
  });

  it('no guarda la contraseña si el setPassword de admin falla', async () => {
    const world = createWorld();
    await runSeed(createFakeDeps(world));

    const again = createFakeDeps(world, {});
    again.admin.setPassword = async () => {
      throw new Error('500 admin no disponible');
    };

    await expect(runSeed(again)).rejects.toThrow(/admin no disponible/);
    expect(again.saved).toEqual({});
  });

  it('falla antes de escribir nada si no queda un sábado con los cinco', async () => {
    const world = createWorld();
    const deps = createFakeDeps(world);
    deps.now = new Date('2026-11-02T10:00:00Z');

    await expect(runSeed(deps)).rejects.toThrow(/SEED_TODAY/);
    expect(world.authUsers).toHaveLength(0);
  });
});
