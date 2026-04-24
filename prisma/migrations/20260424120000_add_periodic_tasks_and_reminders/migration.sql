-- CreateEnum
CREATE TYPE "public"."PeriodicTaskFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'YEARLY', 'CUSTOM_DAYS');

-- CreateEnum
CREATE TYPE "public"."PeriodicTaskExecutionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'SKIPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."PeriodicTask" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "public"."PeriodicTaskFrequency" NOT NULL,
    "customIntervalDays" INTEGER,
    "lastExecutionDate" TIMESTAMP(3),
    "nextExecutionDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodicTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PeriodicTaskExecution" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "assignedToId" INTEGER,
    "executionDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."PeriodicTaskExecutionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeriodicTaskExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OperationalReminder" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeriodicTask_active_nextExecutionDate_idx" ON "public"."PeriodicTask"("active", "nextExecutionDate");

-- CreateIndex
CREATE INDEX "PeriodicTask_roomId_idx" ON "public"."PeriodicTask"("roomId");

-- CreateIndex
CREATE INDEX "PeriodicTaskExecution_executionDate_idx" ON "public"."PeriodicTaskExecution"("executionDate");

-- CreateIndex
CREATE INDEX "PeriodicTaskExecution_assignedToId_idx" ON "public"."PeriodicTaskExecution"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodicTaskExecution_taskId_roomId_executionDate_key" ON "public"."PeriodicTaskExecution"("taskId", "roomId", "executionDate");

-- CreateIndex
CREATE INDEX "OperationalReminder_stayId_active_idx" ON "public"."OperationalReminder"("stayId", "active");

-- CreateIndex
CREATE INDEX "OperationalReminder_startsAt_endsAt_idx" ON "public"."OperationalReminder"("startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "public"."PeriodicTask" ADD CONSTRAINT "PeriodicTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PeriodicTaskExecution" ADD CONSTRAINT "PeriodicTaskExecution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."PeriodicTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PeriodicTaskExecution" ADD CONSTRAINT "PeriodicTaskExecution_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PeriodicTaskExecution" ADD CONSTRAINT "PeriodicTaskExecution_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."Maid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OperationalReminder" ADD CONSTRAINT "OperationalReminder_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
