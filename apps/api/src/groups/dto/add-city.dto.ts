import { IsString, IsNumber, MinLength, MaxLength, Min, Max } from 'class-validator';

export class AddCityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;
}
