-- El cupo de préstamo del cliente: hasta cuánto se le presta.
--
-- Arranca en cero, que es "sin cupo asignado todavía". Se guarda con la misma
-- forma que el resto del dinero, dos decimales, para que no haya que redondear
-- al compararlo con un capital.

ALTER TABLE "Customer" ADD COLUMN "creditLimit" DECIMAL(18,2) NOT NULL DEFAULT 0;
