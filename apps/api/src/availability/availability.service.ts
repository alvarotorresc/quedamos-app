import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
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
      include: { user: true },
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

  async create(groupId: string, userId: string, dto: CreateAvailabilityDto) {
    await this.groupsService.findById(groupId, userId);

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
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
      create: {
        userId,
        groupId,
        date: new Date(dto.date),
        type: dto.type,
        slots: dto.slots ?? [],
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });
  }

  async update(
    groupId: string,
    date: string,
    userId: string,
    dto: CreateAvailabilityDto,
  ) {
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

    return this.prisma.availability.update({
      where: { id: existing.id },
      data: {
        type: dto.type,
        slots: dto.slots ?? [],
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });
  }

  async delete(groupId: string, date: string, userId: string) {
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
