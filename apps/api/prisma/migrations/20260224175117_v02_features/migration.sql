-- AlterTable
ALTER TABLE "events" ADD COLUMN     "end_time" TEXT;

-- AlterTable
ALTER TABLE "group_members" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'member';

-- CreateTable
CREATE TABLE "group_cities" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "group_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_proposals" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "created_by" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "converted_event_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plan_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_votes" (
    "proposal_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vote" TEXT NOT NULL,
    "voted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_votes_pkey" PRIMARY KEY ("proposal_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_proposals_converted_event_id_key" ON "plan_proposals"("converted_event_id");

-- AddForeignKey
ALTER TABLE "group_cities" ADD CONSTRAINT "group_cities_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_proposals" ADD CONSTRAINT "plan_proposals_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_proposals" ADD CONSTRAINT "plan_proposals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_proposals" ADD CONSTRAINT "plan_proposals_converted_event_id_fkey" FOREIGN KEY ("converted_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_votes" ADD CONSTRAINT "plan_votes_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "plan_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_votes" ADD CONSTRAINT "plan_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
