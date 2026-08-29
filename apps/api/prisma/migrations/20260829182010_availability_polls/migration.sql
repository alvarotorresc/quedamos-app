-- CreateTable
CREATE TABLE "availability_polls" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "date" DATE NOT NULL,
    "slot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_responses" (
    "poll_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "answer" TEXT NOT NULL,
    "responded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_responses_pkey" PRIMARY KEY ("poll_id","user_id")
);

-- CreateIndex
CREATE INDEX "availability_polls_group_id_status_idx" ON "availability_polls"("group_id", "status");

-- AddForeignKey
ALTER TABLE "availability_polls" ADD CONSTRAINT "availability_polls_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_polls" ADD CONSTRAINT "availability_polls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "availability_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EnableRowLevelSecurity
ALTER TABLE "availability_polls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "poll_responses" ENABLE ROW LEVEL SECURITY;
