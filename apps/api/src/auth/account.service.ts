import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

const SUPABASE_TIMEOUT_MS = 10_000;

interface GroupTransfer {
  groupId: string;
  groupName: string;
  successorId: string;
}

interface SuccessionPlan {
  /** Groups the user founded alone: they go with the account. */
  groupsToDelete: { id: string; name: string }[];
  /** Groups the user founded with other people: ownership moves to the successor. */
  transfers: GroupTransfer[];
  /**
   * Who inherits what the user authored (quedadas, proposals, questions) in each
   * group that keeps existing: the successor in transferred groups, the founder
   * elsewhere. The FK on `created_by` is RESTRICT for events and proposals, so
   * this is also what makes the user row deletable at all.
   */
  heirs: Map<string, string>;
}

export interface DeleteAccountResult {
  success: true;
  groupsDeleted: number;
  groupsTransferred: number;
}

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  private fetchFn: typeof fetch;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.fetchFn = fetch;
  }

  /** Allow injecting a custom fetch for testing */
  setFetch(fn: typeof fetch): void {
    this.fetchFn = fn;
  }

  /**
   * Deletes the account for good. Supabase Auth goes first — if that fails nothing
   * is touched — and then everything in Postgres goes in one transaction: founded
   * groups are transferred or dropped, authored content is handed over, and the
   * user row is deleted (memberships, availability, answers, votes, push and
   * widget tokens, preferences and logs all cascade from it).
   */
  async deleteAccount(userId: string): Promise<DeleteAccountResult> {
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    if (!serviceKey || !supabaseUrl) {
      this.logger.error('SUPABASE_SERVICE_KEY is not set: account deletion is disabled');
      throw new ServiceUnavailableException(
        'Account deletion is not available right now. Please try again later.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const plan = await this.planSuccession(userId);

    await this.deleteSupabaseUser(supabaseUrl, serviceKey, userId);

    await this.prisma.$transaction(async (tx) => {
      for (const transfer of plan.transfers) {
        await tx.group.update({
          where: { id: transfer.groupId },
          data: { createdById: transfer.successorId },
        });
        await tx.groupMember.update({
          where: { groupId_userId: { groupId: transfer.groupId, userId: transfer.successorId } },
          data: { role: 'admin' },
        });
      }

      for (const [groupId, heirId] of plan.heirs) {
        const where = { groupId, createdById: userId };
        const data = { createdById: heirId };
        await tx.event.updateMany({ where, data });
        await tx.planProposal.updateMany({ where, data });
        await tx.availabilityPoll.updateMany({ where, data });
      }

      for (const group of plan.groupsToDelete) {
        await tx.group.delete({ where: { id: group.id } });
      }

      await tx.user.delete({ where: { id: userId } });
    });

    for (const transfer of plan.transfers) {
      this.logger.log(
        `Account ${userId} deleted: group ${transfer.groupId} ("${transfer.groupName}") transferred to ${transfer.successorId}`,
      );
    }
    for (const group of plan.groupsToDelete) {
      this.logger.log(
        `Account ${userId} deleted: group ${group.id} ("${group.name}") deleted with it`,
      );
    }
    this.logger.log(`Account ${userId} deleted`);

    return {
      success: true,
      groupsDeleted: plan.groupsToDelete.length,
      groupsTransferred: plan.transfers.length,
    };
  }

  private async planSuccession(userId: string): Promise<SuccessionPlan> {
    // A member can leave or be kicked and still be the author of quedadas in that
    // group, so authored content is looked up on its own instead of via memberships.
    const authoredIn = { where: { createdById: userId }, select: { groupId: true } } as const;
    const [events, proposals, polls] = await Promise.all([
      this.prisma.event.findMany(authoredIn),
      this.prisma.planProposal.findMany(authoredIn),
      this.prisma.availabilityPoll.findMany(authoredIn),
    ]);
    const authoredGroupIds = [
      ...new Set([...events, ...proposals, ...polls].map((row) => row.groupId)),
    ];

    const groups = await this.prisma.group.findMany({
      where: { OR: [{ createdById: userId }, { id: { in: authoredGroupIds } }] },
      select: {
        id: true,
        name: true,
        createdById: true,
        members: {
          select: { userId: true, role: true, joinedAt: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    const plan: SuccessionPlan = { groupsToDelete: [], transfers: [], heirs: new Map() };

    for (const group of groups) {
      if (group.createdById !== userId) {
        plan.heirs.set(group.id, group.createdById);
        continue;
      }

      const others = group.members.filter((member) => member.userId !== userId);
      if (others.length === 0) {
        plan.groupsToDelete.push({ id: group.id, name: group.name });
        continue;
      }

      // Members come ordered by joinedAt: the oldest admin, or failing that the
      // oldest member, takes the group.
      const successor = others.find((member) => member.role === 'admin') ?? others[0];
      plan.transfers.push({
        groupId: group.id,
        groupName: group.name,
        successorId: successor.userId,
      });
      plan.heirs.set(group.id, successor.userId);
    }

    return plan;
  }

  private async deleteSupabaseUser(
    supabaseUrl: string,
    serviceKey: string,
    userId: string,
  ): Promise<void> {
    let response: Response;
    try {
      response = await this.fetchFn(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(`Supabase Auth delete failed for user ${userId}`, error);
      throw new BadGatewayException('Could not delete the account right now. Please try again.');
    }

    // 404 means the auth user is already gone: a retry after the database step
    // failed last time. Carrying on is what finishes the job.
    if (!response.ok && response.status !== 404) {
      this.logger.error(`Supabase Auth delete returned ${response.status} for user ${userId}`);
      throw new BadGatewayException('Could not delete the account right now. Please try again.');
    }
  }

  /**
   * Everything the app holds about the user, as plain JSON. Tokens are left out on
   * purpose: they are credentials, not data about the person.
   */
  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarEmoji: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          select: {
            role: true,
            joinedAt: true,
            group: { select: { id: true, name: true, emoji: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        availability: {
          select: {
            groupId: true,
            date: true,
            type: true,
            slots: true,
            startTime: true,
            endTime: true,
            createdAt: true,
          },
          orderBy: { date: 'asc' },
        },
        createdEvents: {
          select: {
            id: true,
            groupId: true,
            title: true,
            description: true,
            location: true,
            locationLat: true,
            locationLon: true,
            isOnline: true,
            meetingUrl: true,
            date: true,
            time: true,
            endTime: true,
            status: true,
            createdAt: true,
          },
          orderBy: { date: 'asc' },
        },
        eventResponses: {
          select: {
            status: true,
            respondedAt: true,
            event: {
              select: {
                id: true,
                groupId: true,
                title: true,
                date: true,
                time: true,
                status: true,
              },
            },
          },
        },
        createdProposals: {
          select: {
            id: true,
            groupId: true,
            title: true,
            description: true,
            location: true,
            isOnline: true,
            meetingUrl: true,
            proposedDate: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        proposalVotes: {
          select: {
            vote: true,
            votedAt: true,
            proposal: { select: { id: true, groupId: true, title: true } },
          },
        },
        createdPolls: {
          select: {
            id: true,
            groupId: true,
            date: true,
            slot: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        pollResponses: {
          select: {
            answer: true,
            respondedAt: true,
            poll: { select: { id: true, groupId: true, date: true, slot: true } },
          },
        },
        notificationPreferences: { select: { type: true, enabled: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarEmoji: user.avatarEmoji,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      groups: user.memberships.map((membership) => ({
        id: membership.group.id,
        name: membership.group.name,
        emoji: membership.group.emoji,
        role: membership.role,
        joinedAt: membership.joinedAt,
      })),
      availability: user.availability,
      events: {
        created: user.createdEvents,
        attendance: user.eventResponses.map((response) => ({
          ...response.event,
          myStatus: response.status,
          respondedAt: response.respondedAt,
        })),
      },
      proposals: {
        created: user.createdProposals,
        votes: user.proposalVotes.map((vote) => ({
          ...vote.proposal,
          myVote: vote.vote,
          votedAt: vote.votedAt,
        })),
      },
      polls: {
        created: user.createdPolls,
        responses: user.pollResponses.map((response) => ({
          ...response.poll,
          myAnswer: response.answer,
          respondedAt: response.respondedAt,
        })),
      },
      notificationPreferences: user.notificationPreferences,
    };
  }
}
