-- Se va el estado "Anulado" de los préstamos.
--
-- Anular ya no existe: para el préstamo que nunca debió hacerse está
-- eliminar, que además devuelve la plata a la caja. El estado se queda sin
-- forma de llegar a él, y un estado al que no se llega solo sirve para
-- confundir al que lee la lista.
--
-- Primero se decide qué pasa con los que ya estaban anulados. No se borran:
-- borrar un préstamo mueve la caja y eso no lo puede hacer una migración a
-- espaldas de nadie. Pasan a "Incobrable", que es el otro estado de cerrado
-- sin haberse pagado, así que siguen cerrados, siguen a la vista y siguen sin
-- cobrarse. Lo que sí cambia es que empiezan a contar como capital prestado,
-- porque un anulado no contaba y un incobrable sí.
UPDATE "Loan" SET status = 'WRITTEN_OFF' WHERE status = 'CANCELLED';

-- Postgres no deja quitar un valor de un enum, así que se hace el tipo de
-- nuevo sin él y se pasa la columna. El valor por defecto estorba mientras
-- se cambia el tipo: se quita y se vuelve a poner igual.
ALTER TYPE "LoanStatus" RENAME TO "LoanStatus_old";

CREATE TYPE "LoanStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'ACTIVE',
  'IN_ARREARS',
  'PAID',
  'WRITTEN_OFF'
);

ALTER TABLE "Loan" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Loan"
  ALTER COLUMN "status" TYPE "LoanStatus" USING "status"::text::"LoanStatus";
ALTER TABLE "Loan" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "LoanStatus_old";
