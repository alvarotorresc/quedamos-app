import { Injectable, Logger } from '@nestjs/common';
import { getApps } from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * `data.type` the Android app matches on (QuedamosMessagingService.kt, and
 * apps/mobile/src/lib/push-notifications.ts for the foreground case).
 *
 * Deliberately NOT a NotificationType: this is not an announcement, it is a nudge for
 * the home-screen widgets to re-read the group. It carries no `notification` block, so
 * nothing is ever drawn in the tray, and it must not appear in the notification
 * preferences either — there is nothing for the user to switch off.
 */
export const WIDGET_REFRESH_TYPE = 'widget_refresh';

/** At most one nudge per member per minute. */
const THROTTLE_MS = 60_000;

@Injectable()
export class WidgetRefreshService {
  private readonly logger = new Logger(WidgetRefreshService.name);

  /**
   * userId -> when we last nudged that member.
   *
   * NOTE: in memory, so it assumes single-instance deployment — the same assumption the
   * cron jobs in notifications/weekly-reminder.service.ts already make. Behind more than
   * one instance each keeps its own window and a member could get one nudge per instance
   * per minute: noise, never a correctness problem, since the payload carries nothing but
   * "look again".
   */
  private readonly lastPushAt = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tell the other members' widgets that this group changed.
   *
   * Fire-and-forget by contract: it resolves, never rejects, and every call site treats
   * it as a side effect of a request that has already succeeded. `excludeUserId` is the
   * member who made the change — their own app calls the bridge locally
   * (`notifyWidgetDataChanged`), so a push to them would be a second, slower refresh of
   * something already refreshed.
   */
  async notifyGroupWidgets(groupId: string, excludeUserId?: string): Promise<{ sent: number }> {
    try {
      return await this.push(groupId, excludeUserId);
    } catch (error) {
      this.logger.error(`widget_refresh push failed for group ${groupId}`, error);
      return { sent: 0 };
    }
  }

  /** How many throttle windows are being held. Test seam for the pruning below. */
  throttleSize(): number {
    return this.lastPushAt.size;
  }

  private async push(groupId: string, excludeUserId?: string): Promise<{ sent: number }> {
    // Reuses the app NotificationsService initialized on boot — asked for lazily, at send
    // time, because getMessaging() throws when no app exists and module init order is not
    // ours to depend on. No credentials configured (local dev, CI) means no widgets to
    // refresh either.
    if (getApps().length === 0) return { sent: 0 };

    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const userIds = members.map((m) => m.userId).filter((id) => id !== excludeUserId);
    if (userIds.length === 0) return { sent: 0 };

    const now = Date.now();
    const allowed = userIds.filter((id) => {
      const last = this.lastPushAt.get(id);
      return last === undefined || now - last >= THROTTLE_MS;
    });
    if (allowed.length === 0) return { sent: 0 };

    // Marked here, before the first await: two changes landing at once would otherwise
    // both read an empty window and both send, because neither had marked anything yet
    // when the other looked. A member with no android token burns a window for nothing —
    // at worst one missed nudge, and only if they register a token within the minute.
    for (const userId of allowed) this.lastPushAt.set(userId, now);
    this.forgetExpiredWindows(now);

    const tokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: allowed }, platform: 'android' },
      select: { userId: true, token: true },
    });
    if (tokens.length === 0) return { sent: 0 };

    const message: MulticastMessage = {
      tokens: tokens.map((t) => t.token),
      // No `notification`, in the message or under `android`: a data-only push is what
      // reaches QuedamosMessagingService.onMessageReceived without the system drawing
      // anything. `high` priority is what wakes an idle (Doze) device — a widget that
      // updates half an hour later is the hourly worker, not this.
      data: { type: WIDGET_REFRESH_TYPE, groupId },
      android: { priority: 'high' },
    };

    const response = await getMessaging().sendEachForMulticast(message);

    const invalidTokens = response.responses.flatMap((resp, idx) =>
      isDeadToken(resp.error?.code) ? [tokens[idx].token] : [],
    );
    if (invalidTokens.length > 0) {
      await this.prisma.pushToken.deleteMany({ where: { token: { in: invalidTokens } } });
      this.logger.log(`Cleaned ${invalidTokens.length} invalid token(s)`);
    }

    this.logger.debug(
      `widget_refresh for group ${groupId}: ${response.successCount} ok, ${response.failureCount} failed`,
    );

    return { sent: response.successCount };
  }

  /**
   * An expired window is indistinguishable from no window at all, so dropping it keeps
   * the map the size of "who changed something in the last minute" instead of "every
   * member of every group since boot".
   */
  private forgetExpiredWindows(now: number): void {
    for (const [userId, at] of this.lastPushAt) {
      if (now - at >= THROTTLE_MS) this.lastPushAt.delete(userId);
    }
  }
}

/** The two FCM codes that mean "this token will never work again". */
function isDeadToken(code: string | undefined): boolean {
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}
