import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProposalsService } from './proposals.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { UpdateProposalDto } from './dto/update-proposal.dto';
import { VoteProposalDto } from './dto/vote-proposal.dto';
import { ConvertProposalDto } from './dto/convert-proposal.dto';

@ApiTags('Proposals')
@ApiBearerAuth()
@Controller('groups/:groupId/proposals')
@UseGuards(AuthGuard)
export class ProposalsController {
  constructor(private proposalsService: ProposalsService) {}

  @Post()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  create(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateProposalDto,
  ) {
    return this.proposalsService.create(groupId, user.id, dto);
  }

  @Patch(':proposalId')
  update(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProposalDto,
  ) {
    return this.proposalsService.update(groupId, proposalId, user.id, dto);
  }

  @Get()
  findAll(@Param('groupId', ParseUUIDPipe) groupId: string, @CurrentUser() user: { id: string }) {
    return this.proposalsService.findAll(groupId, user.id);
  }

  @Post(':proposalId/vote')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  vote(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: VoteProposalDto,
  ) {
    return this.proposalsService.vote(groupId, proposalId, user.id, dto);
  }

  @Post(':proposalId/convert')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  convert(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ConvertProposalDto,
  ) {
    return this.proposalsService.convert(groupId, proposalId, user.id, dto);
  }

  @Post(':proposalId/close')
  close(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.proposalsService.close(groupId, proposalId, user.id);
  }
}
