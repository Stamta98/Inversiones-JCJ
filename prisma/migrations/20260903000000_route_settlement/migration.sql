-- A collector's cash, counted at the end of the day: what the receipts say
-- against what actually came back, and who approved the difference.
CREATE TABLE "RouteSettlement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "collectorId" TEXT,
    "expectedAmount" DECIMAL(18,2) NOT NULL,
    "deliveredAmount" DECIMAL(18,2) NOT NULL,
    "differenceAmount" DECIMAL(18,2) NOT NULL,
    "cashBoxId" TEXT,
    "notes" TEXT,
    "settledById" TEXT,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteSettlement_pkey" PRIMARY KEY ("id")
);

-- Closing the day happens once per route.
CREATE UNIQUE INDEX "RouteSettlement_routeId_key" ON "RouteSettlement"("routeId");
CREATE INDEX "RouteSettlement_companyId_settledAt_idx" ON "RouteSettlement"("companyId", "settledAt");
CREATE INDEX "RouteSettlement_collectorId_settledAt_idx" ON "RouteSettlement"("collectorId", "settledAt");

ALTER TABLE "RouteSettlement" ADD CONSTRAINT "RouteSettlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteSettlement" ADD CONSTRAINT "RouteSettlement_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CollectionRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteSettlement" ADD CONSTRAINT "RouteSettlement_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RouteSettlement" ADD CONSTRAINT "RouteSettlement_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RouteSettlement" ADD CONSTRAINT "RouteSettlement_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Locked down like every other table: Supabase publishes a REST API over the
-- public schema, and the anon key is public by design. Without this, anyone
-- could read what every collector handed in.
DO $$
BEGIN
  ALTER TABLE public."RouteSettlement" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public."RouteSettlement" FORCE ROW LEVEL SECURITY;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public."RouteSettlement" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public."RouteSettlement" FROM authenticated;
  END IF;
END
$$;
