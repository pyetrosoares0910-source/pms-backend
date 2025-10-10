/*
  Warnings:

  - The primary key for the `Maid` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `available` on the `Maid` table. All the data in the column will be lost.
  - The `id` column on the `Maid` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `maidId` column on the `Task` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- DropForeignKey
ALTER TABLE "public"."Task" DROP CONSTRAINT "Task_maidId_fkey";

-- AlterTable
ALTER TABLE "public"."Maid" DROP CONSTRAINT "Maid_pkey",
DROP COLUMN "available",
ADD COLUMN     "bank" TEXT NOT NULL DEFAULT 'Não informado',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "pixKey" TEXT NOT NULL DEFAULT 'Não informado',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Maid_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."Task" DROP COLUMN "maidId",
ADD COLUMN     "maidId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_maidId_fkey" FOREIGN KEY ("maidId") REFERENCES "public"."Maid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
