import type {
  Api,
  AuthUser,
  AvailabilityDto,
  Deps,
  EventDto,
  GroupDto,
  PollDto,
  ProposalDto,
} from './clients.js';
import type { UserKey } from './plan.js';

interface FakeAuthUser extends AuthUser {
  email: string;
  password: string;
  metadata: Record<string, string>;
}
type InGroup<T> = T & { groupId: string };

export interface FakeWorld {
  authUsers: FakeAuthUser[];
  profiles: Set<string>;
  groups: (GroupDto & { inviteCode: string })[];
  availability: InGroup<AvailabilityDto & { type: string }>[];
  proposals: InGroup<ProposalDto & { createdById: string }>[];
  polls: InGroup<PollDto & { createdById: string }>[];
  events: InGroup<EventDto>[];
  /** Emails cuya DELETE /auth/me falla con 502 (para probar que clean se para). */
  failDeleteFor: Set<string>;
  nextId: number;
}

export function createWorld(): FakeWorld {
  return {
    authUsers: [],
    profiles: new Set(),
    groups: [],
    availability: [],
    proposals: [],
    polls: [],
    events: [],
    failDeleteFor: new Set(),
    nextId: 1,
  };
}

function newId(world: FakeWorld): string {
  const id = `id-${world.nextId}`;
  world.nextId += 1;
  return id;
}

/** Prisma serializa las columnas DATE como medianoche UTC. */
function asDbDate(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function fakeApi(world: FakeWorld, userId: string): Api {
  const memberGroup = (groupId: string): GroupDto & { inviteCode: string } => {
    const group = world.groups.find((g) => g.id === groupId && g.members.some((m) => m.userId === userId));
    if (!group) throw new Error(`404 group ${groupId}`);
    return group;
  };
  return {
    async me() {
      const user = world.authUsers.find((u) => u.id === userId);
      if (!user) throw new Error('401 Invalid token');
      world.profiles.add(userId);
      return { id: userId, name: user.metadata.name ?? 'Usuario', language: user.metadata.language };
    },
    async listGroups() {
      return structuredClone(world.groups.filter((g) => g.members.some((m) => m.userId === userId)));
    },
    async createGroup(name, emoji) {
      const group = {
        id: newId(world),
        name,
        emoji,
        createdById: userId,
        inviteCode: String(10000000 + world.nextId),
        members: [{ userId, role: 'admin' }],
      };
      world.groups.push(group);
      return structuredClone(group);
    },
    async deleteGroup(groupId) {
      const group = memberGroup(groupId);
      if (group.createdById !== userId) throw new Error('403 Only the group creator can delete the group');
      world.groups = world.groups.filter((g) => g.id !== groupId);
      world.availability = world.availability.filter((a) => a.groupId !== groupId);
      world.proposals = world.proposals.filter((p) => p.groupId !== groupId);
      world.polls = world.polls.filter((p) => p.groupId !== groupId);
      world.events = world.events.filter((e) => e.groupId !== groupId);
    },
    async getInviteCode(groupId) {
      return memberGroup(groupId).inviteCode;
    },
    async joinGroup(inviteCode) {
      const group = world.groups.find((g) => g.inviteCode === inviteCode);
      if (!group) throw new Error('404 Invite code not found');
      if (group.members.some((m) => m.userId === userId)) throw new Error('409 Already a member of this group');
      group.members.push({ userId, role: 'member' });
    },
    async listAvailability(groupId) {
      memberGroup(groupId);
      return structuredClone(world.availability.filter((a) => a.groupId === groupId));
    },
    async addAvailability(groupId, entry) {
      memberGroup(groupId);
      const date = asDbDate(entry.date);
      world.availability = world.availability.filter(
        (a) => !(a.groupId === groupId && a.userId === userId && a.date === date),
      );
      world.availability.push({ groupId, userId, date, type: entry.type });
    },
    async listProposals(groupId) {
      memberGroup(groupId);
      return structuredClone(world.proposals.filter((p) => p.groupId === groupId));
    },
    async createProposal(groupId, body) {
      memberGroup(groupId);
      const proposal = { id: newId(world), groupId, title: body.title, createdById: userId, votes: [] };
      world.proposals.push(proposal);
      return structuredClone(proposal);
    },
    async voteProposal(groupId, proposalId, vote) {
      memberGroup(groupId);
      const proposal = world.proposals.find((p) => p.id === proposalId && p.groupId === groupId);
      if (!proposal) throw new Error('404 Proposal not found');
      proposal.votes = [...(proposal.votes ?? []).filter((v) => v.userId !== userId), { userId, vote }];
    },
    async listPolls(groupId) {
      memberGroup(groupId);
      return structuredClone(world.polls.filter((p) => p.groupId === groupId));
    },
    async createPoll(groupId, date, slot) {
      memberGroup(groupId);
      const dbDate = asDbDate(date);
      if (world.polls.some((p) => p.groupId === groupId && p.date === dbDate && p.slot === slot)) {
        throw new Error('409 An open poll already exists for this day');
      }
      const poll = { id: newId(world), groupId, date: dbDate, slot, createdById: userId, responses: [] };
      world.polls.push(poll);
      return structuredClone(poll);
    },
    async respondPoll(groupId, pollId, answer) {
      memberGroup(groupId);
      const poll = world.polls.find((p) => p.id === pollId && p.groupId === groupId);
      if (!poll) throw new Error('404 Poll not found');
      poll.responses = [...poll.responses.filter((r) => r.userId !== userId), { userId, answer }];
    },
    async listEvents(groupId) {
      memberGroup(groupId);
      return structuredClone(world.events.filter((e) => e.groupId === groupId));
    },
    async createEvent(groupId, body) {
      const group = memberGroup(groupId);
      const event = {
        id: newId(world),
        groupId,
        title: body.title,
        date: asDbDate(body.date),
        time: body.time,
        status: 'pending',
        attendees: group.members.map((m) => ({
          userId: m.userId,
          status: m.userId === userId ? 'confirmed' : 'pending',
        })),
      };
      world.events.push(event);
      return structuredClone(event);
    },
    async respondEvent(groupId, eventId, status) {
      memberGroup(groupId);
      const event = world.events.find((e) => e.id === eventId && e.groupId === groupId);
      if (!event) throw new Error('404 Event not found');
      const attendee = event.attendees.find((a) => a.userId === userId);
      if (!attendee) throw new Error('404 Not invited to this event');
      attendee.status = status;
      if (event.attendees.every((a) => a.status === 'confirmed')) event.status = 'confirmed';
    },
    async deleteAccount() {
      const user = world.authUsers.find((u) => u.id === userId);
      if (!user) throw new Error('401 Invalid token');
      if (world.failDeleteFor.has(user.email)) throw new Error('502 Could not delete the account right now');
      if (world.groups.some((g) => g.createdById === userId)) {
        throw new Error('fake: el fundador aún tiene el grupo (la API real lo traspasaría)');
      }
      world.authUsers = world.authUsers.filter((u) => u.id !== userId);
      world.profiles.delete(userId);
      for (const group of world.groups) group.members = group.members.filter((m) => m.userId !== userId);
      world.availability = world.availability.filter((a) => a.userId !== userId);
    },
  };
}

export interface FakeDeps extends Deps {
  saved: Partial<Record<UserKey, string>>;
  logs: string[];
}

export function createFakeDeps(world: FakeWorld, passwords: Partial<Record<UserKey, string>> = {}): FakeDeps {
  const saved: Partial<Record<UserKey, string>> = {};
  const logs: string[] = [];
  let counter = 0;
  return {
    saved,
    logs,
    admin: {
      async listUsers() {
        return world.authUsers.map((u) => ({ id: u.id, email: u.email }));
      },
      async createUser(user, password) {
        if (world.authUsers.some((u) => u.email === user.email)) throw new Error('422 already registered');
        const created = {
          id: newId(world),
          email: user.email,
          password,
          metadata: { name: user.name, avatarEmoji: user.avatarEmoji, language: 'es' },
        };
        world.authUsers.push(created);
        return { id: created.id, email: created.email };
      },
      async setPassword(id, password) {
        const user = world.authUsers.find((u) => u.id === id);
        if (!user) throw new Error('404 User not found');
        user.password = password;
      },
    },
    async login(email, password) {
      const user = world.authUsers.find((u) => u.email === email && u.password === password);
      if (!user) throw new Error('400 invalid_grant');
      return `token:${user.id}`;
    },
    api(token) {
      return fakeApi(world, token.replace(/^token:/, ''));
    },
    passwords,
    savePassword(key, password) {
      saved[key] = password;
    },
    newPassword() {
      counter += 1;
      return `pw-${counter}`;
    },
    seedToday: '2026-10-01',
    now: new Date('2026-09-26T10:00:00Z'),
    log(message) {
      logs.push(message);
    },
  };
}
