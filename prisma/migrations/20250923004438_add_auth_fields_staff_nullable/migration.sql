-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'STAFF');

-- AlterTable
ALTER TABLE "public"."Staff" ADD COLUMN     "passwordHash" TEXT;
