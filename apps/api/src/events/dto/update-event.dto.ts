import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUrl,
  MaxLength,
  MinLength,
  Matches,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class UpdateEventDto {
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
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLon?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  // `null` clears the field: @IsOptional() skips validation for it and the service
  // tells it apart from "not sent" with an explicit `!== undefined` check.
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  time?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string | null;

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
