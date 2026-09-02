import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isCalendarDate } from '../date-utils';

/**
 * Validates a `:date` route parameter as a real YYYY-MM-DD day, the same way the
 * body DTOs do. Route params never go through the global ValidationPipe, so without
 * this an impossible day reached the service and then Prisma.
 */
@Injectable()
export class ParseCalendarDatePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isCalendarDate(value)) {
      throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
    }
    return value;
  }
}
