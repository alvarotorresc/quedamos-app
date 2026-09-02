import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class CreatePollDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsOptional()
  @IsIn(['Mañana', 'Tarde', 'Noche'])
  slot?: string;
}
