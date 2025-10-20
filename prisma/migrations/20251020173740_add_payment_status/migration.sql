-- CreateEnum
CREATE TYPE "public"."PaymentState" AS ENUM ('PENDENTE', 'PAGO');

-- CreateTable
CREATE TABLE "public"."PaymentStatus" (
    "id" TEXT NOT NULL,
    "maidId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "public"."PaymentState" NOT NULL DEFAULT 'PENDENTE',

    CONSTRAINT "PaymentStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentStatus_maidId_date_key" ON "public"."PaymentStatus"("maidId", "date");
