import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InviteController } from './invite.controller';
import { GroupsService } from '../groups/groups.service';
import { Response } from 'express';

describe('InviteController', () => {
  let controller: InviteController;
  let groupsService: Pick<GroupsService, 'findByInviteCode'>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    groupsService = {
      findByInviteCode: jest.fn(),
    };
    controller = new InviteController(groupsService as GroupsService);
    mockResponse = {
      redirect: jest.fn(),
    };
  });

  afterEach(() => {
    delete process.env.FRONTEND_URL;
  });

  describe('GET /join/:code', () => {
    it('should redirect 302 to frontend when invite code exists', async () => {
      (groupsService.findByInviteCode as jest.Mock).mockResolvedValue(true);

      await controller.redirectToApp('12345678', mockResponse as Response);

      expect(groupsService.findByInviteCode).toHaveBeenCalledWith('12345678');
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        302,
        'https://quedamos.alvarotc.com/join/12345678',
      );
    });

    it('should use FRONTEND_URL env var when set', async () => {
      process.env.FRONTEND_URL = 'https://custom.example.com';
      (groupsService.findByInviteCode as jest.Mock).mockResolvedValue(true);

      await controller.redirectToApp('12345678', mockResponse as Response);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        302,
        'https://custom.example.com/join/12345678',
      );
    });

    it('should throw NotFoundException when invite code does not exist', async () => {
      (groupsService.findByInviteCode as jest.Mock).mockResolvedValue(false);

      await expect(controller.redirectToApp('99999999', mockResponse as Response)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for non-numeric code', async () => {
      await expect(controller.redirectToApp('abcdefgh', mockResponse as Response)).rejects.toThrow(
        BadRequestException,
      );

      expect(groupsService.findByInviteCode).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for code with wrong length', async () => {
      await expect(controller.redirectToApp('1234567', mockResponse as Response)).rejects.toThrow(
        BadRequestException,
      );

      await expect(controller.redirectToApp('123456789', mockResponse as Response)).rejects.toThrow(
        BadRequestException,
      );

      expect(groupsService.findByInviteCode).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty code', async () => {
      await expect(controller.redirectToApp('', mockResponse as Response)).rejects.toThrow(
        BadRequestException,
      );

      expect(groupsService.findByInviteCode).not.toHaveBeenCalled();
    });
  });
});
