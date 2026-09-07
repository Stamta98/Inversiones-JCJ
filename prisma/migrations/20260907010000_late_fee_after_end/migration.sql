-- La mora que corre por vencerse el crédito entero, no por atrasarse una cuota.
ALTER TYPE "LateFeeMode" ADD VALUE 'PERCENT_OF_BALANCE_PER_DAY_AFTER_END';
ALTER TYPE "LateFeeMode" ADD VALUE 'FIXED_PER_DAY_AFTER_END';
