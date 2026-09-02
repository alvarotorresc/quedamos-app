import {
  IsString,
  IsOptional,
  IsISO8601,
  IsBoolean,
  IsUrl,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

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
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'proposedDate must be a real calendar date' },
  )
  proposedDate?: string;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @IsString()
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'meetingUrl must be a valid URL (http or https)' },
  )
  @MaxLength(500)
  meetingUrl?: string;
}
