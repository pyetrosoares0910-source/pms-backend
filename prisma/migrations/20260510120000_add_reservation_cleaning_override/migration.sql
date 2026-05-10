ALTER TABLE "Reservation"
ADD COLUMN "cleaningDateOverride" TIMESTAMP(3),
ADD COLUMN "cleaningChangeReason" TEXT;
