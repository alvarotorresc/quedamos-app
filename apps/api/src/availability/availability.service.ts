import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PUBLIC_USER_SELECT } from '../common/prisma/user-select';
import { GroupsService } from '../groups/groups.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(
    private prisma: PrismaService,
    private groupsService: GroupsService,
  ) {}

  async findAllForGroup(groupId: string, userId: string) {
    await this.groupsService.findById(groupId, userId);

    return this.prisma.availability.findMany({
      where: { groupId },
      include: { user: { select: PUBLIC_USER_SELECT } },
      orderBy: { date: 'asc' },
    });
  }

  async findMyAvailability(groupId: string, userId: string) {
    await this.groupsService.findById(groupId, userId);

    return this.prisma.availability.findMany({
      where: { groupId, userId },
      orderBy: { date: 'asc' },
    });
  }

  private validateDateFormat(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
    }
  }

  private validateTypeConsistency(dto: CreateAvailabilityDto): void {
    if (dto.type === 'range') {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException('startTime and endTime are required for type "range"');
      }
    }

    if (dto.type === 'slots') {
      if (!dto.slots || dto.slots.length === 0) {
        throw new BadRequestException(
          'slots array is required and must not be empty for type "slots"',
        );
      }
    }
  }

  async create(groupId: string, userId: string, dto: CreateAvailabilityDto) {
    await this.groupsService.findById(groupId, userId);
    this.validateTypeConsistency(dto);

    // Explicit nulls outside 'range': undefined means "leave as is" for Prisma, which
    // kept the previous range on the row after switching to 'day' or 'slots'.
    const startTime = dto.type === 'range' ? dto.startTime : null;
    const endTime = dto.type === 'range' ? dto.endTime : null;

    return this.prisma.availability.upsert({
      where: {
        userId_groupId_date: {
          userId,
          groupId,
          date: new Date(dto.date),
        },
      },
      update: {
        type: dto.type,
        slots: dto.slots ?? [],
        startTime,
        endTime,
      },
      create: {
        userId,
        groupId,
        date: new Date(dto.date),
        type: dto.type,
        slots: dto.slots ?? [],
        startTime,
        endTime,
      },
    });
  }

  async update(groupId: string, date: string, userId: string, dto: CreateAvailabilityDto) {
    this.validateDateFormat(date);
    await this.groupsService.findById(groupId, userId);
    this.validateTypeConsistency(dto);

    const existing = await this.prisma.availability.findUnique({
      where: {
        userId_groupId_date: {
          userId,
          groupId,
          date: new Date(date),
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Availability not found');
    }

    return this.prisma.availability.update({
      where: { id: existing.id },
      data: {
        type: dto.type,
        slots: dto.slots ?? [],
        startTime: dto.type === 'range' ? dto.startTime : null,
        endTime: dto.type === 'range' ? dto.endTime : null,
      },
    });
  }

  /**
   * Merges a poll's implied availability into the user's existing row for
   * groupId+userId+date — WITHOUT ever degrading availability already
   * marked. Used by PollsService (asking a question already answers "yes"
   * for the asker; a "yes" response does the same for the responder), which
   * previously called `create()` directly — a full-replacement upsert that
   * could shrink a whole day down to a single slot.
   *
   * Rules (product decision confirmed 2026-08-31, see
   * final-fix-wave-brief.md, finding I1), for the existing row at that
   * date:
   *   - none:    creates 'day' (poll has no slot) or 'slots' (poll has one)
   *   - 'day':   left untouched either way — a full day already covers any slot
   *   - 'slots': a slot-less poll broadens it to 'day' (allowed); a slotted
   *              poll unions the slot into the existing list if missing
   *   - 'range': a slot-less poll broadens it to 'day' (allowed); a slotted
   *              poll leaves it intact — never destroy a precise range, the
   *              PollResponse already records the yes
   *
   * Read-then-write, not a transaction: the residual concurrency window is
   * documented as a followup in the repo backlog.
   */
  async mergeFromPoll(groupId: string, userId: string, date: string, slot: string | null) {
    await this.groupsService.findById(groupId, userId);

    const existing = await this.prisma.availability.findUnique({
      where: {
        userId_groupId_date: { userId, groupId, date: new Date(date) },
      },
    });

    if (!existing) {
      return this.prisma.availability.create({
        data: slot
          ? { userId, groupId, date: new Date(date), type: 'slots', slots: [slot] }
          : { userId, groupId, date: new Date(date), type: 'day', slots: [] },
      });
    }

    if (existing.type === 'day') return existing;

    if (existing.type === 'range') {
      if (slot) return existing; // never destroy a precise range
      return this.prisma.availability.update({
        where: { id: existing.id },
        data: { type: 'day', slots: [], startTime: null, endTime: null },
      });
    }

    // existing.type === 'slots'
    if (!slot) {
      return this.prisma.availability.update({
        where: { id: existing.id },
        data: { type: 'day', slots: [] },
      });
    }

    if (existing.slots.includes(slot)) return existing;

    return this.prisma.availability.update({
      where: { id: existing.id },
      data: { slots: [...existing.slots, slot] },
    });
  }

  async delete(groupId: string, date: string, userId: string) {
    this.validateDateFormat(date);
    await this.groupsService.findById(groupId, userId);

    const existing = await this.prisma.availability.findUnique({
      where: {
        userId_groupId_date: {
          userId,
          groupId,
          date: new Date(date),
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Availability not found');
    }

    await this.prisma.availability.delete({
      where: { id: existing.id },
    });

    return { success: true };
  }
}
