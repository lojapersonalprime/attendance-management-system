-- Add provider metadata without changing coordinates already used by mobile punches.
ALTER TABLE "AuthorizedLocation"
  ADD COLUMN "placeProvider" VARCHAR(40),
  ADD COLUMN "providerPlaceId" VARCHAR(255),
  ADD COLUMN "formattedAddress" TEXT;

CREATE INDEX "AuthorizedLocation_placeProvider_providerPlaceId_idx"
  ON "AuthorizedLocation"("placeProvider", "providerPlaceId");
