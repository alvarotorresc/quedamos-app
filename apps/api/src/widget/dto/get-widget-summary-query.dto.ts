import { IsISO8601, IsString, IsUUID, Matches } from 'class-validator';

export class GetWidgetSummaryQueryDto {
  @IsUUID()
  groupId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'weekStart must be YYYY-MM-DD format' })
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'weekStart must be a real calendar date' },
  )
  weekStart: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'today must be YYYY-MM-DD format' })
  @IsISO8601(
    { strict: true, strictSeparator: true },
    { message: 'today must be a real calendar date' },
  )
  today: string;
}
