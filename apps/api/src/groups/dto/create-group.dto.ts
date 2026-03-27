import { IsString, IsOptional, MaxLength, MinLength, IsNotEmpty } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  emoji?: string;
}
