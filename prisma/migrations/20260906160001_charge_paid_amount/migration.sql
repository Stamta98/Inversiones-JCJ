-- Lo que ya se le ha cobrado a un cargo pendiente. Se cobra por partes, así
-- que sin esto no habría cómo saber cuánto le falta y seguiría ofreciéndose
-- entero después de haberlo abonado.
ALTER TABLE "LoanCharge" ADD COLUMN "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- De qué cargo fue la plata que entró, para poder deshacerlo y para que el
-- préstamo pueda decir con qué movimiento se cobró cada uno.
ALTER TABLE "CashMovement" ADD COLUMN "loanChargeId" TEXT;
ALTER TABLE "CashMovement"
  ADD CONSTRAINT "CashMovement_loanChargeId_fkey"
  FOREIGN KEY ("loanChargeId") REFERENCES "LoanCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "CashMovement_loanChargeId_idx" ON "CashMovement"("loanChargeId");
