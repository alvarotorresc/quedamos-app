import { IsString } from 'class-validator';

export class UnregisterTokenDto {
  @IsString()
  token: string;
}
