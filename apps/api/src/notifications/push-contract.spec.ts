import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { createMockPrisma, createMockConfigService } from '../common/test-utils';
import { NOTIFICATION_TYPES } from './dto/update-preference.dto';
import { buildPushCopy, PushCopyType, PUSH_COPY_TYPES } from './push-copy';
import { PUSH_LANGUAGES, PushLanguage } from './push-language';

const mockSendEachForMulticast = jest.fn();
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  cert: jest.fn().mockReturnValue({}),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn().mockReturnValue({
    sendEachForMulticast: (...args: unknown[]) => mockSendEachForMulticast(...args),
  }),
}));

/**
 * The contract of every push the API sends: who gets it, what it says in each language,
 * and which keys the client can count on finding in `data` to route the tap.
 *
 * This table is the single place where all of that is written down. Add a notification
 * type without copy in both languages, or change a text by accident, and this fails.
 */

/** Who a notification reaches, as the services resolve it today. */
type RecipientRule =
  | 'group except the actor'
  | 'event attendees except the actor'
  | 'confirmed attendees except the actor'
  | 'the target user only';

interface ContractRow {
  recipients: RecipientRule;
  /** Everything the copy interpolates. */
  params: Record<string, unknown>;
  /** Keys the payload must carry besides `type`, as each service emits them today. */
  dataKeys: string[];
  es: { title: string; body: string };
  en: { title: string; body: string };
  /** Localized `data` extras the copy itself contributes. */
  extraData?: { es: Record<string, string>; en: Record<string, string> };
}

const MONDAY = new Date('2026-09-07T00:00:00Z');

const CONTRACT: Record<PushCopyType, ContractRow> = {
  new_event: {
    recipients: 'group except the actor',
    params: { actorName: 'Ana', title: 'Cena' },
    dataKeys: ['eventId', 'groupId'],
    es: { title: 'Nueva quedada', body: 'Ana ha creado "Cena"' },
    en: { title: 'New plan', body: 'Ana created "Cena"' },
  },
  event_updated: {
    recipients: 'event attendees except the actor',
    params: { title: 'Cena' },
    dataKeys: ['eventId', 'groupId'],
    es: { title: 'Quedada actualizada', body: '"Cena" ha sido editada' },
    en: { title: 'Plan updated', body: '"Cena" has been edited' },
  },
  event_deleted: {
    recipients: 'event attendees except the actor',
    params: { title: 'Cena' },
    dataKeys: ['eventId', 'groupId'],
    es: { title: 'Quedada eliminada', body: '"Cena" ha sido eliminada' },
    en: { title: 'Plan deleted', body: '"Cena" has been deleted' },
  },
  event_cancelled: {
    recipients: 'event attendees except the actor',
    params: { title: 'Cena' },
    dataKeys: ['eventId', 'groupId'],
    es: { title: 'Quedada cancelada', body: '"Cena" ha sido cancelada' },
    en: { title: 'Plan cancelled', body: '"Cena" has been cancelled' },
  },
  // Two bodies under one type: the creator confirming by hand, and the last attendee
  // completing the round. The recompute after a member leaves has no actor and reaches
  // every confirmed attendee.
  event_confirmed: {
    recipients: 'confirmed attendees except the actor',
    params: { title: 'Cena', variant: 'all_confirmed' },
    dataKeys: ['eventId', 'groupId'],
    es: { title: 'Quedada confirmada', body: 'Todos han confirmado "Cena"' },
    en: { title: 'Plan confirmed', body: 'Everyone confirmed "Cena"' },
  },
  event_declined: {
    recipients: 'confirmed attendees except the actor',
    params: { actorName: 'Ana', title: 'Cena' },
    dataKeys: ['eventId', 'groupId'],
    es: { title: 'Asistencia rechazada', body: 'Ana ha rechazado "Cena"' },
    en: { title: 'Attendance declined', body: 'Ana declined "Cena"' },
  },
  event_reminder: {
    recipients: 'the target user only',
    params: { title: 'Cena' },
    dataKeys: ['eventId', 'groupId'],
    es: { title: 'Recordatorio', body: '"Cena" es mañana' },
    en: { title: 'Reminder', body: '"Cena" is tomorrow' },
  },
  new_proposal: {
    recipients: 'group except the actor',
    params: { actorName: 'Ana', title: 'Cena' },
    dataKeys: ['proposalId', 'groupId'],
    es: { title: 'Nueva propuesta', body: 'Ana propone "Cena"' },
    en: { title: 'New proposal', body: 'Ana proposes "Cena"' },
  },
  proposal_voted: {
    recipients: 'group except the actor',
    params: { actorName: 'Ana', title: 'Cena', vote: 'yes' },
    dataKeys: ['proposalId', 'groupId'],
    es: { title: 'Voto en propuesta', body: 'Ana ha votado a favor en "Cena"' },
    en: { title: 'Proposal vote', body: 'Ana voted in favour on "Cena"' },
  },
  proposal_converted: {
    recipients: 'group except the actor',
    params: { title: 'Cena' },
    dataKeys: ['proposalId', 'groupId', 'eventId'],
    es: { title: 'Propuesta convertida', body: '"Cena" se ha convertido en quedada' },
    en: { title: 'Proposal converted', body: '"Cena" is now a plan' },
  },
  new_poll: {
    recipients: 'group except the actor',
    params: { actorName: 'Ana', groupName: 'Cuadrilla', date: MONDAY, slot: null },
    dataKeys: ['pollId', 'groupId', 'date'],
    es: { title: '¿Puedes el lunes?', body: 'Pregunta Ana · Cuadrilla' },
    en: { title: 'Can you make Monday?', body: 'Ana is asking · Cuadrilla' },
    extraData: {
      es: { yesLabel: 'Puedo', noLabel: 'No puedo' },
      en: { yesLabel: 'I can', noLabel: "I can't" },
    },
  },
  // The recompute after a member leaves has no actor and reaches the whole group.
  poll_completed: {
    recipients: 'group except the actor',
    params: { date: MONDAY },
    dataKeys: ['pollId', 'groupId'],
    es: { title: 'El aro se cierra', body: 'Podéis todos el lunes' },
    en: { title: 'The ring closes', body: 'You can all make Monday' },
  },
  member_joined: {
    recipients: 'group except the actor',
    params: { actorName: 'Ana', groupName: 'Cuadrilla' },
    dataKeys: ['groupId'],
    es: { title: 'Nuevo miembro', body: 'Ana se ha unido a "Cuadrilla"' },
    en: { title: 'New member', body: 'Ana joined "Cuadrilla"' },
  },
  member_left: {
    recipients: 'group except the actor',
    params: { actorName: 'Ana', groupName: 'Cuadrilla' },
    dataKeys: ['groupId'],
    es: { title: 'Miembro salió', body: 'Ana ha salido de "Cuadrilla"' },
    en: { title: 'Member left', body: 'Ana left "Cuadrilla"' },
  },
  role_changed: {
    recipients: 'the target user only',
    params: { role: 'admin' },
    dataKeys: ['groupId'],
    es: { title: 'Rol actualizado', body: 'Tu rol ha cambiado a administrador' },
    en: { title: 'Role updated', body: 'Your role has been changed to admin' },
  },
  member_kicked: {
    recipients: 'the target user only',
    params: { groupName: 'Cuadrilla' },
    dataKeys: ['groupId'],
    es: { title: 'Te han sacado del grupo', body: 'Ya no formas parte de "Cuadrilla"' },
    en: { title: 'Removed from group', body: 'You are no longer part of "Cuadrilla"' },
  },
  group_deleted: {
    recipients: 'group except the actor',
    params: { groupName: 'Cuadrilla' },
    dataKeys: ['groupId'],
    es: { title: 'Grupo eliminado', body: 'El grupo "Cuadrilla" ha sido eliminado' },
    en: { title: 'Group deleted', body: 'The group "Cuadrilla" has been deleted' },
  },
  weekly_availability_reminder: {
    recipients: 'the target user only',
    params: {},
    dataKeys: [],
    es: {
      title: 'Marca tu disponibilidad',
      body: 'Todavía no has marcado disponibilidad para la semana que viene',
    },
    en: {
      title: 'Mark your availability',
      body: "You haven't marked your availability for next week yet",
    },
  },
  test: {
    recipients: 'the target user only',
    params: {},
    dataKeys: [],
    es: { title: 'Notificación de prueba', body: 'Si ves esto, las notificaciones funcionan' },
    en: { title: 'Test notification', body: 'If you see this, notifications are working!' },
  },
};

type LooseSend = (
  groupId: string,
  type: PushCopyType,
  params: Record<string, unknown>,
  excludeUserId?: string,
  data?: Record<string, string>,
) => Promise<unknown>;

const SAMPLE_DATA: Record<string, string> = {
  eventId: 'event-1',
  groupId: 'group-1',
  proposalId: 'proposal-1',
  pollId: 'poll-1',
  date: '2026-09-07',
};

describe('push contract', () => {
  const rows = Object.entries(CONTRACT) as [PushCopyType, ContractRow][];

  it('should cover every notification type, plus the test one', () => {
    expect(Object.keys(CONTRACT).sort()).toEqual([...PUSH_COPY_TYPES].sort());
    expect([...PUSH_COPY_TYPES].sort()).toEqual([...NOTIFICATION_TYPES, 'test'].sort());
  });

  it('should declare a recipient rule for every type', () => {
    const missing = rows.filter(([, row]) => !row.recipients).map(([type]) => type);

    expect(missing).toEqual([]);
  });

  describe.each(PUSH_LANGUAGES)('copy in %s', (language: PushLanguage) => {
    it.each(rows)('%s', (type, row) => {
      const copy = buildPushCopy(type, language, row.params as never);

      expect(copy.title).toBe(row[language].title);
      expect(copy.body).toBe(row[language].body);
    });

    it('should leave no title or body empty', () => {
      const empty = rows
        .map(([type, row]) => [type, buildPushCopy(type, language, row.params as never)] as const)
        .filter(([, copy]) => !copy.title || !copy.body)
        .map(([type]) => type);

      expect(empty).toEqual([]);
    });

    it('should not fall back to the other language', () => {
      const other: PushLanguage = language === 'es' ? 'en' : 'es';
      const untranslated = rows
        .filter(([, row]) => row[language].title === row[other].title)
        .map(([type]) => type);

      expect(untranslated).toEqual([]);
    });
  });

  describe('payload', () => {
    let service: NotificationsService;
    let prisma: ReturnType<typeof createMockPrisma>;

    function send(type: PushCopyType, row: ContractRow, language: PushLanguage) {
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', language }]);
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'user-1', token: 'tok-1', platform: 'android', user: { language } },
      ]);
      const data = Object.fromEntries(row.dataKeys.map((key) => [key, SAMPLE_DATA[key]]));
      return (service.sendToGroup as unknown as LooseSend)(
        'group-1',
        type,
        row.params,
        undefined,
        data,
      );
    }

    beforeEach(() => {
      jest.clearAllMocks();
      prisma = createMockPrisma();
      prisma.groupMember.findMany.mockResolvedValue([{ userId: 'user-1' }]);
      prisma.notificationPreference.findMany.mockResolvedValue([]);
      prisma.notificationLog.create.mockResolvedValue({});
      prisma.notification.createMany.mockResolvedValue({ count: 1 });
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });
      service = new NotificationsService(
        prisma as unknown as PrismaService,
        createMockConfigService() as unknown as ConfigService,
      );
      service.onModuleInit();
    });

    it.each(rows)('%s carries its routing keys and its type', async (type, row) => {
      await send(type, row, 'es');

      const [[message]] = mockSendEachForMulticast.mock.calls;
      expect(message.data.type).toBe(type);
      expect(message.data).toEqual(
        expect.objectContaining(
          Object.fromEntries(row.dataKeys.map((key) => [key, SAMPLE_DATA[key]])),
        ),
      );
    });

    it.each(rows)('%s sends the copy of the reader, not of the sender', async (type, row) => {
      await send(type, row, 'en');

      const [[message]] = mockSendEachForMulticast.mock.calls;
      expect(message.notification).toEqual(row.en);
    });

    /**
     * The bandeja is written from the same fan-out as the push, so the contract covers
     * it too: same text, same routing keys, in the reader's language. `test` is the one
     * exception — a debug send is not a notice anybody should find in their inbox.
     */
    it.each(rows.filter(([type]) => type !== 'test'))(
      '%s lands in the inbox with the same copy and routing',
      async (type, row) => {
        await send(type, row, 'en');

        const [[{ data: inboxRows }]] = prisma.notification.createMany.mock.calls;
        expect(inboxRows).toHaveLength(1);
        expect(inboxRows[0]).toEqual(
          expect.objectContaining({
            userId: 'user-1',
            type,
            title: row.en.title,
            body: row.en.body,
          }),
        );
        expect(inboxRows[0].data).toEqual(
          expect.objectContaining({
            type,
            ...Object.fromEntries(row.dataKeys.map((key) => [key, SAMPLE_DATA[key]])),
          }),
        );
      },
    );

    it('does not put the test notification in the inbox', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', language: 'es' }]);
      prisma.pushToken.findMany.mockResolvedValue([
        { userId: 'user-1', token: 'tok-1', platform: 'android', user: { language: 'es' } },
      ]);

      await service.sendTestNotification('user-1', {});

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
    });

    it.each(rows.filter(([, row]) => row.extraData))(
      '%s ships its localized data extras',
      async (type, row) => {
        for (const language of PUSH_LANGUAGES) {
          jest.clearAllMocks();
          mockSendEachForMulticast.mockResolvedValue({
            successCount: 1,
            failureCount: 0,
            responses: [{ success: true }],
          });

          await send(type, row, language);

          const [[message]] = mockSendEachForMulticast.mock.calls;
          expect(message.data).toEqual(expect.objectContaining(row.extraData![language]));
        }
      },
    );
  });
});
