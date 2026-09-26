// Llamadas mínimas a la API de producción que necesita el rodaje. Nunca imprime tokens.
import { setTimeout as sleep } from 'node:timers/promises';

export interface ApiAttendee {
  userId: string;
  status: 'pending' | 'confirmed' | 'declined';
}

export interface ApiEvent {
  id: string;
  title: string;
  date: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdById?: string;
  createdBy?: { id: string };
  attendees: ApiAttendee[];
}

export interface ApiPoll {
  id: string;
  date: string;
  status: string;
  responses: Array<{ userId: string }>;
}

export interface ApiGroup {
  id: string;
  name: string;
}

// Los @Throttle de la API son por IP: mismo margen que media/seed (http.ts paceFor).
const RESPOND_GAP_MS = 3_500;
let lastRespondAt = 0;

export class RodajeApi {
  private readonly apiUrl: string;
  private readonly token: string;
  readonly label: string;

  constructor(apiUrl: string, token: string, label: string) {
    this.apiUrl = apiUrl.replace(/\/+$/, '');
    this.token = token;
    this.label = label;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { authorization: `Bearer ${this.token}` };
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      // Solo método, ruta y estado: el cuerpo de error de la API no lleva secretos, pero se corta.
      throw new Error(`${this.label}: ${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')} -> ${res.status} ${text.slice(0, 200)}`);
    }
    return (text ? JSON.parse(text) : undefined) as T;
  }

  me(): Promise<{ id: string }> {
    return this.call('GET', '/auth/me');
  }

  listGroups(): Promise<ApiGroup[]> {
    return this.call('GET', '/groups');
  }

  listEvents(groupId: string): Promise<ApiEvent[]> {
    return this.call('GET', `/groups/${groupId}/events`);
  }

  listPolls(groupId: string): Promise<ApiPoll[]> {
    return this.call('GET', `/groups/${groupId}/polls`);
  }

  async respondEvent(groupId: string, eventId: string, status: 'confirmed' | 'declined'): Promise<void> {
    const wait = lastRespondAt + RESPOND_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRespondAt = Date.now();
    await this.call('POST', `/groups/${groupId}/events/${eventId}/respond`, { status });
  }

  async deleteEvent(groupId: string, eventId: string): Promise<void> {
    await this.call('DELETE', `/groups/${groupId}/events/${eventId}`);
  }
}
