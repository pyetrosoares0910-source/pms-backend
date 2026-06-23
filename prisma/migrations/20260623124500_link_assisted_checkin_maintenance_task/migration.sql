ALTER TABLE "AssistedCheckin" ADD COLUMN "maintenanceTaskId" TEXT;

CREATE UNIQUE INDEX "AssistedCheckin_maintenanceTaskId_key" ON "AssistedCheckin"("maintenanceTaskId");

ALTER TABLE "AssistedCheckin"
ADD CONSTRAINT "AssistedCheckin_maintenanceTaskId_fkey"
FOREIGN KEY ("maintenanceTaskId") REFERENCES "MaintenanceTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
