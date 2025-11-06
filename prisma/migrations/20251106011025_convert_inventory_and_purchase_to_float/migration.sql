/*
  Warnings:

  - You are about to alter the column `unitPrice` on the `Purchase` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - Made the column `unitPrice` on table `Purchase` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."Inventory" ALTER COLUMN "quantity" SET DEFAULT 0,
ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "capacity" SET DEFAULT 0,
ALTER COLUMN "capacity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."Purchase" ALTER COLUMN "quantity" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "unitPrice" SET NOT NULL,
ALTER COLUMN "unitPrice" SET DATA TYPE DOUBLE PRECISION;
