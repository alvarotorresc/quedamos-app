import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterTokenDto } from './dto/register-token.dto';
import {
  UpdatePreferenceDto,
  NotificationType,
  NOTIFICATION_TYPES,
} from './dto/update-preference.dto';
import { buildPushCopy, PushCopy, PushCopyParams, PushCopyType } from './push-copy';
import { normalizePushLanguage, PushLanguage } from './push-language';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseInitialized = false;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials not configured — push notifications disabled');
      return;
    }

    const pem = this.resolvePrivateKey(privateKey);
    if (!pem) {
      this.logger.error(
        'FIREBASE_PRIVATE_KEY is neither a base64-encoded PEM nor a raw PEM — push notifications disabled. ' +
          'Provide the service account private_key base64-encoded (recommended) or as raw PEM.',
      );
      return;
    }

    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: pem,
        }),
      });
      this.firebaseInitialized = true;
      this.logger.log('Firebase Admin SDK initialized');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Firebase Admin SDK — push notifications disabled',
        error,
      );
    }
  }

  private resolvePrivateKey(rawValue: string): string | null {
    const decoded = Buffer.from(rawValue, 'base64').toString('utf-8');
    if (decoded.startsWith('-----BEGIN')) {
      return decoded;
    }

    const unescaped = rawValue.replace(/\\n/g, '\n');
    if (unescaped.startsWith('-----BEGIN')) {
      this.logger.warn('FIREBASE_PRIVATE_KEY is not base64 — falling back to raw PEM value');
      return unescaped;
    }

    return null;
  }

  isFirebaseInitialized(): boolean {
    return this.firebaseInitialized;
  }

  private static readonly MAX_TOKENS_PER_USER = 10;

  async registerToken(userId: string, dto: RegisterTokenDto) {
    const registered = await this.prisma.pushToken.upsert({
      where: {
        userId_token: {
          userId,
          token: dto.token,
        },
      },
      update: {
        platform: dto.platform,
        updatedAt: new Date(),
      },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
      },
    });

    // LRU eviction, ordered by last registration and applied AFTER the upsert:
    // the device that re-registers on every resume stays at the top instead of
    // being the first to fall for having been added first, the token just
    // registered can never be its own victim, and two concurrent registrations
    // both converge on the cap instead of racing a count().
    const surplus = await this.prisma.pushToken.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      skip: NotificationsService.MAX_TOKENS_PER_USER,
      select: { id: true },
    });
    if (surplus.length > 0) {
      await this.prisma.pushToken.deleteMany({
        where: { id: { in: surplus.map((t) => t.id) } },
      });
    }

    return registered;
  }

  async unregisterToken(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({
      where: { userId, token },
    });

    return { success: true };
  }

  async getPreferences(userId: string) {
    const saved = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    const savedMap = new Map(saved.map((p) => [p.type, p.enabled]));

    return NOTIFICATION_TYPES.map((type) => ({
      type,
      enabled: savedMap.get(type) ?? true,
    }));
  }

  async updatePreference(userId: string, dto: UpdatePreferenceDto) {
    return this.prisma.notificationPreference.upsert({
      where: {
        userId_type: { userId, type: dto.type },
      },
      update: { enabled: dto.enabled },
      create: { userId, type: dto.type, enabled: dto.enabled },
    });
  }

  async isNotificationEnabled(userId: string, type: NotificationType): Promise<boolean> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_type: { userId, type },
      },
    });
    return pref?.enabled ?? true;
  }

  async sendToUser<T extends NotificationType>(
    userId: string,
    type: T,
    params: PushCopyParams<T>,
    data?: Record<string, string>,
  ) {
    const enabled = await this.isNotificationEnabled(userId, type);
    if (!enabled) return { sent: 0 };

    await this.persistInbox([userId], type, params, data);

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
      include: { user: { select: { language: true } } },
    });

    if (tokens.length === 0) return { sent: 0 };

    const result = await this.dispatch(
      tokens,
      type,
      (language) => buildPushCopy(type, language, params),
      data,
      type,
    );

    return { sent: result.sent };
  }

  async sendTestNotification(
    userId: string,
    dto: { type?: NotificationType; title?: string; body?: string },
  ): Promise<{ sent: number }> {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
      include: { user: { select: { language: true } } },
    });

    if (tokens.length === 0) return { sent: 0 };

    // Prefix the persisted type so test sends are distinguishable from real
    // notifications in notification_logs / getDebugInfo.
    const loggedType = dto.type ? `test:${dto.type}` : 'test';

    const result = await this.dispatch(
      tokens,
      'test',
      (language) => {
        const copy = buildPushCopy('test', language, {});
        return { title: dto.title ?? copy.title, body: dto.body ?? copy.body };
      },
      undefined,
      loggedType,
    );

    return { sent: result.sent };
  }

  async getDebugInfo(userId: string) {
    const [tokens, preferences, recentLogs] = await Promise.all([
      this.prisma.pushToken.findMany({
        where: { userId },
      }),
      this.getPreferences(userId),
      this.prisma.notificationLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return { tokens, preferences, recentLogs };
  }

  async sendToGroup<T extends NotificationType>(
    groupId: string,
    type: T,
    params: PushCopyParams<T>,
    excludeUserId?: string,
    data?: Record<string, string>,
  ) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
    });

    const allUserIds = members.map((m) => m.userId);
    let userIds = allUserIds.filter((id) => id !== excludeUserId);

    if (userIds.length > 0) {
      const disabledPrefs = await this.prisma.notificationPreference.findMany({
        where: { userId: { in: userIds }, type, enabled: false },
      });
      const disabledSet = new Set(disabledPrefs.map((p) => p.userId));
      userIds = userIds.filter((id) => !disabledSet.has(id));
    }

    this.logger.debug(
      `sendToGroup: group=${groupId}, members=${allUserIds.length}, exclude=${excludeUserId}, remaining=${userIds.length}`,
    );

    if (userIds.length === 0) return { sent: 0 };

    await this.persistInbox(userIds, type, params, data);

    const tokens = await this.prisma.pushToken.findMany({
      where: {
        userId: { in: userIds },
      },
      include: { user: { select: { language: true } } },
    });

    if (tokens.length === 0) return { sent: 0 };

    const result = await this.dispatch(
      tokens,
      type,
      (language) => buildPushCopy(type, language, params),
      data,
      type,
    );

    return { sent: result.sent, failed: result.failed, tokenCount: result.tokenCount };
  }

  async sendToEventAttendees<T extends NotificationType>(
    eventId: string,
    type: T,
    params: PushCopyParams<T>,
    excludeUserId?: string,
    data?: Record<string, string>,
    statusFilter?: string,
  ) {
    const where: Record<string, unknown> = { eventId };
    if (statusFilter) {
      where.status = statusFilter;
    }

    const attendees = await this.prisma.eventAttendee.findMany({ where });

    let userIds = attendees.map((a) => a.userId).filter((id) => id !== excludeUserId);

    if (userIds.length > 0) {
      const disabledPrefs = await this.prisma.notificationPreference.findMany({
        where: { userId: { in: userIds }, type, enabled: false },
      });
      const disabledSet = new Set(disabledPrefs.map((p) => p.userId));
      userIds = userIds.filter((id) => !disabledSet.has(id));
    }

    if (userIds.length === 0) return { sent: 0 };

    await this.persistInbox(userIds, type, params, data);

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      include: { user: { select: { language: true } } },
    });

    if (tokens.length === 0) return { sent: 0 };

    const result = await this.dispatch(
      tokens,
      type,
      (language) => buildPushCopy(type, language, params),
      data,
      type,
    );

    return { sent: result.sent, failed: result.failed, tokenCount: result.tokenCount };
  }

  /**
   * Writes the inbox row of every recipient, at the same point as the push and before
   * the `tokens.length === 0` early returns below.
   *
   * That order is the whole point: somebody with no device registered, or who never
   * granted the permission, still finds the notice in the bell. Preferences are already
   * resolved by the caller, so an opted-out type never reaches here — the bandeja shows
   * exactly what the push would have said.
   *
   * The language cannot be taken from the push tokens (a recipient without tokens has
   * none), so it is read from `users` in one query; that read is also what keeps a
   * recipient the table does not know out of the batch, since one bad FK would abort
   * the whole `createMany`. A failure is logged and swallowed: the inbox must never
   * cost a push.
   */
  private async persistInbox<T extends NotificationType>(
    userIds: string[],
    type: T,
    params: PushCopyParams<T>,
    data: Record<string, string> | undefined,
  ): Promise<void> {
    if (userIds.length === 0) return;

    try {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, language: true },
      });
      if (users.length === 0) return;

      const copyByLanguage = new Map<PushLanguage, PushCopy>();
      const copyFor = (language: PushLanguage): PushCopy => {
        const cached = copyByLanguage.get(language);
        if (cached) return cached;
        const built = buildPushCopy(type, language, params);
        copyByLanguage.set(language, built);
        return built;
      };

      const rows = users.map((user) => {
        const copy = copyFor(normalizePushLanguage(user.language));
        return {
          userId: user.id,
          type,
          title: copy.title,
          body: copy.body,
          data: { ...data, ...copy.data, type },
        };
      });

      await this.prisma.notification.createMany({ data: rows });
    } catch (error) {
      this.logger.error('Failed to persist inbox notifications', error);
    }
  }

  /**
   * One FCM batch per language present among the recipients. Before this, a group with a
   * Spanish and an English speaker got one Spanish text for everybody; now each batch
   * carries the copy of its own language, `data.type` is derived from the notification
   * type instead of being repeated at every call site, and the localized extras a copy
   * declares (the yes/no button labels of «la pregunta») ride along in `data`.
   */
  private async dispatch(
    tokens: RecipientToken[],
    type: PushCopyType,
    copyOf: (language: PushLanguage) => PushCopy,
    data: Record<string, string> | undefined,
    loggedType: string,
  ): Promise<SendResult> {
    const byLanguage = new Map<PushLanguage, RecipientToken[]>();
    for (const token of tokens) {
      const language = normalizePushLanguage(token.user?.language);
      const bucket = byLanguage.get(language);
      if (bucket) bucket.push(token);
      else byLanguage.set(language, [token]);
    }

    const outcomes = await Promise.all(
      [...byLanguage].map(async ([language, batch]) => {
        const copy = copyOf(language);
        const payload: Record<string, string> = { ...data, ...copy.data, type };
        const result = await this.sendToTokens(batch, copy.title, copy.body, payload);
        return { batch, copy, payload, result };
      }),
    );

    await Promise.all(
      outcomes.map(({ batch, copy, payload, result }) =>
        this.logNotificationPerUser(batch, copy.title, copy.body, payload, loggedType, result),
      ),
    );

    return {
      sent: outcomes.reduce((total, o) => total + o.result.sent, 0),
      failed: outcomes.reduce((total, o) => total + o.result.failed, 0),
      tokenCount: tokens.length,
    };
  }

  /**
   * Splits the send by platform to avoid duplicate web notifications.
   *
   * @firebase/messaging shows its own notification whenever the FCM payload carries a
   * top-level `notification` AND onBackgroundMessage also fires — the two are not
   * mutually exclusive. Our service worker's onBackgroundMessage already shows the
   * intended notification (with routing + action buttons), so the SDK's own copy was a
   * duplicate. Web tokens now get a data-only payload (no `notification`, no
   * `webpush.notification`); the SW and the foreground handler read title/body from
   * `data` instead. Android is unaffected — same payload shape as before.
   *
   * Any token whose platform isn't recognized as 'web' is treated as native/android
   * (today's full payload) — an unexpected or missing platform value must never silently
   * degrade to a data-only push a user can't see.
   */
  private async sendToTokens(
    tokens: TokenEntry[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<DetailedSendResult> {
    if (!this.firebaseInitialized) {
      this.logger.debug(
        `Would send "${title}" to ${tokens.length} devices (Firebase not initialized)`,
      );
      return {
        sent: 0,
        failed: 0,
        tokenCount: tokens.length,
        byToken: new Map(tokens.map((t) => [t.token, 'skipped' as TokenOutcome])),
      };
    }

    const webTokens = tokens.filter((t) => t.platform === 'web').map((t) => t.token);
    const androidTokens = tokens.filter((t) => t.platform !== 'web').map((t) => t.token);

    const empty = (): BatchResult => ({ sent: 0, failed: 0, byToken: new Map() });
    const [androidResult, webResult] = await Promise.all([
      androidTokens.length > 0
        ? this.sendBatch(androidTokens, this.buildAndroidMessage(androidTokens, title, body, data))
        : Promise.resolve(empty()),
      webTokens.length > 0
        ? this.sendBatch(webTokens, this.buildWebMessage(webTokens, title, body, data))
        : Promise.resolve(empty()),
    ]);

    const sent = androidResult.sent + webResult.sent;
    const failed = androidResult.failed + webResult.failed;

    this.logger.debug(`Sent "${title}" — ${sent} ok, ${failed} failed`);

    return {
      sent,
      failed,
      tokenCount: tokens.length,
      byToken: new Map([...androidResult.byToken, ...webResult.byToken]),
    };
  }

  private buildAndroidMessage(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): MulticastMessage {
    return {
      tokens,
      notification: { title, body },
      data,
      android: {
        notification: {
          channelId: 'default',
          icon: 'ic_launcher',
        },
      },
    };
  }

  private buildWebMessage(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): MulticastMessage {
    return {
      tokens,
      data: {
        ...data,
        title,
        body,
      },
    };
  }

  private async sendBatch(tokens: string[], message: MulticastMessage): Promise<BatchResult> {
    try {
      const response = await getMessaging().sendEachForMulticast(message);

      const byToken = new Map<string, TokenOutcome>();
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        byToken.set(tokens[idx], resp.error ? 'failed' : 'sent');
        if (resp.error) {
          this.logger.warn(
            `FCM error for token ${tokens[idx].slice(0, 8)}...: ${resp.error.code} — ${resp.error.message}`,
          );
          if (
            resp.error.code === 'messaging/registration-token-not-registered' ||
            resp.error.code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await this.prisma.pushToken.deleteMany({
          where: { token: { in: invalidTokens } },
        });
        this.logger.log(`Cleaned ${invalidTokens.length} invalid token(s)`);
      }

      return { sent: response.successCount, failed: response.failureCount, byToken };
    } catch (error) {
      this.logger.error('FCM multicast error', error);
      return {
        sent: 0,
        failed: tokens.length,
        byToken: new Map(tokens.map((t) => [t, 'failed' as TokenOutcome])),
      };
    }
  }

  /**
   * Fan-out sends resolve their recipients themselves, so without this every push that
   * matters — nueva quedada, confirmada, cancelada, propuesta, el aro, miembro nuevo —
   * was invisible in notification_logs and in GET /notifications/debug. Attribution is
   * per token, so one recipient's FCM failure is not charged to the rest.
   */
  private async logNotificationPerUser(
    tokens: { userId: string; token: string }[],
    title: string,
    body: string,
    data: Record<string, string> | undefined,
    notificationType: string | undefined,
    result: DetailedSendResult,
  ): Promise<void> {
    const perUser = new Map<string, SendResult>();
    for (const { userId, token } of tokens) {
      const entry = perUser.get(userId) ?? { sent: 0, failed: 0, tokenCount: 0 };
      entry.tokenCount += 1;
      const outcome = result.byToken.get(token);
      if (outcome === 'sent') entry.sent += 1;
      else if (outcome === 'failed') entry.failed += 1;
      perUser.set(userId, entry);
    }

    await Promise.all(
      [...perUser].map(([userId, counts]) =>
        this.logNotification(userId, title, body, data, notificationType, counts),
      ),
    );
  }

  private async logNotification(
    userId: string,
    title: string,
    body: string,
    data: Record<string, string> | undefined,
    notificationType: string | undefined,
    result: SendResult,
  ): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          userId,
          type: notificationType ?? null,
          title,
          body,
          data: data ?? undefined,
          tokenCount: result.tokenCount,
          sentCount: result.sent,
          failedCount: result.failed,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create notification log', error);
    }
  }
}

interface SendResult {
  sent: number;
  failed: number;
  tokenCount: number;
}

type TokenOutcome = 'sent' | 'failed' | 'skipped';

/** Internal only: the per-token breakdown never leaves the service. */
interface DetailedSendResult extends SendResult {
  byToken: Map<string, TokenOutcome>;
}

interface BatchResult {
  sent: number;
  failed: number;
  byToken: Map<string, TokenOutcome>;
}

interface TokenEntry {
  token: string;
  platform: string;
}

/**
 * A push token plus the language its owner reads. `user` is optional so a caller that
 * did not join the relation still gets a push — in Spanish, the DB default — instead of
 * a crash.
 */
interface RecipientToken extends TokenEntry {
  userId: string;
  user?: { language: string | null } | null;
}
