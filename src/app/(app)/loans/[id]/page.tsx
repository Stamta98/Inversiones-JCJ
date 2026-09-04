import { notFound } from "next/navigation";
import Link from "next/link";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  LinkButton,
  PageHeader,
  Select,
  StatCard,
  TableWrap,
  Td,
  Th,
  type Tone,
} from "@/components/ui";
import { canEditAtAll } from "@/core/loans/editable";
import type { LoanStatus } from "@/core/types";
import { formatDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { ShareDocument } from "@/components/ui/share-document";

import { DeletePaymentButton } from "../../payments/delete-payment-button";
import { LoanMenu } from "./loan-menu";
import { disburseLoanAction } from "../actions";
import { PaymentForm } from "./payment-form";

export const dynamic = "force-dynamic";

const LOAN_TONES: Record<string, Tone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "info",
  APPROVED: "info",
  ACTIVE: "positive",
  IN_ARREARS: "danger",
  PAID: "brand",
  CANCELLED: "neutral",
  WRITTEN_OFF: "warning",
};

const INSTALLMENT_TONES: Record<string, Tone> = {
  PENDING: "neutral",
  PARTIALLY_PAID: "info",
  PAID: "positive",
  OVERDUE: "danger",
  WAIVED: "warning",
};

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("loans.read");
  const { id } = await params;

  const [loan, cashBoxes] = await Promise.all([
    db.loan.findFirst({
      where: { id, companyId: context.companyId },
      include: {
        customer: true,
        installments: { orderBy: { number: "asc" } },
        payments: {
          orderBy: { paidAt: "desc" },
          take: 20,
        },
        // A refinance splits one debt across two loans; each has to say so or
        // the money looks like it came from nowhere and went nowhere.
        charges: { orderBy: { createdAt: "asc" } },
        parentLoan: { select: { id: true, code: true } },
        renewals: {
          where: { status: { not: "CANCELLED" } },
          select: { id: true, code: true },
          take: 1,
        },
      },
    }),
    db.cashBox.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!loan) notFound();

  const { t, money } = context;

  const rawPhone = loan.customer.mobilePhone ?? loan.customer.phone;
  const customerPhone = rawPhone ? rawPhone.replace(/\D/g, "") : null;
  const documentMessage = [
    context.companyName,
    `${t("loans.documentTitle")} ${loan.code}`,
    `${t("loans.principal")}: ${money(Number(loan.principal))}`,
    `${t("loans.totalToPay")}: ${money(
      Number(loan.totalPrincipal) + Number(loan.totalInterest),
    )}`,
  ].join("\n");

  const nextOpen = loan.installments.find(
    (installment) =>
      installment.status !== "PAID" && installment.status !== "WAIVED",
  );
  const suggestedAmount = nextOpen
    ? Number(nextOpen.totalAmount) - Number(nextOpen.paidAmount)
    : 0;

  const canCollect =
    can(context, "payments.create") &&
    ["ACTIVE", "IN_ARREARS", "APPROVED"].includes(loan.status);
  const canReverse = can(context, "payments.delete");

  // Una cuota que valga más que capital más interés sin decir por qué se lee
  // como una cuenta mal hecha, así que el cargo solo sale cuando lo hay.
  const hasFinancedCharge = loan.installments.some(
    (installment) => Number(installment.chargeAmount) > 0,
  );
  const deductedCharges = loan.charges
    .filter((charge) => charge.mode === "DEDUCTED")
    .reduce((total, charge) => total + Number(charge.amount), 0);

  // Only an open loan with a balance can be carried onto another, and only
  // once: a second refinance would leave the customer owing the same money
  // twice. The service checks this again, since a URL can be typed by hand.
  const replacement = loan.renewals[0] ?? null;
  const canRenew =
    can(context, "loans.create") &&
    replacement === null &&
    Number(loan.outstanding) > 0 &&
    ["ACTIVE", "IN_ARREARS", "APPROVED"].includes(loan.status);

  return (
    <>
      <PageHeader
        title={`${t("loans.singular")} ${loan.code}`}
        description={`${loan.customer.firstName} ${loan.customer.lastName}`}
        action={
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Badge tone={LOAN_TONES[loan.status] ?? "neutral"}>
              {t(`loans.status.${loan.status}`)}
            </Badge>
            <LoanMenu
              loanId={loan.id}
              customerId={loan.customerId}
              phone={customerPhone}
              message={documentMessage}
              canCreate={can(context, "loans.create")}
              canRenew={canRenew}
              canEdit={
                can(context, "loans.update") &&
                canEditAtAll(loan.status as LoanStatus)
              }
              canDelete={can(context, "loans.delete")}
            />
          </div>
        }
      />

      {/* Ninguno de los dos préstamos se entiende solo: el viejo dice con qué
          quedó saldado y el nuevo de dónde viene el monto. */}
      {loan.parentLoan || replacement ? (
        <div className="mb-4 space-y-2">
          {loan.parentLoan ? (
            <Alert tone="info" icon="refresh">
              <Link
                href={`/loans/${loan.parentLoan.id}`}
                className="underline underline-offset-2"
              >
                {t("loans.renewal.comesFrom").replace(
                  "{code}",
                  loan.parentLoan.code,
                )}
              </Link>
            </Alert>
          ) : null}
          {replacement ? (
            <Alert tone="info" icon="refresh">
              <Link
                href={`/loans/${replacement.id}`}
                className="underline underline-offset-2"
              >
                {t("loans.renewal.replacedBy").replace(
                  "{code}",
                  replacement.code,
                )}
              </Link>
            </Alert>
          ) : null}
        </div>
      ) : null}

      {loan.status === "DRAFT" && can(context, "loans.approve") ? (
        <form action={disburseLoanAction} className="mb-4">
          <input type="hidden" name="loanId" value={loan.id} />
          <Card>
            <CardBody className="flex flex-wrap items-end gap-3">
              {cashBoxes.length > 0 ? (
                <div className="min-w-48 flex-1">
                  <label
                    htmlFor="cashBoxId"
                    className="mb-1.5 block text-xs font-medium text-ink-muted"
                  >
                    {t("payments.cashBox")}
                  </label>
                  <Select id="cashBoxId" name="cashBoxId" defaultValue="">
                    <option value="">{t("common.none")}</option>
                    {cashBoxes.map((cashBox) => (
                      <option key={cashBox.id} value={cashBox.id}>
                        {cashBox.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              <Button type="submit" icon="check">
                {t("loans.disburse")}
              </Button>
            </CardBody>
          </Card>
        </form>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("loans.principal")}
          value={money(Number(loan.principal))}
          hint={`${Number(loan.interestRate)}% ${t(
            `loans.rateBasisShort.${loan.rateBasis}`,
          )}`}
        />
        <StatCard
          label={t("loans.totalToPay")}
          value={money(
            Number(loan.totalPrincipal) +
              Number(loan.totalInterest) +
              Number(loan.totalLateFees),
          )}
          hint={`${t("loans.totalInterest")}: ${money(Number(loan.totalInterest))}`}
        />
        <StatCard
          label={t("loans.outstanding")}
          value={money(Number(loan.outstanding))}
          hint={`${t("loans.paidAmount")}: ${money(Number(loan.totalPaid))}`}
          tone="brand"
        />
        <StatCard
          label={t("loans.daysInArrears")}
          value={String(loan.daysInArrears)}
          hint={`${t("loans.lateFeePart")}: ${money(Number(loan.totalLateFees))}`}
          tone={loan.daysInArrears > 0 ? "danger" : "positive"}
          icon={loan.daysInArrears > 0 ? "alert-triangle" : "check"}
        />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        {canCollect ? (
          <Card className="lg:col-span-2">
            <CardHeader title={t("payments.new")} />
            <CardBody>
              <PaymentForm
                loanId={loan.id}
                suggestedAmount={suggestedAmount}
                cashBoxes={cashBoxes.map((cashBox) => ({
                  id: cashBox.id,
                  label: cashBox.name,
                }))}
                decimalPlaces={context.decimalPlaces}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card className={canCollect ? "" : "lg:col-span-3"}>
          <CardHeader title={t("customers.singular")} />
          <CardBody className="space-y-2 text-sm">
            <Link
              href={`/customers/${loan.customer.id}`}
              className="block font-medium text-brand-strong hover:underline"
            >
              {loan.customer.firstName} {loan.customer.lastName}
            </Link>
            <p className="text-ink-muted">{loan.customer.code}</p>
            {loan.customer.mobilePhone ? (
              <p className="numeric text-ink-muted">
                {loan.customer.mobilePhone}
              </p>
            ) : null}
            {loan.customer.address ? (
              <p className="text-ink-muted">{loan.customer.address}</p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      {loan.charges.length > 0 ? (
        <div className="mt-4">
          <Card>
            <CardHeader
              title={t("loans.charges.title")}
              description={
                deductedCharges > 0
                  ? `${t("loans.charges.handedOver")}: ${money(
                      Number(loan.principal) - deductedCharges,
                    )}`
                  : undefined
              }
            />
            <TableWrap dense>
              <thead>
                <tr>
                  <Th>{t("loans.charges.name")}</Th>
                  <Th>{t("loans.charges.mode")}</Th>
                  <Th align="right">{t("loans.charges.amount")}</Th>
                </tr>
              </thead>
              <tbody>
                {loan.charges.map((charge) => (
                  <tr key={charge.id}>
                    <Td>{charge.name}</Td>
                    <Td>{t(`loans.charges.modeLabel.${charge.mode}`)}</Td>
                    <Td align="right" numeric className="font-medium">
                      {money(Number(charge.amount))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>
        </div>
      ) : null}

      <div className="mt-4">
        <Card>
          <CardHeader
            title={t("loans.documentTitle")}
            description={t("loans.documentHint")}
          />
          <CardBody>
            <ShareDocument
              url={`/api/loans/${loan.id}/pdf`}
              fileName={`${loan.code}.pdf`}
              mimeType="application/pdf"
              message={documentMessage}
              phone={customerPhone}
              shareLabel={t("loans.sharePdf")}
              downloadLabel={t("loans.downloadPdf")}
              busyLabel={t("payments.sharing")}
              fallbackLabel={t("payments.shareFallback")}
              downloadIcon="file-text"
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 space-y-4">
        <CollapsibleCard
          title={t("loans.schedule")}
          description={[
              t(`loans.method.${loan.interestMethod}`),
              loan.frequency === "CUSTOM" && loan.customIntervalDays
                ? `${t("loans.frequencyLabel.CUSTOM")} (${loan.customIntervalDays} días)`
                : t(`loans.frequencyLabel.${loan.frequency}`),
              loan.nonCollectionDays.length > 0
                ? `${t("loans.nonCollectionDays")}: ${loan.nonCollectionDays
                    .map((day) => t(`loans.weekday.${day}`))
                    .join(", ")}`
                : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          {loan.interestMethod === "CREDIT_LINE" ? (
            <CardBody className="pb-0">
              <Alert tone="info" icon="clock">
                {t("loans.openEndedNotice")}
              </Alert>
            </CardBody>
          ) : null}
          <TableWrap>
            <thead>
              <tr>
                <Th>{t("loans.installment")}</Th>
                <Th>{t("loans.dueDate")}</Th>
                <Th align="right">{t("loans.principalPart")}</Th>
                <Th align="right">{t("loans.interestPart")}</Th>
                {hasFinancedCharge ? (
                  <Th align="right">{t("loans.charges.installmentPart")}</Th>
                ) : null}
                <Th align="right">{t("loans.lateFeePart")}</Th>
                <Th align="right">{t("loans.installmentTotal")}</Th>
                <Th align="right">{t("loans.paidAmount")}</Th>
                <Th align="center">{t("common.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {loan.installments.map((installment) => (
                <tr key={installment.id}>
                  <Td numeric>{installment.number}</Td>
                  <Td numeric>{formatDate(installment.dueDate)}</Td>
                  <Td align="right" numeric>
                    {money(Number(installment.principalAmount))}
                  </Td>
                  <Td align="right" numeric>
                    {money(Number(installment.interestAmount))}
                  </Td>
                  {hasFinancedCharge ? (
                    <Td align="right" numeric>
                      {Number(installment.chargeAmount) > 0
                        ? money(Number(installment.chargeAmount))
                        : "—"}
                    </Td>
                  ) : null}
                  <Td align="right" numeric>
                    {Number(installment.lateFeeAmount) > 0
                      ? money(Number(installment.lateFeeAmount))
                      : "—"}
                  </Td>
                  <Td align="right" numeric className="font-medium">
                    {money(Number(installment.totalAmount))}
                  </Td>
                  <Td align="right" numeric>
                    {money(Number(installment.paidAmount))}
                  </Td>
                  <Td align="center">
                    <Badge
                      tone={INSTALLMENT_TONES[installment.status] ?? "neutral"}
                    >
                      {t(`loans.installmentStatus.${installment.status}`)}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </CollapsibleCard>

        <Card>
          <CardHeader title={t("payments.title")} />
          {loan.payments.length === 0 ? (
            <CardBody>
              <p className="text-sm text-ink-muted">
                {t("payments.emptyHint")}
              </p>
            </CardBody>
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("payments.receiptNumber")}</Th>
                  <Th>{t("payments.paidAt")}</Th>
                  <Th>{t("payments.method")}</Th>
                  <Th align="right">{t("common.amount")}</Th>
                  <Th align="center">{t("common.status")}</Th>
                  {canReverse ? <Th align="right">{""}</Th> : null}
                </tr>
              </thead>
              <tbody>
                {loan.payments.map((payment) => (
                  <tr key={payment.id}>
                    <Td numeric>
                      <Link
                        href={`/payments/${payment.id}`}
                        className="text-brand-strong hover:underline"
                      >
                        {payment.receiptNumber}
                      </Link>
                    </Td>
                    <Td numeric>{formatDate(payment.paidAt)}</Td>
                    <Td>{t(`payments.methodLabel.${payment.method}`)}</Td>
                    <Td align="right" numeric>
                      {money(Number(payment.amount))}
                    </Td>
                    <Td align="center">
                      <Badge
                        tone={
                          payment.status === "REVERSED" ? "danger" : "positive"
                        }
                      >
                        {t(`payments.statusLabel.${payment.status}`)}
                      </Badge>
                    </Td>
                    {canReverse ? (
                      <Td align="right">
                        {/* El recibo de una refinanciación no se toca desde
                            aquí: devolvería el saldo dejando vivo el préstamo
                            que se lo llevó, y el cliente quedaría debiendo dos
                            veces lo mismo. Se deshace anulando ese préstamo. */}
                        {payment.method === "REFINANCE" ? null : (
                          <span className="flex items-center justify-end gap-0.5">
                            <LinkButton
                              href={`/payments/${payment.id}`}
                              variant="ghost"
                              size="sm"
                              icon="pencil"
                              aria-label={t("payments.edit")}
                            />
                            <DeletePaymentButton paymentId={payment.id} />
                          </span>
                        )}
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </>
  );
}
