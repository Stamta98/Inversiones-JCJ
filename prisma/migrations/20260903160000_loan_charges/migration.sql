-- Cargos adicionales de un préstamo.
--
-- Lo que se cobra aparte del interés y lleva su propio nombre. Se maneja de
-- dos maneras y la diferencia es de plata, no de forma: descontado sale de lo
-- que se le entrega al cliente, financiado se suma a lo que debe.

CREATE TYPE "ChargeMode" AS ENUM ('DEDUCTED', 'FINANCED');

CREATE TABLE "LoanCharge" (
  "id"        TEXT NOT NULL,
  "loanId"    TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "amount"    DECIMAL(18,2) NOT NULL,
  "mode"      "ChargeMode" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoanCharge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoanCharge_loanId_idx" ON "LoanCharge"("loanId");

ALTER TABLE "LoanCharge"
  ADD CONSTRAINT "LoanCharge_loanId_fkey"
  FOREIGN KEY ("loanId") REFERENCES "Loan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- La parte del cargo que se cobra en cada cuota, y la que cubre cada pago.
ALTER TABLE "LoanInstallment"
  ADD COLUMN "chargeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "PaymentAllocation"
  ADD COLUMN "chargeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- Un cargo descontado nunca sale de la caja, pero es ingreso y tiene que
-- verse como tal en los reportes.
ALTER TYPE "CashMovementKind" ADD VALUE IF NOT EXISTS 'CHARGE_COLLECTED' AFTER 'DEPOSIT';
