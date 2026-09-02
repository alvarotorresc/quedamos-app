import { IsIn, IsISO8601, IsOptional, IsString, Matches } from 'class-validator';

export class CreatePollDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'date must be a real calendar date' },
  )
  date: string;

  @IsOptional()
  @IsIn(['Mañana', 'Tarde', 'Noche'])
  slot?: string;
}
