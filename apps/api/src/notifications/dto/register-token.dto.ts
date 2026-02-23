import { IsString, IsIn, IsNotEmpty, MaxLength } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token: string;

  @IsIn(['web', 'android'])
  platform: 'web' | 'android';
}
