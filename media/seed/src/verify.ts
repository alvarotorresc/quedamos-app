import { pathToFileURL } from 'node:url';
import { createRealDeps, type Deps } from './clients.js';
import { loadConfig } from './env.js';
import {
  EVENT_SPEC,
  GROUP_SPEC,
  POLL_SLOT,
  PROPOSAL_SPEC,
  USER_KEYS,
  buildAvailability,
  countByDate,
  parseIsoDate,
} from './plan.js';
import { ensureSessions } from './seed.js';

/** Lista lo que hay y devuelve los problemas encontrados (vacío = todo en su sitio). */
export async function runVerify(deps: Deps): Promise<string[]> {
  const problems: string[] = [];
  const sessions = await ensureSessions(deps, false);
  for (const key of USER_KEYS) {
    if (!sessions[key]) problems.push(`falta la cuenta ${key}`);
  }
  const marta = sessions.marta;
  if (!marta) return problems;

  const group = (await marta.api.listGroups()).find((g) => g.name === GROUP_SPEC.name);
  if (!group) {
    problems.push(`falta el grupo ${GROUP_SPEC.name}`);
    return problems;
  }
  deps.log(`grupo ${group.id}: ${group.members.length} miembros`);
  if (group.members.length !== USER_KEYS.length) {
    problems.push(`el grupo tiene ${group.members.length} miembros y se esperaban ${USER_KEYS.length}`);
  }

  const expected = buildAvailability(deps.seedToday);
  const rows = await marta.api.listAvailability(group.id);
  const have = new Set(rows.map((a) => `${a.userId}|${a.date.slice(0, 10)}`));
  const missing = expected.filter((e) => !have.has(`${sessions[e.user]?.userId}|${e.date}`)).length;
  deps.log(`disponibilidad: ${rows.length} filas, faltan ${missing} de ${expected.length}`);
  if (missing > 0) problems.push(`faltan ${missing} filas de disponibilidad`);

  const proposal = (await marta.api.listProposals(group.id)).find((p) => p.title === PROPOSAL_SPEC.title);
  const votes = proposal?.votes?.length ?? 0;
  deps.log(`propuesta: ${proposal ? `${votes} votos` : 'no existe'}`);
  if (!proposal) problems.push(`falta la propuesta «${PROPOSAL_SPEC.title}»`);
  else if (votes < 4) problems.push(`la propuesta tiene ${votes} votos y se esperaban al menos 4`);

  const poll = (await marta.api.listPolls(group.id)).find(
    (p) => p.slot === POLL_SLOT && p.responses.some((r) => r.answer === 'unsure'),
  );
  deps.log(`pregunta: ${poll ? `${poll.date.slice(0, 10)}, ${poll.responses.length} respuestas` : 'no existe'}`);
  if (!poll) problems.push('falta la pregunta con algún «quizá»');

  const counts = countByDate(expected);
  const event = (await marta.api.listEvents(group.id)).find((e) => e.title === EVENT_SPEC.title);
  if (!event) {
    problems.push(`falta la quedada «${EVENT_SPEC.title}»`);
  } else {
    const date = event.date.slice(0, 10);
    deps.log(`quedada: ${date} ${event.time ?? ''} ${event.status}`);
    if (event.status !== 'confirmed') problems.push(`la quedada está ${event.status}, no confirmada`);
    if (parseIsoDate(date).getUTCDay() !== 6 || counts.get(date) !== USER_KEYS.length) {
      problems.push('la quedada no cae en un sábado en que coinciden los cinco');
    }
  }
  return problems;
}

async function main(): Promise<void> {
  const deps = createRealDeps(loadConfig());
  const problems = await runVerify(deps);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    process.exit(1);
  }
  console.log('OK: el grupo de demo está completo');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
