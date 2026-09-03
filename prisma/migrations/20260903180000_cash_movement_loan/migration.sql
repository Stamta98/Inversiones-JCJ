-- El préstamo que movió la plata.
--
-- Sin este enlace, borrar un préstamo dejaría su desembolso suelto en la caja
-- y el saldo diciendo que salió una plata de un préstamo que ya no existe.

ALTER TABLE "CashMovement" ADD COLUMN "loanId" TEXT;

CREATE INDEX "CashMovement_loanId_idx" ON "CashMovement"("loanId");

ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_loanId_fkey"
  FOREIGN KEY ("loanId") REFERENCES "Loan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
