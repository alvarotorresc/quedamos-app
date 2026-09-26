import { pathToFileURL } from 'node:url';
import { createRealDeps, type Deps } from './clients.js';
import { loadConfig } from './env.js';
import { GROUP_SPEC, USER_KEYS, type UserKey } from './plan.js';
import { ensureSessions } from './seed.js';

/**
 * Borra el grupo de demo y las cinco cuentas solo por la API de Quedamos.
 *
 * Nunca se borra por la API de administración de Supabase: Group/Event/PlanProposal.createdBy
 * son RESTRICT y public.users no depende de auth.users, así que quedarían filas huérfanas con
 * el email ocupado. Orden: el fundador borra el grupo (cascada de todo su contenido) y luego
 * cada cuenta hace DELETE /auth/me. Se para en el primer error.
 */
export async function runClean(deps: Deps): Promise<UserKey[]> {
  const sessions = await ensureSessions(deps, false);

  for (const key of USER_KEYS) {
    const session = sessions[key];
    if (!session) continue;
    const owned = (await session.api.listGroups()).filter(
      (g) => g.name === GROUP_SPEC.name && g.createdById === session.userId,
    );
    for (const group of owned) {
      await session.api.deleteGroup(group.id);
      deps.log(`grupo borrado: ${group.id}`);
    }
  }

  const removed: UserKey[] = [];
  for (const key of USER_KEYS) {
    const session = sessions[key];
    if (!session) continue;
    try {
      await session.api.deleteAccount();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`No se pudo borrar la cuenta ${key}; se detiene clean: ${message}`);
    }
    removed.push(key);
    deps.log(`cuenta borrada: ${key}`);
  }
  return removed;
}

async function main(): Promise<void> {
  const removed = await runClean(createRealDeps(loadConfig()));
  console.log(removed.length ? `Borradas: ${removed.join(', ')}` : 'No había nada que borrar');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
