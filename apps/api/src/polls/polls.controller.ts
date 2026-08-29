import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PollsService } from './polls.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePollDto } from './dto/create-poll.dto';
import { RespondPollDto } from './dto/respond-poll.dto';

@ApiTags('Polls')
@ApiBearerAuth()
@Controller('groups/:groupId/polls')
@UseGuards(AuthGuard)
export class PollsController {
  constructor(private pollsService: PollsService) {}

  @Post()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  create(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePollDto,
  ) {
    return this.pollsService.create(groupId, user.id, dto);
  }

  @Get()
  findAll(@Param('groupId', ParseUUIDPipe) groupId: string, @CurrentUser() user: { id: string }) {
    return this.pollsService.findAllForGroup(groupId, user.id);
  }

  @Post(':pollId/respond')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  respond(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RespondPollDto,
  ) {
    return this.pollsService.respond(groupId, pollId, user.id, dto);
  }

  @Post(':pollId/close')
  close(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.pollsService.close(groupId, pollId, user.id);
  }
}
