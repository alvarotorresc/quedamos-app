import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Las migraciones ya aplicadas no se tocan: cada indice nuevo llega en la suya,
 * asi que la comprobacion mira el SQL de todas ellas. Mismo estilo que
 * rls-migration.spec.ts.
 */
describe('Hot-path indexes', () => {
  const migrationsDir = join(__dirname, '../../../prisma/migrations');

  const allMigrationsSql = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readFileSync(join(migrationsDir, entry.name, 'migration.sql'), 'utf-8'))
    .join('\n')
    .replace(/"/g, '');

  it.each([
    // events: findAllForGroup y el cron horario no tenian ningun indice.
    'events_group_id_date_idx',
    // availability: el unico indice existente va guiado por user_id, asi que las
    // consultas por groupId (calendario y widget) no podian usarlo.
    'availability_group_id_date_idx',
    // group_members: la PK es (group_id, user_id), filtrar por user_id era un scan.
    'group_members_user_id_idx',
    'event_attendees_user_id_idx',
    'widget_tokens_user_id_idx',
    'plan_proposals_group_id_status_idx',
  ])('declares %s', (indexName) => {
    expect(allMigrationsSql).toContain(`CREATE INDEX ${indexName}`);
  });
});
