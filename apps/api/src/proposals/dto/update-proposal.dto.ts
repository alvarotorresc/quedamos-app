import { IsString, IsOptional, MaxLength, MinLength, Matches } from 'class-validator';

export class UpdateProposalDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'proposedDate must be in YYYY-MM-DD format' })
  proposedDate?: string;
}
