import {
  IsString,
  IsOptional,
  IsISO8601,
  IsBoolean,
  IsUrl,
  MaxLength,
  MinLength,
  Matches,
  IsNotEmpty,
  IsArray,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

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

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'date must be a real calendar date' },
  )
  date: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  time?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string;

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

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attendeeIds?: string[];
}
