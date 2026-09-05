-- El fiador de un préstamo.
--
-- Es otro cliente de la misma empresa, no una ficha aparte: al fiador se le
-- termina prestando tarde o temprano, y cuando eso pasa ya está registrado
-- con su cédula, su foto y su dirección. Guardarlo como cliente evita tener
-- la misma persona escrita dos veces y sin poder cruzarla.
--
-- Va opcional: hay préstamos que se dan sin fiador y no se puede obligar a
-- inventar uno para los que ya están hechos.
ALTER TABLE "Loan" ADD COLUMN "guarantorId" TEXT;

-- Si se borra la ficha del fiador el préstamo no se cae: se queda sin fiador,
-- que es la verdad, en vez de arrastrar el préstamo con ella.
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_guarantorId_fkey"
  FOREIGN KEY ("guarantorId") REFERENCES "Customer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Para poder preguntar "¿de qué préstamos es fiador esta persona?" sin leer
-- la tabla entera.
CREATE INDEX "Loan_guarantorId_idx" ON "Loan"("guarantorId");
