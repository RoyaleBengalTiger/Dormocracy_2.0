/*
  Warnings:

  - The values [OPEN,ASSIGNED,DONE] on the enum `TaskStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TaskStatus_new" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'AWAITING_REVIEW', 'COMPLETED');
ALTER TABLE "public"."Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "public"."TaskStatus_old";
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';
COMMIT;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "mayorId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completionSummary" TEXT,
ADD COLUMN     "mayorReviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_mayorId_fkey" FOREIGN KEY ("mayorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
