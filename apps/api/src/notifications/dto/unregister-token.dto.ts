import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UnregisterTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token: string;
}
