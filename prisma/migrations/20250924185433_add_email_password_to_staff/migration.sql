/*
  Warnings:

  - The primary key for the `Guest` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `updatedAt` on the `Guest` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `guestName` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Reservation` table. All the data in the column will be lost.
  - You are about to drop the column `capacity` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Room` table. All the data in the column will be lost.
  - The primary key for the `Staff` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `passwordHash` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `status` on the `Reservation` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `guestId` on table `Reservation` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `password` to the `Staff` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Reservation" DROP CONSTRAINT "Reservation_guestId_fkey";

-- AlterTable
ALTER TABLE "public"."Guest" DROP CONSTRAINT "Guest_pkey",
DROP COLUMN "updatedAt",
ADD COLUMN     "document" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Guest_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Guest_id_seq";

-- AlterTable
ALTER TABLE "public"."Reservation" DROP COLUMN "createdAt",
DROP COLUMN "guestName",
DROP COLUMN "notes",
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL,
ALTER COLUMN "guestId" SET NOT NULL,
ALTER COLUMN "guestId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."Room" DROP COLUMN "capacity",
DROP COLUMN "createdAt",
DROP COLUMN "name",
DROP COLUMN "notes",
DROP COLUMN "type",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "public"."Staff" DROP CONSTRAINT "Staff_pkey",
DROP COLUMN "passwordHash",
DROP COLUMN "phone",
ADD COLUMN     "password" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Staff_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Staff_id_seq";

-- DropTable
DROP TABLE "public"."User";

-- DropEnum
DROP TYPE "public"."ReservationStatus";

-- DropEnum
DROP TYPE "public"."Role";

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "public"."Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
