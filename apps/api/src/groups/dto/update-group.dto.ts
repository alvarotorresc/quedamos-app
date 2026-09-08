import { IsString, IsOptional, MaxLength, MinLength, IsNotEmpty } from 'class-validator';

/**
 * Partial update of a group's identity (B3). Both fields are optional so a
 * client can rename without resending the emoji, but neither may be blank:
 * the same bounds CreateGroupDto enforces on the way in.
 */
export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  emoji?: string;
}
