import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateAvailabilityDto } from './dto/create-availability.dto';

@Controller('groups/:groupId/availability')
@UseGuards(AuthGuard)
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Get()
  findAll(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.availabilityService.findAllForGroup(groupId, user.id);
  }

  @Get('me')
  findMine(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.availabilityService.findMyAvailability(groupId, user.id);
  }

  @Post()
  create(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateAvailabilityDto,
  ) {
    return this.availabilityService.create(groupId, user.id, dto);
  }

  @Put(':date')
  update(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('date') date: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateAvailabilityDto,
  ) {
    return this.availabilityService.update(groupId, date, user.id, dto);
  }

  @Delete(':date')
  delete(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('date') date: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.availabilityService.delete(groupId, date, user.id);
  }
}
