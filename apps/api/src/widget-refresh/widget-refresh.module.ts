import { Module } from '@nestjs/common';
import { WidgetRefreshService } from './widget-refresh.service';

/**
 * Data-only pushes that tell the Android widgets of a group to re-read it.
 *
 * Kept apart from NotificationsModule on purpose: nothing here is an announcement to a
 * person — no copy, no preference, no entry in notification_logs — and every domain that
 * changes what a widget shows (availability, polls, events) imports it.
 */
@Module({
  providers: [WidgetRefreshService],
  exports: [WidgetRefreshService],
})
export class WidgetRefreshModule {}
