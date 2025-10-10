-- CreateTable
CREATE TABLE "public"."MaintenanceTask" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stayId" TEXT,
    "roomId" TEXT,
    "responsible" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "type" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceTask_code_key" ON "public"."MaintenanceTask"("code");

-- AddForeignKey
ALTER TABLE "public"."MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
