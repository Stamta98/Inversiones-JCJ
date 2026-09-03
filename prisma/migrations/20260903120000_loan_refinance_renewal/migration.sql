-- Refinancing and renewing a loan.
--
-- A refinance carries an unpaid balance onto a new loan with no money moving.
-- A renewal lends again and discounts what was still owed, so the customer
-- receives the difference. Both settle the old loan with the new one.

-- Settling a balance this way is not a collection. Keeping it out of CASH is
-- what stops a collector being credited with money that never reached them.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'REFINANCE' BEFORE 'OTHER';

CREATE TYPE "LoanOrigin" AS ENUM ('NEW', 'REFINANCE', 'RENEWAL');

ALTER TABLE "Loan"
  ADD COLUMN "origin" "LoanOrigin" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "parentLoanId" TEXT;

ALTER TABLE "Loan"
  ADD CONSTRAINT "Loan_parentLoanId_fkey"
  FOREIGN KEY ("parentLoanId") REFERENCES "Loan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Loan_parentLoanId_idx" ON "Loan"("parentLoanId");
