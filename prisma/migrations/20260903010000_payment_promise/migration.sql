-- What a customer said they would pay, and whether they did.
--
-- Promises were already being written down in two places, the route and the
-- call centre, and forgotten in both. Kept in one table they can be chased.
CREATE TYPE "PromiseStatus" AS ENUM ('PENDING', 'KEPT', 'BROKEN', 'CANCELLED');
CREATE TYPE "PromiseSource" AS ENUM ('ROUTE', 'CALL', 'MANUAL');

CREATE TABLE "PaymentPromise" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "loanId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "promisedFor" TIMESTAMP(3) NOT NULL,
    "status" "PromiseStatus" NOT NULL DEFAULT 'PENDING',
    "source" "PromiseSource" NOT NULL DEFAULT 'MANUAL',
    "routeStopId" TEXT,
    "interactionId" TEXT,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentPromise_pkey" PRIMARY KEY ("id")
);

-- One promise per visit and per call: saying it again replaces it.
CREATE UNIQUE INDEX "PaymentPromise_routeStopId_key" ON "PaymentPromise"("routeStopId");
CREATE UNIQUE INDEX "PaymentPromise_interactionId_key" ON "PaymentPromise"("interactionId");
CREATE INDEX "PaymentPromise_companyId_status_promisedFor_idx" ON "PaymentPromise"("companyId", "status", "promisedFor");
CREATE INDEX "PaymentPromise_customerId_status_idx" ON "PaymentPromise"("customerId", "status");

ALTER TABLE "PaymentPromise" ADD CONSTRAINT "PaymentPromise_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentPromise" ADD CONSTRAINT "PaymentPromise_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentPromise" ADD CONSTRAINT "PaymentPromise_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentPromise" ADD CONSTRAINT "PaymentPromise_routeStopId_fkey" FOREIGN KEY ("routeStopId") REFERENCES "RouteStop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentPromise" ADD CONSTRAINT "PaymentPromise_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "Interaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentPromise" ADD CONSTRAINT "PaymentPromise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Locked down like every other table: the Supabase anon key is public by
-- design, and this one names customers and what they owe.
DO $$
BEGIN
  ALTER TABLE public."PaymentPromise" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public."PaymentPromise" FORCE ROW LEVEL SECURITY;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public."PaymentPromise" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public."PaymentPromise" FROM authenticated;
  END IF;
END
$$;
