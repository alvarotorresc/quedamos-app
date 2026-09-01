-- EnableRowLevelSecurity
-- notification_logs quedó fuera de 20260318120000_enable_rls_all_tables
-- porque la tabla se creó después (20260409160228). Mismo patrón deny-all
-- que el resto: la API accede por Prisma con credenciales directas.
ALTER TABLE "notification_logs" ENABLE ROW LEVEL SECURITY;
