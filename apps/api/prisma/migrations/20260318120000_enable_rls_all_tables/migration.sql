-- Enable Row Level Security on all tables.
-- With RLS enabled and no policies for the anon role,
-- direct access via Supabase client (anon key) is denied.
-- The NestJS API uses service_role key which bypasses RLS.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_votes ENABLE ROW LEVEL SECURITY;
