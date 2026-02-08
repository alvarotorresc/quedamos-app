import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';

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
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.groupsService.findById(id, user.id);
  }

  @Post('join')
  join(@CurrentUser() user: { id: string }, @Body() dto: JoinGroupDto) {
    return this.groupsService.joinByCode(user.id, dto.inviteCode);
  }

  @Delete(':id/leave')
  leave(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.groupsService.leave(id, user.id);
  }

  @Get(':id/members')
  getMembers(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.groupsService.getMembers(id, user.id);
  }

  @Get(':id/invite')
  getInvite(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.groupsService.getInviteInfo(id, user.id);
  }

  @Post(':id/invite/refresh')
  refreshInvite(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.groupsService.refreshInviteCode(id, user.id);
  }
}
