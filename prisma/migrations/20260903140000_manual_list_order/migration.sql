-- Letting a company put its own lists in order.
--
-- Zero means "wherever the automatic sort puts it", so every existing company
-- keeps exactly the order it has today until somebody moves a row by hand.

ALTER TABLE "Customer" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Loan" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Customer_companyId_sortOrder_lastName_firstName_idx"
  ON "Customer"("companyId", "sortOrder", "lastName", "firstName");
CREATE INDEX "Loan_companyId_sortOrder_idx" ON "Loan"("companyId", "sortOrder");
