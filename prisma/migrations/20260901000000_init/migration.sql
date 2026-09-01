-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";
-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');
-- CreateEnum
CREATE TYPE "PaydayKind" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY', 'IRREGULAR');
-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('INDEPENDENT', 'EMPLOYEE', 'OTHER');
-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('ID_FRONT', 'ID_BACK', 'PROOF_OF_ADDRESS', 'PLACE_PHOTO', 'COLLATERAL', 'CONTRACT', 'OTHER');
-- CreateEnum
CREATE TYPE "InterestMethod" AS ENUM ('FLAT', 'FRENCH', 'GERMAN', 'AMERICAN', 'CREDIT_LINE');
-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('DAILY', 'EVERY_OTHER_DAY', 'TWICE_WEEKLY', 'WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'SINGLE', 'CUSTOM');
-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'IN_ARREARS', 'PAID', 'CANCELLED', 'WRITTEN_OFF');
-- CreateEnum
CREATE TYPE "LateFeeMode" AS ENUM ('NONE', 'PERCENT_OF_INSTALLMENT', 'PERCENT_PER_DAY', 'FIXED_PER_DAY', 'FIXED_ONCE');
-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED');
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'CHECK', 'MOBILE_WALLET', 'OTHER');
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('POSTED', 'REVERSED');
-- CreateEnum
CREATE TYPE "CashBoxKind" AS ENUM ('CASH', 'BANK');
-- CreateEnum
CREATE TYPE "CashMovementKind" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'LOAN_DISBURSEMENT', 'PAYMENT_RECEIVED', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT');
-- CreateEnum
CREATE TYPE "RouteStopStatus" AS ENUM ('PENDING', 'VISITED', 'COLLECTED', 'NOT_FOUND', 'PROMISED', 'REFUSED');
-- CreateEnum
CREATE TYPE "TemplateKind" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'DOCUMENT', 'RECEIPT', 'CONTRACT');
-- CreateEnum
CREATE TYPE "MessagingChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');
-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED');
-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('BEFORE_DUE_DATE', 'ON_DUE_DATE', 'AFTER_DUE_DATE', 'ARREARS_THRESHOLD', 'ON_PAYMENT_POSTED', 'ON_LOAN_DISBURSED');
-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'FINISHED');
-- CreateEnum
CREATE TYPE "InteractionChannel" AS ENUM ('CALL', 'WHATSAPP', 'SMS', 'EMAIL', 'VISIT', 'NOTE');
-- CreateEnum
CREATE TYPE "InteractionOutcome" AS ENUM ('PENDING', 'CONTACTED', 'NO_ANSWER', 'WRONG_NUMBER', 'PAYMENT_PROMISED', 'PAYMENT_MADE', 'REFUSED', 'DISPUTE', 'CALLBACK_REQUESTED');
-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'DATETIME', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'PHONE', 'EMAIL', 'URL', 'FILE');
-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "logoUrl" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'DOP',
    "locale" TEXT NOT NULL DEFAULT 'es',
    "timezone" TEXT NOT NULL DEFAULT 'America/Santo_Domingo',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ModuleInstallation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModuleInstallation_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "CompanySetting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobilePhone" TEXT,
    "address" TEXT,
    "neighborhood" TEXT,
    "landmark" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "birthDate" TIMESTAMP(3),
    "employmentType" "EmploymentType",
    "occupation" TEXT,
    "employerName" TEXT,
    "workAddress" TEXT,
    "workNeighborhood" TEXT,
    "workLandmark" TEXT,
    "workLatitude" DOUBLE PRECISION,
    "workLongitude" DOUBLE PRECISION,
    "monthlyIncome" DECIMAL(18,2),
    "paydayKind" "PaydayKind",
    "paydayWeekday" INTEGER,
    "paydayDayOfMonth" INTEGER,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "photoUrl" TEXT,
    "creditScore" INTEGER,
    "notes" TEXT,
    "customValues" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "CustomerReference" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerReference_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "loanId" TEXT,
    "kind" "AttachmentKind" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "LoanProduct" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "interestMethod" "InterestMethod" NOT NULL DEFAULT 'FLAT',
    "interestRate" DECIMAL(9,4) NOT NULL,
    "frequency" "PaymentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "customIntervalDays" INTEGER,
    "nonCollectionDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "defaultTermCount" INTEGER NOT NULL DEFAULT 12,
    "minAmount" DECIMAL(18,2),
    "maxAmount" DECIMAL(18,2),
    "lateFeeMode" "LateFeeMode" NOT NULL DEFAULT 'NONE',
    "lateFeeValue" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoanProduct_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "customerId" TEXT NOT NULL,
    "loanProductId" TEXT,
    "code" TEXT NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL,
    "interestMethod" "InterestMethod" NOT NULL,
    "interestRate" DECIMAL(9,4) NOT NULL,
    "frequency" "PaymentFrequency" NOT NULL,
    "customIntervalDays" INTEGER,
    "nonCollectionDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "termCount" INTEGER NOT NULL,
    "disbursedAt" TIMESTAMP(3),
    "firstDueDate" TIMESTAMP(3) NOT NULL,
    "closingDate" TIMESTAMP(3),
    "status" "LoanStatus" NOT NULL DEFAULT 'DRAFT',
    "lateFeeMode" "LateFeeMode" NOT NULL DEFAULT 'NONE',
    "lateFeeValue" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "totalPrincipal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalInterest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalLateFees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstanding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "daysInArrears" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "customValues" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "LoanInstallment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalAmount" DECIMAL(18,2) NOT NULL,
    "interestAmount" DECIMAL(18,2) NOT NULL,
    "lateFeeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoanInstallment_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "cashBoxId" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "PaymentStatus" NOT NULL DEFAULT 'POSTED',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "notes" TEXT,
    "collectedById" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "reversedAt" TIMESTAMP(3),
    "reversalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "principalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interestAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lateFeeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "CashBox" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "kind" "CashBoxKind" NOT NULL DEFAULT 'CASH',
    "accountNumber" TEXT,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashBox_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "cashBoxId" TEXT NOT NULL,
    "kind" "CashMovementKind" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "paymentId" TEXT,
    "expenseId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT,
    "cashBoxId" TEXT,
    "loanId" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "CollectionRoute" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollectionRoute_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "loanId" TEXT,
    "collectorId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "RouteStopStatus" NOT NULL DEFAULT 'PENDING',
    "expectedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "collectedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "visitedAt" TIMESTAMP(3),
    "promisedFor" TIMESTAMP(3),
    "notes" TEXT,
    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TemplateKind" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "MessagingAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "channel" "MessagingChannel" NOT NULL DEFAULT 'WHATSAPP',
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MessagingAccount_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "OutboundMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "messagingAccountId" TEXT,
    "customerId" TEXT,
    "loanId" TEXT,
    "templateId" TEXT,
    "automationRuleId" TEXT,
    "channel" "MessagingChannel" NOT NULL DEFAULT 'WHATSAPP',
    "toAddress" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "providerMessageId" TEXT,
    "dedupeKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "AutomationTrigger" NOT NULL,
    "offsetDays" INTEGER NOT NULL DEFAULT 0,
    "channel" "MessagingChannel" NOT NULL DEFAULT 'WHATSAPP',
    "templateId" TEXT NOT NULL,
    "sendAtTime" TEXT NOT NULL DEFAULT '09:00',
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT,
    "customerId" TEXT NOT NULL,
    "loanId" TEXT,
    "agentId" TEXT,
    "channel" "InteractionChannel" NOT NULL DEFAULT 'CALL',
    "outcome" "InteractionOutcome" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "promisedAmount" DECIMAL(18,2),
    "promisedFor" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "CustomEntity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pluralName" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "extendsKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomEntity_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL DEFAULT 'TEXT',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isUnique" BOOLEAN NOT NULL DEFAULT false,
    "showInList" BOOLEAN NOT NULL DEFAULT true,
    "helpText" TEXT,
    "defaultValue" TEXT,
    "options" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "CustomRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ownerId" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomRecord_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "Company_isActive_idx" ON "Company"("isActive");
-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");
-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_code_key" ON "Branch"("companyId", "code");
-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
-- CreateIndex
CREATE INDEX "Membership_companyId_idx" ON "Membership"("companyId");
-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_companyId_key" ON "Membership"("userId", "companyId");
-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");
-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_key_key" ON "Role"("companyId", "key");
-- CreateIndex
CREATE INDEX "ModuleInstallation_companyId_idx" ON "ModuleInstallation"("companyId");
-- CreateIndex
CREATE UNIQUE INDEX "ModuleInstallation_companyId_moduleKey_key" ON "ModuleInstallation"("companyId", "moduleKey");
-- CreateIndex
CREATE UNIQUE INDEX "CompanySetting_companyId_key_key" ON "CompanySetting"("companyId", "key");
-- CreateIndex
CREATE INDEX "Translation_companyId_locale_idx" ON "Translation"("companyId", "locale");
-- CreateIndex
CREATE UNIQUE INDEX "Translation_companyId_locale_key_key" ON "Translation"("companyId", "locale", "key");
-- CreateIndex
CREATE INDEX "Customer_companyId_status_idx" ON "Customer"("companyId", "status");
-- CreateIndex
CREATE INDEX "Customer_companyId_lastName_firstName_idx" ON "Customer"("companyId", "lastName", "firstName");
-- CreateIndex
CREATE INDEX "Customer_companyId_documentNumber_idx" ON "Customer"("companyId", "documentNumber");
-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_code_key" ON "Customer"("companyId", "code");
-- CreateIndex
CREATE INDEX "CustomerReference_customerId_idx" ON "CustomerReference"("customerId");
-- CreateIndex
CREATE INDEX "Attachment_customerId_kind_idx" ON "Attachment"("customerId", "kind");
-- CreateIndex
CREATE INDEX "Attachment_loanId_idx" ON "Attachment"("loanId");
-- CreateIndex
CREATE INDEX "LoanProduct_companyId_isActive_idx" ON "LoanProduct"("companyId", "isActive");
-- CreateIndex
CREATE INDEX "Loan_companyId_status_idx" ON "Loan"("companyId", "status");
-- CreateIndex
CREATE INDEX "Loan_customerId_idx" ON "Loan"("customerId");
-- CreateIndex
CREATE INDEX "Loan_companyId_firstDueDate_idx" ON "Loan"("companyId", "firstDueDate");
-- CreateIndex
CREATE UNIQUE INDEX "Loan_companyId_code_key" ON "Loan"("companyId", "code");
-- CreateIndex
CREATE INDEX "LoanInstallment_loanId_status_idx" ON "LoanInstallment"("loanId", "status");
-- CreateIndex
CREATE INDEX "LoanInstallment_dueDate_idx" ON "LoanInstallment"("dueDate");
-- CreateIndex
CREATE UNIQUE INDEX "LoanInstallment_loanId_number_key" ON "LoanInstallment"("loanId", "number");
-- CreateIndex
CREATE INDEX "Payment_companyId_paidAt_idx" ON "Payment"("companyId", "paidAt");
-- CreateIndex
CREATE INDEX "Payment_loanId_idx" ON "Payment"("loanId");
-- CreateIndex
CREATE UNIQUE INDEX "Payment_companyId_receiptNumber_key" ON "Payment"("companyId", "receiptNumber");
-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");
-- CreateIndex
CREATE INDEX "PaymentAllocation_installmentId_idx" ON "PaymentAllocation"("installmentId");
-- CreateIndex
CREATE INDEX "CashBox_companyId_isActive_idx" ON "CashBox"("companyId", "isActive");
-- CreateIndex
CREATE INDEX "CashMovement_cashBoxId_createdAt_idx" ON "CashMovement"("cashBoxId", "createdAt");
-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_companyId_name_key" ON "ExpenseCategory"("companyId", "name");
-- CreateIndex
CREATE INDEX "Expense_companyId_spentAt_idx" ON "Expense"("companyId", "spentAt");
-- CreateIndex
CREATE INDEX "CollectionRoute_companyId_isActive_idx" ON "CollectionRoute"("companyId", "isActive");
-- CreateIndex
CREATE INDEX "RouteStop_routeId_sortOrder_idx" ON "RouteStop"("routeId", "sortOrder");
-- CreateIndex
CREATE INDEX "RouteStop_collectorId_status_idx" ON "RouteStop"("collectorId", "status");
-- CreateIndex
CREATE INDEX "Template_companyId_kind_idx" ON "Template"("companyId", "kind");
-- CreateIndex
CREATE UNIQUE INDEX "Template_companyId_key_key" ON "Template"("companyId", "key");
-- CreateIndex
CREATE INDEX "MessagingAccount_companyId_channel_idx" ON "MessagingAccount"("companyId", "channel");
-- CreateIndex
CREATE INDEX "OutboundMessage_companyId_status_scheduledFor_idx" ON "OutboundMessage"("companyId", "status", "scheduledFor");
-- CreateIndex
CREATE INDEX "OutboundMessage_customerId_idx" ON "OutboundMessage"("customerId");
-- CreateIndex
CREATE UNIQUE INDEX "OutboundMessage_companyId_dedupeKey_key" ON "OutboundMessage"("companyId", "dedupeKey");
-- CreateIndex
CREATE INDEX "AutomationRule_companyId_isActive_idx" ON "AutomationRule"("companyId", "isActive");
-- CreateIndex
CREATE INDEX "Campaign_companyId_status_idx" ON "Campaign"("companyId", "status");
-- CreateIndex
CREATE INDEX "Interaction_companyId_occurredAt_idx" ON "Interaction"("companyId", "occurredAt");
-- CreateIndex
CREATE INDEX "Interaction_customerId_idx" ON "Interaction"("customerId");
-- CreateIndex
CREATE INDEX "Interaction_campaignId_outcome_idx" ON "Interaction"("campaignId", "outcome");
-- CreateIndex
CREATE INDEX "CustomEntity_companyId_isActive_idx" ON "CustomEntity"("companyId", "isActive");
-- CreateIndex
CREATE UNIQUE INDEX "CustomEntity_companyId_key_key" ON "CustomEntity"("companyId", "key");
-- CreateIndex
CREATE INDEX "CustomField_entityId_sortOrder_idx" ON "CustomField"("entityId", "sortOrder");
-- CreateIndex
CREATE UNIQUE INDEX "CustomField_entityId_key_key" ON "CustomField"("entityId", "key");
-- CreateIndex
CREATE INDEX "CustomRecord_entityId_createdAt_idx" ON "CustomRecord"("entityId", "createdAt");
-- CreateIndex
CREATE INDEX "CustomRecord_companyId_ownerId_idx" ON "CustomRecord"("companyId", "ownerId");
-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");
-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ModuleInstallation" ADD CONSTRAINT "ModuleInstallation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CompanySetting" ADD CONSTRAINT "CompanySetting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CustomerReference" ADD CONSTRAINT "CustomerReference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "LoanProduct" ADD CONSTRAINT "LoanProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_loanProductId_fkey" FOREIGN KEY ("loanProductId") REFERENCES "LoanProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "LoanInstallment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CashBox" ADD CONSTRAINT "CashBox_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CashBox" ADD CONSTRAINT "CashBox_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CollectionRoute" ADD CONSTRAINT "CollectionRoute_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CollectionRoute" ADD CONSTRAINT "CollectionRoute_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "CollectionRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "MessagingAccount" ADD CONSTRAINT "MessagingAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_messagingAccountId_fkey" FOREIGN KEY ("messagingAccountId") REFERENCES "MessagingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_automationRuleId_fkey" FOREIGN KEY ("automationRuleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CustomEntity" ADD CONSTRAINT "CustomEntity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "CustomEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CustomRecord" ADD CONSTRAINT "CustomRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "CustomRecord" ADD CONSTRAINT "CustomRecord_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "CustomEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
