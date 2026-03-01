import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GroupsService } from './groups.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { AddCityDto } from './dto/add-city.dto';

@Controller('groups')
@UseGuards(AuthGuard)
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.groupsService.findAllForUser(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.findById(id, user.id);
  }

  @Post('join')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  join(@CurrentUser() user: { id: string }, @Body() dto: JoinGroupDto) {
    return this.groupsService.joinByCode(user.id, dto.inviteCode);
  }

  @Delete(':id/leave')
  leave(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.leave(id, user.id);
  }

  @Get(':id/members')
  getMembers(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.getMembers(id, user.id);
  }

  @Get(':id/invite')
  getInvite(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.getInviteInfo(id, user.id);
  }

  @Post(':id/invite/refresh')
  refreshInvite(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.refreshInviteCode(id, user.id);
  }

  @Post(':id/cities')
  addCity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: AddCityDto,
  ) {
    return this.groupsService.addCity(id, user.id, dto);
  }

  @Get(':id/cities')
  getCities(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.groupsService.getCities(id, user.id);
  }

  @Delete(':id/cities/:cityId')
  removeCity(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cityId', ParseUUIDPipe) cityId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.groupsService.removeCity(id, cityId, user.id);
  }

  @Patch(':id/members/:userId/role')
  updateMemberRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.groupsService.updateMemberRole(id, userId, user.id, dto.role);
  }

  @Delete(':id/members/:userId')
  kickMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.groupsService.kickMember(id, userId, user.id);
  }

  @Delete(':id')
  deleteGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.groupsService.deleteGroup(id, user.id);
  }
}
