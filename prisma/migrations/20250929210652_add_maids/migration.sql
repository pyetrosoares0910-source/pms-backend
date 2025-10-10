-- CreateTable
CREATE TABLE "public"."Maid" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "available" TEXT[],

    CONSTRAINT "Maid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Task" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "stay" TEXT NOT NULL,
    "rooms" TEXT NOT NULL,
    "maidId" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_maidId_fkey" FOREIGN KEY ("maidId") REFERENCES "public"."Maid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
