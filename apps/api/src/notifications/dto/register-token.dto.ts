import { IsString, IsIn } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  token: string;

  @IsIn(['web', 'android'])
  platform: 'web' | 'android';
}
