ALTER TABLE "Room" ADD COLUMN "selfCheckinEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "AssistedCheckin" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "scheduledArrivalAt" TIMESTAMP(3),
    "rulesMessageSentAt" TIMESTAMP(3),
    "documentsReceivedAt" TIMESTAMP(3),
    "keyDeliveryConfirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistedCheckin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssistedCheckin_reservationId_key" ON "AssistedCheckin"("reservationId");
CREATE INDEX "AssistedCheckin_scheduledArrivalAt_idx" ON "AssistedCheckin"("scheduledArrivalAt");

ALTER TABLE "AssistedCheckin"
ADD CONSTRAINT "AssistedCheckin_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Room"
SET "selfCheckinEnabled" = false
WHERE lower("title") = 'apto 402'
  AND "stayId" IN (
    SELECT "id"
    FROM "Stay"
    WHERE lower("name") LIKE '%clariza%'
  );

INSERT INTO "AssistedCheckin" ("id", "reservationId", "createdAt", "updatedAt")
SELECT 'assisted-' || r."id", r."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Reservation" r
JOIN "Room" room ON room."id" = r."roomId"
WHERE room."selfCheckinEnabled" = false
  AND r."status" <> 'cancelada'
ON CONFLICT ("reservationId") DO NOTHING;
