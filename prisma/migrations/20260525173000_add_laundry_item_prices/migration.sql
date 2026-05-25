CREATE TABLE "LaundryItemPrice" (
  "id" TEXT NOT NULL,
  "itemType" "LaundryItemType" NOT NULL,
  "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LaundryItemPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LaundryItemPrice_itemType_key" ON "LaundryItemPrice"("itemType");
