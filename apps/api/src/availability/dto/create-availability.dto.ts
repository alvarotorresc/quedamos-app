import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  Matches,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';

export class CreateAvailabilityDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsIn(['day', 'slots', 'range'])
  type: 'day' | 'slots' | 'range';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  slots?: string[];

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string;
}
