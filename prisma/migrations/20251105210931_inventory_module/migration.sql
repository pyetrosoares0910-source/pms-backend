/*
  Warnings:

  - A unique constraint covering the columns `[stayId,title]` on the table `Room` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Stay` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."UnitBase" AS ENUM ('ML', 'G', 'UNIT');

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unitBase" "public"."UnitBase" NOT NULL,
    "packageSizeValue" INTEGER,
    "packageSizeUnit" TEXT,
    "defaultPrice" DECIMAL(65,30),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConsumptionProfile" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "roomId" TEXT,
    "productId" TEXT NOT NULL,
    "consumptionPerCleaning" INTEGER NOT NULL,
    "appliesToCommonAreas" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ConsumptionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Inventory" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Purchase" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(65,30),
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConsumptionEvent" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "roomId" TEXT,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "reservationId" TEXT,

    CONSTRAINT "ConsumptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyCommonConsumptionLog" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCommonConsumptionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "public"."Product"("active");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "public"."Product"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_category_key" ON "public"."Product"("name", "category");

-- CreateIndex
CREATE INDEX "ConsumptionProfile_appliesToCommonAreas_idx" ON "public"."ConsumptionProfile"("appliesToCommonAreas");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumptionProfile_stayId_roomId_productId_key" ON "public"."ConsumptionProfile"("stayId", "roomId", "productId");

-- CreateIndex
CREATE INDEX "Inventory_stayId_idx" ON "public"."Inventory"("stayId");

-- CreateIndex
CREATE INDEX "Inventory_productId_idx" ON "public"."Inventory"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_stayId_productId_key" ON "public"."Inventory"("stayId", "productId");

-- CreateIndex
CREATE INDEX "Purchase_purchaseDate_idx" ON "public"."Purchase"("purchaseDate");

-- CreateIndex
CREATE INDEX "ConsumptionEvent_occurredAt_idx" ON "public"."ConsumptionEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "ConsumptionEvent_reservationId_idx" ON "public"."ConsumptionEvent"("reservationId");

-- CreateIndex
CREATE INDEX "DailyCommonConsumptionLog_date_idx" ON "public"."DailyCommonConsumptionLog"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCommonConsumptionLog_stayId_productId_date_key" ON "public"."DailyCommonConsumptionLog"("stayId", "productId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Room_stayId_title_key" ON "public"."Room"("stayId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "Stay_name_key" ON "public"."Stay"("name");

-- AddForeignKey
ALTER TABLE "public"."ConsumptionProfile" ADD CONSTRAINT "ConsumptionProfile_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsumptionProfile" ADD CONSTRAINT "ConsumptionProfile_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsumptionProfile" ADD CONSTRAINT "ConsumptionProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inventory" ADD CONSTRAINT "Inventory_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Purchase" ADD CONSTRAINT "Purchase_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Purchase" ADD CONSTRAINT "Purchase_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsumptionEvent" ADD CONSTRAINT "ConsumptionEvent_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsumptionEvent" ADD CONSTRAINT "ConsumptionEvent_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsumptionEvent" ADD CONSTRAINT "ConsumptionEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyCommonConsumptionLog" ADD CONSTRAINT "DailyCommonConsumptionLog_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyCommonConsumptionLog" ADD CONSTRAINT "DailyCommonConsumptionLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
