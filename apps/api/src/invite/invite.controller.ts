import {
  Controller,
  Get,
  Param,
  Res,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { GroupsService } from '../groups/groups.service';
import { getFrontendUrl } from '../common/frontend-url';

const INVITE_CODE_REGEX = /^\d{8}$/;

@ApiTags('Invite')
@Controller('join')
export class InviteController {
  constructor(private groupsService: GroupsService) {}

  @Get(':code')
  async redirectToApp(@Param('code') code: string, @Res() res: Response): Promise<void> {
    if (!INVITE_CODE_REGEX.test(code)) {
      throw new BadRequestException('Invalid invite code format');
    }

    const exists = await this.groupsService.findByInviteCode(code);
    if (!exists) {
      throw new NotFoundException('Invite code not found');
    }

    res.redirect(302, `${getFrontendUrl()}/join/${code}`);
  }
}
