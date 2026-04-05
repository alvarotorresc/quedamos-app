-- AlterTable
ALTER TABLE "events" ADD COLUMN     "is_online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "meeting_url" TEXT;

-- AlterTable
ALTER TABLE "plan_proposals" ADD COLUMN     "is_online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "meeting_url" TEXT;
