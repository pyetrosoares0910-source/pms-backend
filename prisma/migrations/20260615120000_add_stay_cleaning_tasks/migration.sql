ALTER TABLE "Task"
ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'CHECKOUT',
ADD COLUMN "reservationId" TEXT,
ADD COLUMN "recurrenceWeekday" INTEGER,
ADD COLUMN "notes" TEXT;

CREATE INDEX "Task_kind_date_idx" ON "Task"("kind", "date");
CREATE INDEX "Task_reservationId_idx" ON "Task"("reservationId");

ALTER TABLE "Task"
ADD CONSTRAINT "Task_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
