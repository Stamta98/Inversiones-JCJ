-- What the interest rate is a percentage of.
--
-- The engine read every rate as a rate per installment, so "100 mil al 20% a
-- 30 días" charged 20% thirty times: 600,000 of interest instead of 20,000.
-- New loans are quoted over the whole loan, which is what a lender means.
CREATE TYPE "RateBasis" AS ENUM ('TOTAL', 'PER_PERIOD');

ALTER TABLE "Loan" ADD COLUMN "rateBasis" "RateBasis" NOT NULL DEFAULT 'TOTAL';

-- Every loan that already exists was quoted the old way. Its installments are
-- already written down, and its terms must keep meaning what they meant when
-- the borrower agreed to them.
UPDATE "Loan" SET "rateBasis" = 'PER_PERIOD';
