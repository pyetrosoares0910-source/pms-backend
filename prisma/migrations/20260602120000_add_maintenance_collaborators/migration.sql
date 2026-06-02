-- CreateTable
CREATE TABLE "MaintenanceCollaborator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "cpf" TEXT,
    "pixKey" TEXT,
    "bankName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceCollaborator_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "MaintenanceTask" ADD COLUMN "collaboratorId" TEXT;

-- CreateIndex
CREATE INDEX "MaintenanceCollaborator_active_idx" ON "MaintenanceCollaborator"("active");

-- CreateIndex
CREATE INDEX "MaintenanceCollaborator_name_idx" ON "MaintenanceCollaborator"("name");

-- CreateIndex
CREATE INDEX "MaintenanceTask_collaboratorId_idx" ON "MaintenanceTask"("collaboratorId");

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "MaintenanceCollaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
