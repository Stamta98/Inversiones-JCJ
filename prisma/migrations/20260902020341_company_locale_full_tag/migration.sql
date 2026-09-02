-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "locale" SET DEFAULT 'es-DO';

-- Las empresas que ya existen guardan el idioma sin región, que era el valor
-- por defecto anterior. Con "es" a secas los montos salen como "165.304,18 DOP"
-- en vez de "RD$165,304.18", así que se completan con la región dominicana,
-- que es lo que la aplicación venía usando de forma fija.
UPDATE "Company" SET "locale" = 'es-DO' WHERE "locale" = 'es';
