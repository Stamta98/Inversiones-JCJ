-- Closing a route freezes what it collected, and every stop can now point at
-- the receipt the visit produced.
ALTER TABLE "CollectionRoute" ADD COLUMN "closedAt" TIMESTAMP(3);

ALTER TABLE "RouteStop" ADD COLUMN "paymentId" TEXT;

ALTER TABLE "RouteStop"
  ADD CONSTRAINT "RouteStop_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RouteStop_paymentId_idx" ON "RouteStop"("paymentId");

-- Listing the routes of a day is the first thing the screen does.
CREATE INDEX "CollectionRoute_companyId_scheduledFor_idx"
  ON "CollectionRoute"("companyId", "scheduledFor");
