import { readFileSync } from 'fs';
import { join } from 'path';

describe('RLS Migration', () => {
  const migrationPath = join(
    __dirname,
    '../../../prisma/migrations/20260318120000_enable_rls_all_tables/migration.sql',
  );

  it('should enable RLS on all 11 tables', () => {
    const sql = readFileSync(migrationPath, 'utf-8');
    const tables = [
      'users',
      'groups',
      'group_members',
      'availability',
      'events',
      'event_attendees',
      'push_tokens',
      'notification_preferences',
      'group_cities',
      'plan_proposals',
      'plan_votes',
    ];
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    }
  });
});
