import { IsString, IsNumber, Min, Max, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetForecastQueryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD format' })
  date: string;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber({}, { message: 'lat must be a number between -90 and 90' })
  @Min(-90, { message: 'lat must be a number between -90 and 90' })
  @Max(90, { message: 'lat must be a number between -90 and 90' })
  lat: number;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber({}, { message: 'lon must be a number between -180 and 180' })
  @Min(-180, { message: 'lon must be a number between -180 and 180' })
  @Max(180, { message: 'lon must be a number between -180 and 180' })
  lon: number;
}
