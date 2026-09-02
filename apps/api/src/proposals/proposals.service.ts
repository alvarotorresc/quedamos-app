import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PUBLIC_USER_SELECT } from '../common/prisma/user-select';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsService } from '../events/events.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { VoteProposalDto } from './dto/vote-proposal.dto';
import { ConvertProposalDto } from './dto/convert-proposal.dto';

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(
    private prisma: PrismaService,
    private groupsService: GroupsService,
    private notificationsService: NotificationsService,
    private eventsService: EventsService,
  ) {}

  async create(groupId: string, userId: string, dto: CreateProposalDto) {
    await this.groupsService.findById(groupId, userId);

    const proposal = await this.prisma.planProposal.create({
      data: {
        groupId,
        createdById: userId,
        title: dto.title,
        description: dto.description,
        location: dto.isOnline ? null : dto.location,
        isOnline: dto.isOnline ?? false,
        meetingUrl: dto.isOnline ? dto.meetingUrl : null,
        proposedDate: dto.proposedDate,
        votes: {
          create: { userId, vote: 'yes' },
        },
      },
      include: {
        createdBy: { select: PUBLIC_USER_SELECT },
        votes: { include: { user: { select: PUBLIC_USER_SELECT } } },
      },
    });

    this.notificationsService
      .sendToGroup(
        groupId,
        'Nueva propuesta',
        `${proposal.createdBy.name} propone "${proposal.title}"`,
        userId,
        { type: 'new_proposal', proposalId: proposal.id, groupId },
        'new_proposal',
      )
      .catch((err) => this.logger.error('Failed to send new_proposal notification', err));

    return proposal;
  }

  async findAll(groupId: string, userId: string) {
    await this.groupsService.findById(groupId, userId);

    return this.prisma.planProposal.findMany({
      where: { groupId },
      include: {
        createdBy: { select: PUBLIC_USER_SELECT },
        votes: { include: { user: { select: PUBLIC_USER_SELECT } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(groupId: string, proposalId: string, userId: string, dto: UpdateProposalDto) {
    await this.groupsService.findById(groupId, userId);

    const proposal = await this.prisma.planProposal.findFirst({
      where: { id: proposalId, groupId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.createdById !== userId) {
      throw new ForbiddenException('Only the creator can edit this proposal');
    }

    if (proposal.status !== 'open') {
      throw new ForbiddenException('Cannot edit a closed or converted proposal');
    }

    // Resolve the effective isOnline state: use dto value if provided, else current DB value
    const effectiveIsOnline = dto.isOnline ?? proposal.isOnline;

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.proposedDate !== undefined) data.proposedDate = dto.proposedDate;

    if (dto.isOnline !== undefined) {
      data.isOnline = dto.isOnline;
      if (dto.isOnline === true) {
        data.location = null;
      } else {
        data.meetingUrl = null;
      }
    }

    // Only allow location changes when NOT online
    if (dto.location !== undefined && !effectiveIsOnline) {
      data.location = dto.location;
    }

    // Only allow meetingUrl changes when online (and don't override the null set above)
    if (dto.meetingUrl !== undefined && effectiveIsOnline && data.meetingUrl === undefined) {
      data.meetingUrl = dto.meetingUrl;
    }

    return this.prisma.planProposal.update({
      where: { id: proposalId },
      data,
      include: {
        createdBy: { select: PUBLIC_USER_SELECT },
        votes: { include: { user: { select: PUBLIC_USER_SELECT } } },
      },
    });
  }

  async vote(groupId: string, proposalId: string, userId: string, dto: VoteProposalDto) {
    await this.groupsService.findById(groupId, userId);

    const proposal = await this.prisma.planProposal.findFirst({
      where: { id: proposalId, groupId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.status !== 'open') {
      throw new ForbiddenException('Cannot vote on a closed or converted proposal');
    }

    await this.prisma.planVote.upsert({
      where: { proposalId_userId: { proposalId, userId } },
      create: { proposalId, userId, vote: dto.vote },
      update: { vote: dto.vote, votedAt: new Date() },
    });

    const updated = await this.prisma.planProposal.findUnique({
      where: { id: proposalId },
      include: {
        createdBy: { select: PUBLIC_USER_SELECT },
        votes: { include: { user: { select: PUBLIC_USER_SELECT } } },
      },
    });

    const voter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const voterName = voter?.name ?? 'Someone';
    const voteLabel = dto.vote === 'yes' ? 'a favor' : 'en contra';

    this.notificationsService
      .sendToGroup(
        groupId,
        'Voto en propuesta',
        `${voterName} ha votado ${voteLabel} en "${proposal.title}"`,
        userId,
        { type: 'proposal_voted', proposalId, groupId },
        'proposal_voted',
      )
      .catch((err) => this.logger.error('Failed to send proposal_voted notification', err));

    return updated;
  }

  async convert(groupId: string, proposalId: string, userId: string, dto: ConvertProposalDto) {
    await this.groupsService.findById(groupId, userId);

    const proposal = await this.prisma.planProposal.findFirst({
      where: { id: proposalId, groupId },
      include: {
        createdBy: { select: PUBLIC_USER_SELECT },
        votes: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.createdById !== userId) {
      throw new ForbiddenException('Only the creator can convert this proposal');
    }

    if (proposal.status !== 'open') {
      throw new ForbiddenException('Cannot convert a closed or converted proposal');
    }

    if (dto.time && dto.endTime && dto.endTime <= dto.time) {
      throw new BadRequestException('End time must be after start time');
    }

    // Build attendee status map from proposal votes
    const attendeeStatusMap: Record<string, 'confirmed' | 'declined'> = {};
    for (const vote of proposal.votes) {
      attendeeStatusMap[vote.userId] = vote.vote === 'yes' ? 'confirmed' : 'declined';
    }

    // Claim the proposal atomically: two concurrent converts both pass the checks
    // above, but only one updateMany finds it still open, so only one event is born.
    const claimed = await this.prisma.planProposal.updateMany({
      where: { id: proposalId, groupId, status: 'open' },
      data: { status: 'converted' },
    });
    if (claimed.count !== 1) {
      throw new ForbiddenException('Cannot convert a closed or converted proposal');
    }

    // Create event using EventsService (status map passed as internal param, not in DTO).
    // skipNewEventNotification: the group already gets the more specific
    // proposal_converted push below — avoid the duplicate new_event push.
    let event: Awaited<ReturnType<EventsService['create']>>;
    try {
      event = await this.eventsService.create(
        groupId,
        userId,
        {
          title: proposal.title,
          description: proposal.description ?? undefined,
          location: proposal.location ?? undefined,
          isOnline: proposal.isOnline,
          meetingUrl: proposal.meetingUrl ?? undefined,
          date: dto.date,
          time: dto.time,
          endTime: dto.endTime,
        },
        attendeeStatusMap,
        { skipNewEventNotification: true },
      );
    } catch (error) {
      // Hand the proposal back so the creator can retry instead of leaving it
      // marked converted with no event behind it.
      await this.prisma.planProposal.updateMany({
        where: { id: proposalId, status: 'converted', convertedEventId: null },
        data: { status: 'open' },
      });
      throw error;
    }

    // Mark proposal as converted
    const updated = await this.prisma.planProposal.update({
      where: { id: proposalId },
      data: { status: 'converted', convertedEventId: event.id },
      include: {
        createdBy: { select: PUBLIC_USER_SELECT },
        votes: { include: { user: { select: PUBLIC_USER_SELECT } } },
      },
    });

    this.notificationsService
      .sendToGroup(
        groupId,
        'Propuesta convertida',
        `"${proposal.title}" se ha convertido en quedada`,
        userId,
        { type: 'proposal_converted', proposalId, groupId, eventId: event.id },
        'proposal_converted',
      )
      .catch((err) => this.logger.error('Failed to send proposal_converted notification', err));

    return updated;
  }

  async close(groupId: string, proposalId: string, userId: string) {
    await this.groupsService.findById(groupId, userId);

    const proposal = await this.prisma.planProposal.findFirst({
      where: { id: proposalId, groupId },
    });

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.createdById !== userId) {
      throw new ForbiddenException('Only the creator can close this proposal');
    }

    if (proposal.status !== 'open') {
      throw new ForbiddenException('Cannot close a proposal that is not open');
    }

    return this.prisma.planProposal.update({
      where: { id: proposalId },
      data: { status: 'closed' },
      include: {
        createdBy: { select: PUBLIC_USER_SELECT },
        votes: { include: { user: { select: PUBLIC_USER_SELECT } } },
      },
    });
  }
}
