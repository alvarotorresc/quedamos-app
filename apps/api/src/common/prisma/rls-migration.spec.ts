import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('RLS Migration', () => {
  const migrationsDir = join(__dirname, '../../../prisma/migrations');

  // Las migraciones ya aplicadas no se tocan: cada tabla nueva habilita RLS en
  // la suya, así que la comprobación mira el SQL de todas ellas.
  const allMigrationsSql = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readFileSync(join(migrationsDir, entry.name, 'migration.sql'), 'utf-8'))
    .join('\n')
    // Prisma cita los identificadores; la migración original no lo hacía.
    .replace(/"/g, '');

  it('should enable RLS on every table', () => {
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
      'availability_polls',
      'poll_responses',
    ];
    for (const table of tables) {
      expect(allMigrationsSql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    }
  });
});
