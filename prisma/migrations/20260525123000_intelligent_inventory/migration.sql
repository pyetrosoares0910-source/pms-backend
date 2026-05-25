CREATE TYPE "public"."ProductOperationType" AS ENUM ('CHECKOUT_CLEANING', 'DAILY_CLEANING', 'DEEP_CLEANING', 'COMMON_AREA', 'LAUNDRY', 'MAINTENANCE', 'WASTE', 'ADJUSTMENT', 'OTHER');
CREATE TYPE "public"."ProductLotStatus" AS ENUM ('SEALED', 'OPEN', 'DEPLETED', 'EXPIRED', 'DISCARDED');
CREATE TYPE "public"."ProductAlertType" AS ENUM ('HIGH_CONSUMPTION', 'LOW_STOCK', 'STAFF_OUTLIER', 'LAUNDRY_SPIKE', 'STALE_PRODUCT', 'EXPIRING_PRODUCT', 'NEGATIVE_STOCK', 'REORDER_SUGGESTION');
CREATE TYPE "public"."ProductAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "public"."LaundryItemType" AS ENUM ('SHEET_SET', 'PILLOWCASE_SET', 'BLANKET', 'BEDSPREAD', 'FACE_TOWEL', 'BATH_TOWEL');

ALTER TABLE "public"."Product"
ADD COLUMN "sku" TEXT,
ADD COLUMN "supplier" TEXT,
ADD COLUMN "minimumStock" DOUBLE PRECISION,
ADD COLUMN "targetStock" DOUBLE PRECISION,
ADD COLUMN "reorderPoint" DOUBLE PRECISION,
ADD COLUMN "shelfLifeDays" INTEGER,
ADD COLUMN "notes" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "public"."ProductLot" (
  "id" TEXT NOT NULL,
  "stayId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "code" TEXT,
  "initialQuantity" DOUBLE PRECISION NOT NULL,
  "remainingQuantity" DOUBLE PRECISION NOT NULL,
  "openedQuantity" DOUBLE PRECISION,
  "status" "public"."ProductLotStatus" NOT NULL DEFAULT 'SEALED',
  "openedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductLot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ProductEntry" (
  "id" TEXT NOT NULL,
  "stayId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "lotId" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "baseQuantity" DOUBLE PRECISION NOT NULL,
  "supplier" TEXT,
  "totalCost" DOUBLE PRECISION,
  "unitCost" DOUBLE PRECISION,
  "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "invoiceNumber" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ProductConsumption" (
  "id" TEXT NOT NULL,
  "stayId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "lotId" TEXT,
  "roomId" TEXT,
  "reservationId" TEXT,
  "staffId" TEXT,
  "maidId" INTEGER,
  "operationType" "public"."ProductOperationType" NOT NULL,
  "location" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "baseQuantity" DOUBLE PRECISION NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedQuantity" DOUBLE PRECISION,
  "anomalyScore" DOUBLE PRECISION,
  "anomalyReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductConsumption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ProductAlert" (
  "id" TEXT NOT NULL,
  "stayId" TEXT,
  "productId" TEXT,
  "type" "public"."ProductAlertType" NOT NULL,
  "severity" "public"."ProductAlertSeverity" NOT NULL DEFAULT 'INFO',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metric" DOUBLE PRECISION,
  "baseline" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'open',
  "metadata" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "ProductAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ProductPrediction" (
  "id" TEXT NOT NULL,
  "stayId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "horizonDays" INTEGER NOT NULL DEFAULT 30,
  "dailyAverage" DOUBLE PRECISION NOT NULL,
  "projectedDemand" DOUBLE PRECISION NOT NULL,
  "currentStock" DOUBLE PRECISION NOT NULL,
  "daysRemaining" DOUBLE PRECISION,
  "reorderDate" TIMESTAMP(3),
  "recommendedQuantity" DOUBLE PRECISION,
  "confidence" DOUBLE PRECISION,
  "metadata" JSONB,
  CONSTRAINT "ProductPrediction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ProductInventorySnapshot" (
  "id" TEXT NOT NULL,
  "stayId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "capacity" DOUBLE PRECISION,
  "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL DEFAULT 'system',
  "notes" TEXT,
  CONSTRAINT "ProductInventorySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."LaundryDispatch" (
  "id" TEXT NOT NULL,
  "stayId" TEXT NOT NULL,
  "roomId" TEXT,
  "reservationId" TEXT,
  "maidId" INTEGER,
  "dispatchDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedSets" INTEGER NOT NULL DEFAULT 2,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LaundryDispatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."LaundryDispatchItem" (
  "id" TEXT NOT NULL,
  "dispatchId" TEXT NOT NULL,
  "itemType" "public"."LaundryItemType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPieces" INTEGER NOT NULL,
  "notes" TEXT,
  CONSTRAINT "LaundryDispatchItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductLot_stayId_productId_status_idx" ON "public"."ProductLot"("stayId", "productId", "status");
CREATE INDEX "ProductLot_expiresAt_idx" ON "public"."ProductLot"("expiresAt");
CREATE INDEX "ProductEntry_stayId_entryDate_idx" ON "public"."ProductEntry"("stayId", "entryDate");
CREATE INDEX "ProductEntry_productId_idx" ON "public"."ProductEntry"("productId");
CREATE INDEX "ProductEntry_expiresAt_idx" ON "public"."ProductEntry"("expiresAt");
CREATE INDEX "ProductConsumption_stayId_occurredAt_idx" ON "public"."ProductConsumption"("stayId", "occurredAt");
CREATE INDEX "ProductConsumption_productId_occurredAt_idx" ON "public"."ProductConsumption"("productId", "occurredAt");
CREATE INDEX "ProductConsumption_operationType_idx" ON "public"."ProductConsumption"("operationType");
CREATE INDEX "ProductConsumption_staffId_idx" ON "public"."ProductConsumption"("staffId");
CREATE INDEX "ProductConsumption_maidId_idx" ON "public"."ProductConsumption"("maidId");
CREATE INDEX "ProductConsumption_roomId_idx" ON "public"."ProductConsumption"("roomId");
CREATE INDEX "ProductConsumption_reservationId_idx" ON "public"."ProductConsumption"("reservationId");
CREATE INDEX "ProductAlert_status_severity_idx" ON "public"."ProductAlert"("status", "severity");
CREATE INDEX "ProductAlert_detectedAt_idx" ON "public"."ProductAlert"("detectedAt");
CREATE INDEX "ProductAlert_productId_idx" ON "public"."ProductAlert"("productId");
CREATE INDEX "ProductPrediction_stayId_calculatedAt_idx" ON "public"."ProductPrediction"("stayId", "calculatedAt");
CREATE INDEX "ProductPrediction_productId_idx" ON "public"."ProductPrediction"("productId");
CREATE INDEX "ProductInventorySnapshot_stayId_snapshotAt_idx" ON "public"."ProductInventorySnapshot"("stayId", "snapshotAt");
CREATE INDEX "ProductInventorySnapshot_productId_idx" ON "public"."ProductInventorySnapshot"("productId");
CREATE INDEX "LaundryDispatch_stayId_dispatchDate_idx" ON "public"."LaundryDispatch"("stayId", "dispatchDate");
CREATE INDEX "LaundryDispatch_roomId_idx" ON "public"."LaundryDispatch"("roomId");
CREATE INDEX "LaundryDispatch_reservationId_idx" ON "public"."LaundryDispatch"("reservationId");
CREATE UNIQUE INDEX "LaundryDispatchItem_dispatchId_itemType_key" ON "public"."LaundryDispatchItem"("dispatchId", "itemType");

ALTER TABLE "public"."ProductLot" ADD CONSTRAINT "ProductLot_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductLot" ADD CONSTRAINT "ProductLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductEntry" ADD CONSTRAINT "ProductEntry_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductEntry" ADD CONSTRAINT "ProductEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductEntry" ADD CONSTRAINT "ProductEntry_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "public"."ProductLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProductConsumption" ADD CONSTRAINT "ProductConsumption_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductConsumption" ADD CONSTRAINT "ProductConsumption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductConsumption" ADD CONSTRAINT "ProductConsumption_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "public"."ProductLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProductConsumption" ADD CONSTRAINT "ProductConsumption_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProductConsumption" ADD CONSTRAINT "ProductConsumption_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "public"."Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProductConsumption" ADD CONSTRAINT "ProductConsumption_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "public"."Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProductConsumption" ADD CONSTRAINT "ProductConsumption_maidId_fkey" FOREIGN KEY ("maidId") REFERENCES "public"."Maid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProductAlert" ADD CONSTRAINT "ProductAlert_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProductAlert" ADD CONSTRAINT "ProductAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."ProductPrediction" ADD CONSTRAINT "ProductPrediction_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductPrediction" ADD CONSTRAINT "ProductPrediction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductInventorySnapshot" ADD CONSTRAINT "ProductInventorySnapshot_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductInventorySnapshot" ADD CONSTRAINT "ProductInventorySnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."LaundryDispatch" ADD CONSTRAINT "LaundryDispatch_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."LaundryDispatch" ADD CONSTRAINT "LaundryDispatch_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."LaundryDispatch" ADD CONSTRAINT "LaundryDispatch_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "public"."Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."LaundryDispatch" ADD CONSTRAINT "LaundryDispatch_maidId_fkey" FOREIGN KEY ("maidId") REFERENCES "public"."Maid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."LaundryDispatchItem" ADD CONSTRAINT "LaundryDispatchItem_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "public"."LaundryDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
