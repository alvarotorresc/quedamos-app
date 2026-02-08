import { IsString, Matches } from 'class-validator';

export class JoinGroupDto {
  @IsString()
  @Matches(/^\d{8}$/)
  inviteCode: string;
}
