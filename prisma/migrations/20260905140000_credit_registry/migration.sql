-- La central de riesgo: clientes reportados por una empresa que otra puede
-- consultar por el numero de documento, y el registro de quien consulto.
CREATE TYPE "CreditReportSeverity" AS ENUM ('LATE', 'DEFAULT', 'FRAUD');
CREATE TYPE "CreditReportStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');

CREATE TABLE "CreditReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "loanId" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "mobilePhone" TEXT,
    "city" TEXT,
    "severity" "CreditReportSeverity" NOT NULL DEFAULT 'DEFAULT',
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "daysInArrears" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "noticedAt" TIMESTAMP(3),
    "status" "CreditReportStatus" NOT NULL DEFAULT 'ACTIVE',
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnReason" TEXT,
    "withdrawnById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreditReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditLookup" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "documentNumber" TEXT NOT NULL,
    "foundCount" INTEGER NOT NULL DEFAULT 0,
    "reportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditLookup_pkey" PRIMARY KEY ("id")
);

-- La consulta entra por el documento: es lo unico por lo que se busca.
CREATE INDEX "CreditReport_documentNumber_status_idx" ON "CreditReport"("documentNumber", "status");
CREATE INDEX "CreditReport_companyId_createdAt_idx" ON "CreditReport"("companyId", "createdAt");
CREATE INDEX "CreditReport_customerId_idx" ON "CreditReport"("customerId");
CREATE INDEX "CreditLookup_documentNumber_createdAt_idx" ON "CreditLookup"("documentNumber", "createdAt");
CREATE INDEX "CreditLookup_companyId_createdAt_idx" ON "CreditLookup"("companyId", "createdAt");

ALTER TABLE "CreditReport" ADD CONSTRAINT "CreditReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditReport" ADD CONSTRAINT "CreditReport_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditReport" ADD CONSTRAINT "CreditReport_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditLookup" ADD CONSTRAINT "CreditLookup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditLookup" ADD CONSTRAINT "CreditLookup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditLookup" ADD CONSTRAINT "CreditLookup_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CreditReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
