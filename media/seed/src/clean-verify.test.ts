import { describe, expect, it } from 'vitest';
import { runClean } from './clean.js';
import { createFakeDeps, createWorld } from './fake-api.js';
import type { UserKey } from './plan.js';
import { runSeed } from './seed.js';
import { runVerify } from './verify.js';

async function seededWorld(): Promise<{
  world: ReturnType<typeof createWorld>;
  saved: Partial<Record<UserKey, string>>;
}> {
  const world = createWorld();
  const deps = createFakeDeps(world);
  await runSeed(deps);
  return { world, saved: { ...deps.saved } };
}

describe('runClean', () => {
  it('borra el grupo y después las cuentas, y no deja nada', async () => {
    const { world, saved } = await seededWorld();
    const removed = await runClean(createFakeDeps(world, saved));

    expect(removed).toEqual(['marta', 'hugo', 'noa', 'leo', 'julia']);
    expect(world.authUsers).toEqual([]);
    expect(world.groups).toEqual([]);
    expect(world.availability).toEqual([]);
    expect(world.proposals).toEqual([]);
    expect(world.polls).toEqual([]);
    expect(world.events).toEqual([]);
  });

  it('no hace nada si no hay nada sembrado', async () => {
    const world = createWorld();
    expect(await runClean(createFakeDeps(world))).toEqual([]);
  });

  it('funciona aunque se haya perdido el .env con las contraseñas', async () => {
    const { world } = await seededWorld();
    await runClean(createFakeDeps(world, {}));
    expect(world.authUsers).toEqual([]);
  });

  it('se para en el primer fallo y no sigue borrando', async () => {
    const { world, saved } = await seededWorld();
    world.failDeleteFor.add('demo-hugo@quedamos.alvarotc.com');

    await expect(runClean(createFakeDeps(world, saved))).rejects.toThrow(/502/);
    const emails = world.authUsers.map((u) => u.email);
    expect(emails).not.toContain('demo-marta@quedamos.alvarotc.com');
    expect(emails).toContain('demo-hugo@quedamos.alvarotc.com');
    expect(emails).toContain('demo-julia@quedamos.alvarotc.com');
  });
});

describe('runVerify', () => {
  it('no encuentra problemas justo después de seed', async () => {
    const { world, saved } = await seededWorld();
    expect(await runVerify(createFakeDeps(world, saved))).toEqual([]);
  });

  it('lista lo que falta en un mundo vacío', async () => {
    const problems = await runVerify(createFakeDeps(createWorld()));
    expect(problems).toContain('falta la cuenta marta');
    expect(problems).toHaveLength(5);
  });

  it('detecta disponibilidad incompleta', async () => {
    const { world, saved } = await seededWorld();
    world.availability.pop();
    const problems = await runVerify(createFakeDeps(world, saved));
    expect(problems.some((p) => /disponibilidad/.test(p))).toBe(true);
  });

  it('detecta una quedada sin confirmar', async () => {
    const { world, saved } = await seededWorld();
    const event = world.events[0];
    if (event) event.status = 'pending';
    const problems = await runVerify(createFakeDeps(world, saved));
    expect(problems.some((p) => /quedada/.test(p))).toBe(true);
  });
});
