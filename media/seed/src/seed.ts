import { pathToFileURL } from 'node:url';
import { createRealDeps, type Api, type Deps, type PollCreateDto, type PollDto } from './clients.js';
import { loadConfig } from './env.js';
import {
  DEMO_USERS,
  EVENT_SPEC,
  GROUP_SPEC,
  POLL_ANSWERS,
  POLL_CREATOR,
  POLL_SLOT,
  PROPOSAL_CREATOR,
  PROPOSAL_SPEC,
  PROPOSAL_VOTES,
  USER_KEYS,
  buildAvailability,
  pickEventDate,
  pickPollDate,
  type UserKey,
} from './plan.js';

export interface Session {
  key: UserKey;
  userId: string;
  api: Api;
}
export type Sessions = Record<UserKey, Session>;

/**
 * Inicia sesión con cada cuenta de demo. Con `create` crea las que falten; sin él las salta.
 * Si una cuenta existe pero no tenemos su contraseña, la regenera por la API de administración.
 * GET /auth/me crea la fila de perfil la primera vez (AuthGuard).
 */
export async function ensureSessions(deps: Deps, create: boolean): Promise<Partial<Sessions>> {
  const existing = await deps.admin.listUsers();
  const sessions: Partial<Sessions> = {};
  for (const user of DEMO_USERS) {
    const authUser = existing.find((u) => u.email?.toLowerCase() === user.email);
    let password = deps.passwords[user.key];
    if (!authUser) {
      if (!create) continue;
      if (!password) {
        password = deps.newPassword();
        deps.savePassword(user.key, password);
      }
      await deps.admin.createUser(user, password);
      deps.log(`cuenta creada: ${user.email}`);
    } else if (!password) {
      password = deps.newPassword();
      await deps.admin.setPassword(authUser.id, password);
      deps.savePassword(user.key, password);
      deps.log(`contraseña regenerada: ${user.email}`);
    }
    const api = deps.api(await deps.login(user.email, password));
    const me = await api.me();
    sessions[user.key] = { key: user.key, userId: me.id, api };
  }
  return sessions;
}

function requireAll(partial: Partial<Sessions>): Sessions {
  const missing = USER_KEYS.filter((key) => !partial[key]);
  if (missing.length > 0) throw new Error(`Faltan sesiones: ${missing.join(', ')}`);
  return partial as Sessions;
}

export interface SeedSummary {
  groupId: string;
  inviteCode: string;
  eventDate: string;
  pollDate: string;
  availabilityCreated: number;
}

export async function runSeed(deps: Deps): Promise<SeedSummary> {
  // Primero lo que puede fallar sin red: así no se escribe nada si SEED_TODAY no sirve.
  const entries = buildAvailability(deps.seedToday);
  const eventDate = pickEventDate(entries, deps.seedToday, deps.now);
  const pollDate = pickPollDate(entries, deps.seedToday, deps.now);

  const s = requireAll(await ensureSessions(deps, true));
  const marta = s.marta;

  let group = (await marta.api.listGroups()).find((g) => g.name === GROUP_SPEC.name);
  if (!group) {
    group = await marta.api.createGroup(GROUP_SPEC.name, GROUP_SPEC.emoji);
    deps.log(`grupo creado: ${group.id}`);
  }
  const groupId = group.id;
  const inviteCode = await marta.api.getInviteCode(groupId);
  const memberIds = new Set(group.members.map((m) => m.userId));
  for (const key of USER_KEYS) {
    if (memberIds.has(s[key].userId)) continue;
    await s[key].api.joinGroup(inviteCode);
    deps.log(`${key} entra en el grupo`);
  }

  const have = new Set(
    (await marta.api.listAvailability(groupId)).map((a) => `${a.userId}|${a.date.slice(0, 10)}`),
  );
  let availabilityCreated = 0;
  for (const entry of entries) {
    if (have.has(`${s[entry.user].userId}|${entry.date}`)) continue;
    await s[entry.user].api.addAvailability(groupId, entry);
    availabilityCreated += 1;
  }
  deps.log(`disponibilidad: ${availabilityCreated} filas nuevas de ${entries.length}`);

  const creator = s[PROPOSAL_CREATOR];
  let proposal = (await creator.api.listProposals(groupId)).find((p) => p.title === PROPOSAL_SPEC.title);
  if (!proposal) {
    proposal = await creator.api.createProposal(groupId, { ...PROPOSAL_SPEC, proposedDate: eventDate });
    deps.log(`propuesta creada: ${proposal.id}`);
  }
  for (const key of USER_KEYS) {
    const vote = PROPOSAL_VOTES[key];
    if (!vote) continue;
    const done = (proposal.votes ?? []).some((v) => v.userId === s[key].userId && v.vote === vote);
    if (!done) await s[key].api.voteProposal(groupId, proposal.id, vote);
  }

  const pollOwner = s[POLL_CREATOR];
  let poll: PollDto | PollCreateDto | undefined = (await pollOwner.api.listPolls(groupId)).find(
    (p) => p.date.slice(0, 10) === pollDate && p.slot === POLL_SLOT,
  );
  if (!poll) {
    poll = await pollOwner.api.createPoll(groupId, pollDate, POLL_SLOT);
    deps.log(`pregunta creada: ${poll.id}`);
  }
  // POST /polls no devuelve `responses` (PollsService.create solo incluye createdBy): una
  // pregunta recién creada se trata como sin respuestas. responder() es un upsert, así que
  // repetirlo para el creador no hace daño.
  const responses = 'responses' in poll ? poll.responses : [];
  for (const key of USER_KEYS) {
    const answer = POLL_ANSWERS[key];
    if (!answer) continue;
    const done = responses.some((r) => r.userId === s[key].userId && r.answer === answer);
    if (!done) await s[key].api.respondPoll(groupId, poll.id, answer);
  }

  let event = (await marta.api.listEvents(groupId)).find(
    (e) => e.title === EVENT_SPEC.title && e.date.slice(0, 10) === eventDate,
  );
  if (!event) {
    event = await marta.api.createEvent(groupId, { ...EVENT_SPEC, date: eventDate });
    deps.log(`quedada creada: ${event.id} (${eventDate} ${EVENT_SPEC.time})`);
  }
  for (const key of USER_KEYS) {
    if (key === 'marta') continue;
    const attendee = event.attendees.find((a) => a.userId === s[key].userId);
    if (attendee?.status === 'confirmed') continue;
    await s[key].api.respondEvent(groupId, event.id, 'confirmed');
  }

  return { groupId, inviteCode, eventDate, pollDate, availabilityCreated };
}

async function main(): Promise<void> {
  const summary = await runSeed(createRealDeps(loadConfig()));
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
