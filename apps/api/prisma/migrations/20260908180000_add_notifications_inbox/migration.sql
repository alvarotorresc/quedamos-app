-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EnableRowLevelSecurity
-- Mismo punto de partida que el resto de tablas (20260318120000): deny-all.
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

-- La bandeja es la primera tabla que se lee con la anon key en lugar de solo por la
-- API: el cliente se suscribe a sus propios avisos por Realtime. Solo SELECT, solo
-- `authenticated`, y solo las filas propias — insertar, editar y borrar siguen siendo
-- exclusivos de la API (service_role salta RLS).
--
-- `auth.uid()` y la publicacion `supabase_realtime` solo existen en Supabase: CI aplica
-- las migraciones sobre un postgres:15 pelado, asi que ambas sentencias van guardadas y
-- alli no hacen nada. Comprobar en el panel de Supabase tras el deploy.
DO $$
BEGIN
  IF to_regprocedure('auth.uid()') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'notifications'
         AND policyname = 'notifications_select_own'
     )
  THEN
    EXECUTE 'CREATE POLICY "notifications_select_own" ON public.notifications '
         || 'FOR SELECT TO authenticated USING (auth.uid() = user_id)';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'notifications'
     )
  THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END
$$;
