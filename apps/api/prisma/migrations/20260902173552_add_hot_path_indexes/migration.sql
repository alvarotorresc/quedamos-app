-- CreateIndex
CREATE INDEX "availability_group_id_date_idx" ON "availability"("group_id", "date");

-- CreateIndex
CREATE INDEX "event_attendees_user_id_idx" ON "event_attendees"("user_id");

-- CreateIndex
CREATE INDEX "events_group_id_date_idx" ON "events"("group_id", "date");

-- CreateIndex
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");

-- CreateIndex
CREATE INDEX "plan_proposals_group_id_status_idx" ON "plan_proposals"("group_id", "status");

-- CreateIndex
CREATE INDEX "widget_tokens_user_id_idx" ON "widget_tokens"("user_id");
