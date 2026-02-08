import { IsString, Length } from 'class-validator';

export class JoinGroupDto {
  @IsString()
  @Length(6, 6)
  inviteCode: string;
}
