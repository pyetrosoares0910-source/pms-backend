ALTER TABLE "public"."Room"
ADD COLUMN "preparedBeds" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "laundryTemplate" JSONB;

ALTER TYPE "public"."LaundryItemType" ADD VALUE IF NOT EXISTS 'FITTED_SHEET';
ALTER TYPE "public"."LaundryItemType" ADD VALUE IF NOT EXISTS 'TOP_SHEET';
ALTER TYPE "public"."LaundryItemType" ADD VALUE IF NOT EXISTS 'PILLOWCASE';

ALTER TABLE "public"."Product"
ADD COLUMN "packageBaseQuantity" DOUBLE PRECISION,
ADD COLUMN "unitsPerPackage" DOUBLE PRECISION,
ADD COLUMN "usageUnit" TEXT,
ADD COLUMN "corridorWeight" DOUBLE PRECISION DEFAULT 1;

ALTER TABLE "public"."ProductLot"
ADD COLUMN "depletedAt" TIMESTAMP(3);

CREATE TABLE "public"."ProductUsageCycle" (
  "id" TEXT NOT NULL,
  "stayId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "lotId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3) NOT NULL,
  "consumedQuantity" DOUBLE PRECISION NOT NULL,
  "checkoutCount" INTEGER NOT NULL,
  "corridorDays" INTEGER NOT NULL,
  "weightedOperations" DOUBLE PRECISION NOT NULL,
  "avgPerCheckout" DOUBLE PRECISION,
  "avgPerCorridorDay" DOUBLE PRECISION,
  "avgPerWeightedOperation" DOUBLE PRECISION,
  "costPerCheckout" DOUBLE PRECISION,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductUsageCycle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductUsageCycle_stayId_startedAt_endedAt_idx" ON "public"."ProductUsageCycle"("stayId", "startedAt", "endedAt");
CREATE INDEX "ProductUsageCycle_productId_idx" ON "public"."ProductUsageCycle"("productId");
CREATE INDEX "ProductUsageCycle_lotId_idx" ON "public"."ProductUsageCycle"("lotId");

ALTER TABLE "public"."ProductUsageCycle" ADD CONSTRAINT "ProductUsageCycle_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductUsageCycle" ADD CONSTRAINT "ProductUsageCycle_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."ProductUsageCycle" ADD CONSTRAINT "ProductUsageCycle_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "public"."ProductLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
