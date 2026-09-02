import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';

export interface WidgetSummary {
  group: { id: string; name: string; emoji: string };
  members: { id: string; name: string; colorIndex: number }[];
  days: { date: string; availableMemberIds: string[]; hasEvent: boolean }[];
  bestDay: { date: string; count: number; closesAro: boolean } | null;
  generatedAt: string;
}

const WEEK_DAYS = 7;
const MIN_ATTENDEES = 2; // mirror of apps/mobile/src/lib/calendar-utils.ts:45
const MEMBER_COLOR_COUNT = 6;

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toKey(d);
}

@Injectable()
export class WidgetSummaryService {
  constructor(
    private prisma: PrismaService,
    private groupsService: GroupsService,
  ) {}

  async getSummary(
    userId: string,
    groupId: string,
    weekStart: string,
    today: string,
  ): Promise<WidgetSummary> {
    const group = await this.groupsService.findById(groupId, userId);

    // Same ordering as the app's buildMemberColorMap: joinedAt asc, userId asc.
    const members = [...group.members]
      .sort(
        (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime() || a.userId.localeCompare(b.userId),
      )
      .map((m, i) => ({
        id: m.userId,
        name: m.user.name,
        colorIndex: i % MEMBER_COLOR_COUNT,
      }));
    const memberIds = new Set(members.map((m) => m.id));

    // One window covers both the rendered week and the best-day horizon.
    const from = weekStart < today ? weekStart : today;
    const [availability, events] = await Promise.all([
      this.prisma.availability.findMany({
        where: { groupId, date: { gte: new Date(`${from}T00:00:00.000Z`) } },
        select: { userId: true, date: true },
      }),
      this.prisma.event.findMany({
        where: {
          groupId,
          status: { not: 'cancelled' },
          date: { gte: new Date(`${from}T00:00:00.000Z`) },
        },
        select: { date: true },
      }),
    ]);

    const availByDate = new Map<string, string[]>();
    for (const row of availability) {
      // Guard against orphaned rows from ex-members (e.g. GroupsService.kickMember
      // does not clean up availability): only count current members.
      if (!memberIds.has(row.userId)) continue;
      const key = toKey(row.date);
      const list = availByDate.get(key) ?? [];
      list.push(row.userId);
      availByDate.set(key, list);
    }
    const eventDays = new Set(events.map((e) => toKey(e.date)));

    const days = Array.from({ length: WEEK_DAYS }, (_, i) => {
      const date = addDays(weekStart, i);
      return {
        date,
        availableMemberIds: availByDate.get(date) ?? [],
        hasEvent: eventDays.has(date),
      };
    });

    const bestDay =
      [...availByDate.entries()]
        .filter(
          ([date, ids]) => date >= today && ids.length >= MIN_ATTENDEES && !eventDays.has(date),
        )
        .map(([date, ids]) => ({
          date,
          count: ids.length,
          closesAro: ids.length === members.length,
        }))
        .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))[0] ?? null;

    return {
      group: { id: group.id, name: group.name, emoji: group.emoji },
      members,
      days,
      bestDay,
      generatedAt: new Date().toISOString(),
    };
  }
}
