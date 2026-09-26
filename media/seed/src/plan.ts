export const USER_KEYS = ['marta', 'hugo', 'noa', 'leo', 'julia'] as const;
export type UserKey = (typeof USER_KEYS)[number];

export interface DemoUser {
  key: UserKey;
  name: string;
  email: string;
  avatarEmoji: string;
}

export const DEMO_USERS: readonly DemoUser[] = [
  { key: 'marta', name: 'Marta', email: 'demo-marta@quedamos.alvarotc.com', avatarEmoji: '🌻' },
  { key: 'hugo', name: 'Hugo', email: 'demo-hugo@quedamos.alvarotc.com', avatarEmoji: '🚲' },
  { key: 'noa', name: 'Noa', email: 'demo-noa@quedamos.alvarotc.com', avatarEmoji: '🎧' },
  { key: 'leo', name: 'Leo', email: 'demo-leo@quedamos.alvarotc.com', avatarEmoji: '🏔️' },
  { key: 'julia', name: 'Julia', email: 'demo-julia@quedamos.alvarotc.com', avatarEmoji: '📸' },
];

export const GROUP_SPEC = { name: 'Ruta 2026', emoji: '🥾' } as const;

export const EVENT_SPEC = {
  title: 'Ruta por la sierra',
  description: 'Salimos desde Cercedilla. Agua, gorra y bocata.',
  location: 'Sierra de Guadarrama',
  time: '10:00',
} as const;

export const PROPOSAL_CREATOR: UserKey = 'hugo';
export const PROPOSAL_SPEC = {
  title: 'Cena después de la ruta',
  description: 'Algo sencillo cerca de la estación.',
  location: 'Cercedilla',
} as const;
export const PROPOSAL_VOTES: Partial<Record<UserKey, 'yes' | 'no'>> = {
  marta: 'yes',
  noa: 'yes',
  leo: 'no',
  julia: 'yes',
};

export type Slot = 'Mañana' | 'Tarde' | 'Noche';

export const POLL_CREATOR: UserKey = 'leo';
export const POLL_SLOT: Slot = 'Noche';
export const POLL_ANSWERS: Partial<Record<UserKey, 'yes' | 'no' | 'unsure'>> = {
  leo: 'yes',
  marta: 'yes',
  hugo: 'unsure',
  noa: 'no',
  julia: 'yes',
};

export interface AvailabilityEntry {
  user: UserKey;
  date: string;
  type: 'day' | 'slots' | 'range';
  slots?: Slot[];
  startTime?: string;
  endTime?: string;
}

export function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Fecha no válida: ${value} (se espera YYYY-MM-DD)`);
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    throw new Error(`Fecha no válida: ${value} (no existe en el calendario)`);
  }
  return date;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function utcToday(now: Date): string {
  return formatIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
}

export function monthDays(seedToday: string): string[] {
  const start = parseIsoDate(seedToday);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const days: string[] = [];
  for (let day = 1; ; day++) {
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCMonth() !== month) break;
    days.push(formatIsoDate(date));
  }
  return days;
}

function weekday(isoDate: string): number {
  return parseIsoDate(isoDate).getUTCDay();
}

export function buildAvailability(seedToday: string): AvailabilityEntry[] {
  const entries: AvailabilityEntry[] = [];
  let firstSaturday = true;
  for (const date of monthDays(seedToday)) {
    const day = weekday(date);
    if (day === 6) {
      const who = firstSaturday ? USER_KEYS.filter((key) => key !== 'leo') : [...USER_KEYS];
      firstSaturday = false;
      for (const user of who) entries.push({ user, date, type: 'day' });
    } else if (day === 5) {
      for (const user of ['marta', 'hugo', 'noa'] as const) {
        entries.push({ user, date, type: 'slots', slots: ['Tarde', 'Noche'] });
      }
    } else if (day === 3) {
      for (const user of ['marta', 'leo', 'julia'] as const) {
        entries.push({ user, date, type: 'range', startTime: '19:00', endTime: '22:00' });
      }
    } else if (day === 0) {
      for (const user of ['hugo', 'julia'] as const) {
        entries.push({ user, date, type: 'slots', slots: ['Mañana'] });
      }
    }
  }
  return entries;
}

export function countByDate(entries: readonly AvailabilityEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.date, (counts.get(entry.date) ?? 0) + 1);
  return counts;
}

function pickDate(
  entries: readonly AvailabilityEntry[],
  want: { weekday: number; count: number },
  seedToday: string,
  now: Date,
): string {
  const today = utcToday(now);
  const floor = seedToday > today ? seedToday : today;
  const counts = countByDate(entries);
  const hit = [...counts.keys()]
    .sort()
    .find((date) => date >= floor && weekday(date) === want.weekday && counts.get(date) === want.count);
  if (!hit) {
    throw new Error(
      `No queda ningún día (día de la semana ${want.weekday}, ${want.count} personas) desde ${floor} ` +
        'en el mes de SEED_TODAY: elige un SEED_TODAY más temprano en el mes o del mes que viene',
    );
  }
  return hit;
}

export function pickEventDate(entries: readonly AvailabilityEntry[], seedToday: string, now: Date): string {
  return pickDate(entries, { weekday: 6, count: USER_KEYS.length }, seedToday, now);
}

export function pickPollDate(entries: readonly AvailabilityEntry[], seedToday: string, now: Date): string {
  return pickDate(entries, { weekday: 5, count: 3 }, seedToday, now);
}
