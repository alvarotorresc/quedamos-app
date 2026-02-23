import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { RespondEventDto } from './dto/respond-event.dto';

@Controller('groups/:groupId/events')
@UseGuards(AuthGuard)
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  findAll(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.eventsService.findAllForGroup(groupId, user.id);
  }

  @Get(':eventId')
  findOne(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.eventsService.findById(groupId, eventId, user.id);
  }

  @Post()
  create(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.create(groupId, user.id, dto);
  }

  @Post(':eventId/respond')
  respond(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RespondEventDto,
  ) {
    return this.eventsService.respond(groupId, eventId, user.id, dto);
  }
}
