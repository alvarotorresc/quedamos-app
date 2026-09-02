-- CreateTable
CREATE TABLE "widget_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ,

    CONSTRAINT "widget_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "widget_tokens_token_hash_key" ON "widget_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "widget_tokens" ADD CONSTRAINT "widget_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EnableRowLevelSecurity
-- Mismo patrón deny-all que el resto de tablas: la API accede por Prisma con
-- credenciales directas; PostgREST (anon/authenticated) no ve nada.
ALTER TABLE "widget_tokens" ENABLE ROW LEVEL SECURITY;
