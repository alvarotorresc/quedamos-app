import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Default page of the bandeja: one screenful and a bit. */
export const INBOX_DEFAULT_LIMIT = 30;
export const INBOX_MAX_LIMIT = 50;

export class ListNotificationsDto {
  /** Page size. Capped so the endpoint cannot be turned into a full dump. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INBOX_MAX_LIMIT)
  limit?: number;

  /** Id of the last notice of the previous page (`nextCursor`). */
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
