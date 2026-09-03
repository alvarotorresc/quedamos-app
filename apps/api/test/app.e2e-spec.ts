import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthGuard } from '../src/auth/auth.guard';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { getFrontendUrl } from '../src/common/frontend-url';
import { NotificationsService } from '../src/notifications/notifications.service';
import { TEST_USER_HEADER, TestAuthGuard } from './test-auth.guard';

/**
 * HTTP end-to-end flow against a real Postgres (DATABASE_URL, migrations applied):
 * Alice creates a group, Bob joins with the code, Bob marks a day, Alice creates an
 * event, Bob confirms it; Carol, who is not a member, sees nothing; anonymous requests
 * are rejected. Firebase stays off and the three send methods are mocked, so no push
 * leaves the process.
 */

// AuthService builds its JWKS client from this URL at construction time; nothing is
// fetched unless a real JWT arrives, which this suite never sends.
process.env.SUPABASE_URL ??= 'https://example.supabase.co';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL must point to a disposable Postgres with the migrations applied ' +
      '(see the migrations job in .github/workflows/ci.yml)',
  );
}

interface TestUser {
  id: string;
  email: string;
  name: string;
}

function makeUser(name: string, suffix: string): TestUser {
  return { id: randomUUID(), email: `${name.toLowerCase()}-${suffix}@example.com`, name };
}

/** Header that makes the request run as `user` (see TestAuthGuard). */
function as(user: TestUser): Record<string, string> {
  return { [TEST_USER_HEADER]: user.id };
}

/** Tomorrow in UTC as YYYY-MM-DD: events cannot be created in the past. */
function tomorrowUTC(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** An 8-digit code that differs from `code` in its last digit. */
function otherCode(code: string): string {
  const last = (Number(code.slice(-1)) + 1) % 10;
  return `${code.slice(0, -1)}${last}`;
}

describe('API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sendToGroup: jest.SpyInstance;
  let sendToEventAttendees: jest.SpyInstance;

  const suffix = randomUUID().slice(0, 8);
  const alice = makeUser('Alice', suffix);
  const bob = makeUser('Bob', suffix);
  const carol = makeUser('Carol', suffix);
  const date = tomorrowUTC();

  let groupId = '';
  let inviteCode = '';
  let eventId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AuthGuard)
      .useClass(TestAuthGuard)
      .compile();

    app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
    // Same global pipes and filter as main.ts: validation errors and 404s must look
    // exactly like production.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    const notifications = app.get(NotificationsService);
    jest.spyOn(notifications, 'sendToUser').mockResolvedValue({ sent: 0 });
    sendToGroup = jest.spyOn(notifications, 'sendToGroup').mockResolvedValue({ sent: 0 });
    sendToEventAttendees = jest
      .spyOn(notifications, 'sendToEventAttendees')
      .mockResolvedValue({ sent: 0 });

    await prisma.user.createMany({ data: [alice, bob, carol] });
  });

  afterAll(async () => {
    if (groupId) {
      await prisma.group.deleteMany({ where: { id: groupId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [alice.id, bob.id, carol.id] } } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('GET /health answers ok with Firebase off', async () => {
    const res = await http().get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', firebaseInitialized: false });
  });

  it('rejects anonymous and malformed credentials with 401', async () => {
    await http().get('/groups').expect(401);
    await http().get('/groups').set('Authorization', 'Bearer not-a-jwt').expect(401);
    await http().get('/groups').set(TEST_USER_HEADER, randomUUID()).expect(401);
  });

  it('Alice creates a group and is its admin', async () => {
    const res = await http()
      .post('/groups')
      .set(as(alice))
      .send({ name: `Cuadrilla ${suffix}`, emoji: '🎉' })
      .expect(201);

    groupId = res.body.id;
    expect(groupId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.name).toBe(`Cuadrilla ${suffix}`);
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0]).toMatchObject({ userId: alice.id, role: 'admin' });
    // SEC-18: the code is only served by /invite.
    expect(res.body.inviteCode).toBeUndefined();
  });

  it('rejects a body with unknown fields', async () => {
    await http()
      .post('/groups')
      .set(as(alice))
      .send({ name: 'Otra', createdById: bob.id })
      .expect(400);
  });

  it('Alice reads the invite code and link', async () => {
    const res = await http().get(`/groups/${groupId}/invite`).set(as(alice)).expect(200);

    inviteCode = res.body.inviteCode;
    expect(inviteCode).toMatch(/^\d{8}$/);
    expect(res.body.inviteUrl).toBe(`${getFrontendUrl()}/join/${inviteCode}`);
  });

  it('the public invite link redirects to the app and hides unknown codes', async () => {
    const res = await http().get(`/join/${inviteCode}`).expect(302);
    expect(res.headers.location).toBe(`${getFrontendUrl()}/join/${inviteCode}`);

    await http().get('/join/abc').expect(400);
    await http()
      .get(`/join/${otherCode(inviteCode)}`)
      .expect(404);
  });

  it('Bob joins with the code and the group is notified', async () => {
    const res = await http().post('/groups/join').set(as(bob)).send({ inviteCode }).expect(201);

    expect(res.body.id).toBe(groupId);
    expect(res.body.members.map((m: { userId: string }) => m.userId).sort()).toEqual(
      [alice.id, bob.id].sort(),
    );
    expect(sendToGroup).toHaveBeenCalledWith(
      groupId,
      'Nuevo miembro',
      expect.stringContaining('Bob'),
      bob.id,
      expect.objectContaining({ type: 'member_joined', groupId }),
      'member_joined',
    );
  });

  it('joining twice is a conflict', async () => {
    await http().post('/groups/join').set(as(bob)).send({ inviteCode }).expect(409);
  });

  it('Bob marks a whole day and Alice sees it', async () => {
    await http()
      .post(`/groups/${groupId}/availability`)
      .set(as(bob))
      .send({ date, type: 'day' })
      .expect(201);

    const res = await http().get(`/groups/${groupId}/availability`).set(as(alice)).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ userId: bob.id, type: 'day' });
    expect(res.body[0].date).toContain(date);
  });

  it('Alice creates an event and every member is invited', async () => {
    sendToGroup.mockClear();

    const res = await http()
      .post(`/groups/${groupId}/events`)
      .set(as(alice))
      .send({ title: 'Cena', date, time: '21:00' })
      .expect(201);

    eventId = res.body.id;
    expect(res.body.status).toBe('pending');
    expect(res.body.attendees).toHaveLength(2);
    const statusOf = (user: TestUser) =>
      res.body.attendees.find((a: { userId: string }) => a.userId === user.id)?.status;
    expect(statusOf(alice)).toBe('confirmed');
    expect(statusOf(bob)).toBe('pending');
    expect(sendToGroup).toHaveBeenCalledWith(
      groupId,
      'Nueva quedada',
      expect.stringContaining('Cena'),
      alice.id,
      expect.objectContaining({ type: 'new_event', eventId, groupId }),
      'new_event',
    );
  });

  it('Bob confirms and the event becomes confirmed', async () => {
    await http()
      .post(`/groups/${groupId}/events/${eventId}/respond`)
      .set(as(bob))
      .send({ status: 'confirmed' })
      .expect(201);

    const res = await http().get(`/groups/${groupId}/events/${eventId}`).set(as(alice)).expect(200);
    expect(res.body.status).toBe('confirmed');
    expect(res.body.attendees.every((a: { status: string }) => a.status === 'confirmed')).toBe(
      true,
    );
    expect(sendToEventAttendees).toHaveBeenCalledWith(
      eventId,
      'Quedada confirmada',
      expect.stringContaining('Cena'),
      undefined,
      expect.objectContaining({ type: 'event_confirmed', eventId, groupId }),
      'event_confirmed',
      'confirmed',
    );
  });

  it('Carol, who is not a member, gets 404 on the group and its contents', async () => {
    await http().get(`/groups/${groupId}`).set(as(carol)).expect(404);
    await http().get(`/groups/${groupId}/events`).set(as(carol)).expect(404);
    await http().get(`/groups/${groupId}/events/${eventId}`).set(as(carol)).expect(404);
    await http().get(`/groups/${groupId}/availability`).set(as(carol)).expect(404);
    await http().get(`/groups/${groupId}/invite`).set(as(carol)).expect(404);
    await http()
      .post(`/groups/${groupId}/events`)
      .set(as(carol))
      .send({ title: 'Colada', date })
      .expect(404);

    const res = await http().get('/groups').set(as(carol)).expect(200);
    expect(res.body).toEqual([]);
  });

  it('only members see the group in their list', async () => {
    const res = await http().get('/groups').set(as(bob)).expect(200);
    expect(res.body.map((g: { id: string }) => g.id)).toEqual([groupId]);
  });
});
