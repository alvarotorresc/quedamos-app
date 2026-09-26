import { generatePassword, savePassword, type SeedConfig } from './env.js';
import { createRequester, type Requester } from './http.js';
import type { AvailabilityEntry, DemoUser, Slot, UserKey } from './plan.js';

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AdminClient {
  listUsers(): Promise<AuthUser[]>;
  createUser(user: DemoUser, password: string): Promise<AuthUser>;
  setPassword(id: string, password: string): Promise<void>;
}

export interface MeDto {
  id: string;
  name: string;
  language?: string;
}
export interface GroupDto {
  id: string;
  name: string;
  emoji?: string;
  createdById: string;
  members: { userId: string; role?: string }[];
}
export interface AvailabilityDto {
  userId: string;
  date: string;
}
export interface ProposalDto {
  id: string;
  title: string;
  votes?: { userId: string; vote: string }[];
}
export interface PollDto {
  id: string;
  date: string;
  slot: string | null;
  responses: { userId: string; answer: string }[];
}
export interface EventDto {
  id: string;
  title: string;
  date: string;
  time: string | null;
  status: string;
  attendees: { userId: string; status: string }[];
}

export interface Api {
  me(): Promise<MeDto>;
  listGroups(): Promise<GroupDto[]>;
  createGroup(name: string, emoji: string): Promise<GroupDto>;
  deleteGroup(groupId: string): Promise<void>;
  getInviteCode(groupId: string): Promise<string>;
  joinGroup(inviteCode: string): Promise<void>;
  listAvailability(groupId: string): Promise<AvailabilityDto[]>;
  addAvailability(groupId: string, entry: AvailabilityEntry): Promise<void>;
  listProposals(groupId: string): Promise<ProposalDto[]>;
  createProposal(
    groupId: string,
    body: { title: string; description: string; location: string; proposedDate: string },
  ): Promise<ProposalDto>;
  voteProposal(groupId: string, proposalId: string, vote: 'yes' | 'no'): Promise<void>;
  listPolls(groupId: string): Promise<PollDto[]>;
  createPoll(groupId: string, date: string, slot: Slot): Promise<PollDto>;
  respondPoll(groupId: string, pollId: string, answer: 'yes' | 'no' | 'unsure'): Promise<void>;
  listEvents(groupId: string): Promise<EventDto[]>;
  createEvent(
    groupId: string,
    body: { title: string; description: string; location: string; date: string; time: string },
  ): Promise<EventDto>;
  respondEvent(groupId: string, eventId: string, status: 'confirmed' | 'declined'): Promise<void>;
  deleteAccount(): Promise<void>;
}

/** Todo lo que necesitan seed, clean y verify; los tests lo sustituyen por un mundo en memoria. */
export interface Deps {
  admin: AdminClient;
  login(email: string, password: string): Promise<string>;
  api(token: string): Api;
  passwords: Partial<Record<UserKey, string>>;
  savePassword(key: UserKey, password: string): void;
  newPassword(): string;
  seedToday: string;
  now: Date;
  log(message: string): void;
}

const PAGE_SIZE = 200;

export function createAdminClient(request: Requester, supabaseUrl: string, serviceKey: string): AdminClient {
  const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };
  return {
    async listUsers() {
      const all: AuthUser[] = [];
      for (let page = 1; ; page++) {
        const res = await request<{ users: AuthUser[] }>(
          'GET',
          `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${PAGE_SIZE}`,
          { headers },
        );
        all.push(...res.users);
        if (res.users.length < PAGE_SIZE) return all;
      }
    },
    async createUser(user, password) {
      return request<AuthUser>('POST', `${supabaseUrl}/auth/v1/admin/users`, {
        headers,
        body: {
          email: user.email,
          password,
          email_confirm: true,
          user_metadata: { name: user.name, avatarEmoji: user.avatarEmoji, language: 'es' },
        },
      });
    },
    async setPassword(id, password) {
      await request<unknown>('PUT', `${supabaseUrl}/auth/v1/admin/users/${id}`, { headers, body: { password } });
    },
  };
}

export async function login(
  request: Requester,
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<string> {
  const res = await request<{ access_token?: string }>(
    'POST',
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    { headers: { apikey: anonKey }, body: { email, password } },
  );
  if (!res?.access_token) throw new Error(`El login de ${email} no devolvió access_token`);
  return res.access_token;
}

export function createApi(request: Requester, apiUrl: string, token: string): Api {
  const headers = { authorization: `Bearer ${token}` };
  const call = <T>(method: string, path: string, body?: unknown): Promise<T> =>
    request<T>(method, `${apiUrl}${path}`, { headers, body });
  const g = (groupId: string): string => `/groups/${groupId}`;
  return {
    me: () => call<MeDto>('GET', '/auth/me'),
    listGroups: () => call<GroupDto[]>('GET', '/groups'),
    createGroup: (name, emoji) => call<GroupDto>('POST', '/groups', { name, emoji }),
    deleteGroup: async (groupId) => {
      await call<unknown>('DELETE', g(groupId));
    },
    getInviteCode: async (groupId) => (await call<{ inviteCode: string }>('GET', `${g(groupId)}/invite`)).inviteCode,
    joinGroup: async (inviteCode) => {
      await call<unknown>('POST', '/groups/join', { inviteCode });
    },
    listAvailability: (groupId) => call<AvailabilityDto[]>('GET', `${g(groupId)}/availability`),
    addAvailability: async (groupId, entry) => {
      await call<unknown>('POST', `${g(groupId)}/availability`, {
        date: entry.date,
        type: entry.type,
        slots: entry.slots,
        startTime: entry.startTime,
        endTime: entry.endTime,
      });
    },
    listProposals: (groupId) => call<ProposalDto[]>('GET', `${g(groupId)}/proposals`),
    createProposal: (groupId, body) => call<ProposalDto>('POST', `${g(groupId)}/proposals`, body),
    voteProposal: async (groupId, proposalId, vote) => {
      await call<unknown>('POST', `${g(groupId)}/proposals/${proposalId}/vote`, { vote });
    },
    listPolls: (groupId) => call<PollDto[]>('GET', `${g(groupId)}/polls`),
    createPoll: (groupId, date, slot) => call<PollDto>('POST', `${g(groupId)}/polls`, { date, slot }),
    respondPoll: async (groupId, pollId, answer) => {
      await call<unknown>('POST', `${g(groupId)}/polls/${pollId}/respond`, { answer });
    },
    listEvents: (groupId) => call<EventDto[]>('GET', `${g(groupId)}/events`),
    createEvent: (groupId, body) => call<EventDto>('POST', `${g(groupId)}/events`, body),
    respondEvent: async (groupId, eventId, status) => {
      await call<unknown>('POST', `${g(groupId)}/events/${eventId}/respond`, { status });
    },
    deleteAccount: async () => {
      await call<unknown>('DELETE', '/auth/me');
    },
  };
}

export function createRealDeps(cfg: SeedConfig): Deps {
  const request = createRequester();
  return {
    admin: createAdminClient(request, cfg.supabaseUrl, cfg.serviceKey),
    login: (email, password) => login(request, cfg.supabaseUrl, cfg.anonKey, email, password),
    api: (token) => createApi(request, cfg.apiUrl, token),
    passwords: cfg.passwords,
    savePassword: (key, password) => savePassword(cfg.seedEnvPath, key, password),
    newPassword: generatePassword,
    seedToday: cfg.seedToday,
    now: new Date(),
    log: (message) => console.log(message),
  };
}
