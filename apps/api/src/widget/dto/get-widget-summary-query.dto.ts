import { IsString, IsUUID, Matches } from 'class-validator';

export class GetWidgetSummaryQueryDto {
  @IsUUID()
  groupId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'weekStart must be YYYY-MM-DD format' })
  weekStart: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'today must be YYYY-MM-DD format' })
  today: string;
}
