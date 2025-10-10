/*
  Warnings:

  - You are about to drop the column `document` on the `Guest` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `Staff` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Guest` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `Guest` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `Reservation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `capacity` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Room` table without a default value. This is not possible if the table is not empty.
  - Made the column `title` on table `Room` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `passwordHash` to the `Staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Staff` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Guest" DROP COLUMN "document",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Reservation" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Room" DROP COLUMN "category",
DROP COLUMN "position",
ADD COLUMN     "capacity" INTEGER NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "title" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Staff" DROP COLUMN "password",
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
