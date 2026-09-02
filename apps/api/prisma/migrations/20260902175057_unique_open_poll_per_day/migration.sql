-- Escrito a mano: Prisma no sabe declarar un indice unico parcial, asi que este
-- indice existe en el historial de migraciones pero NO en schema.prisma. Si una
-- futura `prisma migrate dev` genera un DROP INDEX por esa deriva, hay que
-- borrar esa linea de la migracion generada; src/common/prisma/open-poll-unique.spec.ts
-- vigila que el indice siga vivo.
--
-- Sin el, comprobar-y-crear en PollsService.create son dos consultas sin candado:
-- un doble toque en «preguntar» con red lenta deja dos sondeos abiertos identicos
-- en el mazo, cada uno con su propio conteo y ninguno capaz de cerrarse.
--
-- COALESCE porque slot es nullable y Postgres considera distintos los NULL en un
-- indice unico: dos preguntas de dia completo pasarian sin el.
-- CREATE UNIQUE INDEX se valida contra las filas existentes, y el bug que este
-- indice arregla es justo el que produce duplicados: si produccion ya tiene dos
-- sondeos abiertos del mismo dia, el `migrate deploy` abortaria. Cerramos los
-- sobrantes antes, conservando el mas antiguo de cada grupo/dia/franja (el id
-- desempata para que el resultado sea determinista). Va en la misma migracion,
-- asi que limpieza e indice se aplican o se descartan juntos.
UPDATE "availability_polls" p
SET "status" = 'closed'
WHERE p."status" = 'open'
  AND EXISTS (
    SELECT 1
    FROM "availability_polls" q
    WHERE q."status" = 'open'
      AND q."group_id" = p."group_id"
      AND q."date" = p."date"
      AND COALESCE(q."slot", '') = COALESCE(p."slot", '')
      AND (q."created_at", q."id") < (p."created_at", p."id")
  );

CREATE UNIQUE INDEX "availability_polls_open_day_key"
  ON "availability_polls" ("group_id", "date", COALESCE("slot", ''))
  WHERE "status" = 'open';
