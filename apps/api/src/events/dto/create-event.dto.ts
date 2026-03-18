import {
  IsString,
  IsOptional,
  MaxLength,
  Matches,
  IsNotEmpty,
  IsArray,
  IsUUID,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
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
  @IsArray()
  @IsUUID('4', { each: true })
  attendeeIds?: string[];

  @IsOptional()
  attendeeStatusMap?: Record<string, 'confirmed' | 'declined'>;
}
