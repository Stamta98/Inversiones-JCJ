-- La primera cuota guardada en el préstamo tiene que ser la del plan.
--
-- Se guardaba el día que se escogió en el formulario, pero cuando ese día
-- cae en uno que no se cobra el plan corre la cuota al siguiente. Quedaban
-- dos fechas distintas: la del préstamo, que salía en el contrato y en la
-- tarjeta de "Inicio", y la de la cuota, que es la que de verdad se cobra.
--
-- Esto endereza los préstamos que ya estaban hechos. Solo toca los que no
-- coinciden, y solo los que tienen cuotas: una línea de crédito no tiene
-- plan que copiar.
UPDATE "Loan" AS l
SET "firstDueDate" = p."primera"
FROM (
  SELECT "loanId", MIN("dueDate") AS "primera"
  FROM "LoanInstallment"
  GROUP BY "loanId"
) AS p
WHERE p."loanId" = l."id"
  AND l."firstDueDate" IS DISTINCT FROM p."primera";
