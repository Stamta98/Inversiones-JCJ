-- Who the customer is, for the contract and for reporting. Both are optional:
-- a customer who would rather not say still gets their loan.
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER');

ALTER TABLE "Customer" ADD COLUMN "gender" "Gender";
ALTER TABLE "Customer" ADD COLUMN "nationality" TEXT;
