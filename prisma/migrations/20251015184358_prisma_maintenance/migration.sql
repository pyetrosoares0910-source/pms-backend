/*
  Warnings:

  - A unique constraint covering the columns `[parentId,dueDate]` on the table `MaintenanceTask` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."MaintenanceTask" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "recurrence" JSONB,
ADD COLUMN     "timezone" TEXT DEFAULT 'America/Sao_Paulo';

-- CreateIndex
CREATE INDEX "MaintenanceTask_parentId_idx" ON "public"."MaintenanceTask"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_parent_dueDate" ON "public"."MaintenanceTask"("parentId", "dueDate");

-- AddForeignKey
ALTER TABLE "public"."MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."MaintenanceTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
