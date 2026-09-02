import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Prisma no sabe expresar un indice unico parcial, asi que el CREATE UNIQUE INDEX
 * vive escrito a mano dentro de la migracion y no en schema.prisma. Este test es su
 * guardia: si una futura `prisma migrate dev` genera el DROP INDEX por la deriva
 * entre el esquema y el historial, salta aqui antes de llegar a produccion.
 */
describe('Open-poll unique index', () => {
  const migrationsDir = join(__dirname, '../../../prisma/migrations');

  const allMigrationsSql = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readFileSync(join(migrationsDir, entry.name, 'migration.sql'), 'utf-8'))
    .join('\n');

  it('creates a partial unique index over the open polls of a group', () => {
    expect(allMigrationsSql).toContain('CREATE UNIQUE INDEX "availability_polls_open_day_key"');
    // slot es nullable y Postgres considera distintos los NULL en un indice unico,
    // asi que dos preguntas de dia completo colarian sin el COALESCE.
    expect(allMigrationsSql).toContain('COALESCE("slot", \'\')');
    expect(allMigrationsSql).toContain('WHERE "status" = \'open\'');
  });

  it('is never dropped by a later migration', () => {
    expect(allMigrationsSql).not.toContain('DROP INDEX "availability_polls_open_day_key"');
  });

  it('closes any pre-existing duplicate before creating the index', () => {
    // CREATE UNIQUE INDEX se valida contra las filas que ya hay, y el bug que
    // arregla es justo el que las produce: sin la limpieza previa, un `migrate
    // deploy` sobre una produccion con dos sondeos abiertos del mismo dia aborta.
    const dir = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .find((name) => name.endsWith('_unique_open_poll_per_day'));
    expect(dir).toBeDefined();

    const sql = readFileSync(join(migrationsDir, dir as string, 'migration.sql'), 'utf-8');
    // Contra la sentencia, no contra la palabra suelta en un comentario.
    const dedupe = sql.indexOf('SET "status" = \'closed\'');
    const create = sql.indexOf('CREATE UNIQUE INDEX "availability_polls_open_day_key"\n');

    expect(dedupe).toBeGreaterThan(-1);
    expect(dedupe).toBeLessThan(create);
  });
});
