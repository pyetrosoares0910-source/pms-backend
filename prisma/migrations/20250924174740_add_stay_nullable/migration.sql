-- AlterTable
ALTER TABLE "public"."Room" ADD COLUMN     "stayId" TEXT;

-- CreateTable
CREATE TABLE "public"."Stay" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stay_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "public"."Stay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
