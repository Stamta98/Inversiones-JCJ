import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { isLate } from "@/core/loans/receipt";
import { formatLongDate } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";
import { loadReceipt } from "@/server/services/receipts";

import { ShareDocument } from "@/components/ui/share-document";

import { ReversePaymentButton } from "../reverse-payment-button";
import { DeleteReceipt } from "./delete-receipt";

export const dynamic = "force-dynamic";

function Row({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-2.5 last:border-b-0">
      <span className="text-sm text-ink-muted">{label}</span>
      <span
        className={[
          "text-right text-sm",
          strong ? "font-semibold" : "font-medium",
          tone ?? "text-ink",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("payments.read");
  const { id } = await params;

  const receipt = await loadReceipt(context.companyId, id);
  if (!receipt) notFound();

  const customerPhone = await db.payment.findFirst({
    where: { id, companyId: context.companyId },
    select: {
      loan: {
        select: { customer: { select: { mobilePhone: true, phone: true } } },
      },
    },
  });

  const { t, money } = context;
  const canDelete = can(context, "payments.delete");
  const voided = receipt.status === "REVERSED";
  const late = isLate({ daysLate: receipt.loan.daysLate });

  const rawPhone =
    customerPhone?.loan.customer.mobilePhone ??
    customerPhone?.loan.customer.phone ??
    null;
  const phone = rawPhone ? rawPhone.replace(/\D/g, "") : null;

  const message = [
    `${receipt.company.name}`,
    `${t("payments.receiptTitle")} ${receipt.receiptNumber}`,
    `${t("payments.receiptApplied")}: ${money(receipt.amount)}`,
    `${t("loans.outstanding")}: ${money(receipt.loan.outstanding)}`,
    receipt.loan.nextDueDate
      ? `${t("payments.receiptNextDue")}: ${formatLongDate(receipt.loan.nextDueDate, context.locale)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <PageHeader
        title={t("payments.receiptOf").replace(
          "{receipt}",
          receipt.receiptNumber,
        )}
        description={receipt.customer.fullName}
        action={
          <LinkButton
            href={`/loans/${receipt.loan.id}`}
            variant="secondary"
            icon="arrow-left"
          >
            {t("common.back")}
          </LinkButton>
        }
      />

      {voided ? (
        <div className="mb-4">
          <Alert tone="danger">{t("payments.receiptVoided")}</Alert>
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t("payments.receiptTitle")}
            action={
              <Badge tone={voided ? "danger" : "positive"}>
                {t(`payments.statusLabel.${receipt.status}`)}
              </Badge>
            }
          />
          <CardBody>
            <div className="rounded-xl bg-surface-muted p-4 text-center">
              <p className="text-xs text-ink-muted">
                {t("payments.receiptApplied")}
              </p>
              <p
                className={[
                  "numeric mt-1 text-3xl font-bold",
                  voided ? "text-danger" : "text-brand-strong",
                ].join(" ")}
              >
                {money(receipt.amount)}
              </p>
              {late ? (
                <p className="mt-2 inline-block rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning">
                  {t("payments.receiptLate").replace(
                    "{days}",
                    String(receipt.loan.daysLate),
                  )}
                </p>
              ) : null}
            </div>

            <dl className="mt-4">
              <Row
                label={t("loans.customer")}
                value={receipt.customer.fullName}
                strong
              />
              <Row
                label={t("customers.documentNumber")}
                value={receipt.customer.document}
              />
              <Row
                label={t("customers.address")}
                value={receipt.customer.address ?? "—"}
              />
              <Row label={t("loans.code")} value={receipt.loan.code} />
              <Row
                label={t("payments.paidAt")}
                value={formatLongDate(receipt.paidAt, context.locale)}
              />
              <Row
                label={t("payments.method")}
                value={t(`payments.methodLabel.${receipt.method}`)}
              />
              <Row
                label={t("payments.receiptInstallments")}
                value={`${receipt.loan.covered} de ${receipt.loan.termCount}`}
              />
              <Row
                label={t("loans.outstanding")}
                value={money(receipt.loan.outstanding)}
                strong
                tone="text-danger"
              />
              {receipt.loan.nextDueDate ? (
                <Row
                  label={t("payments.receiptNextDue")}
                  value={formatLongDate(
                    receipt.loan.nextDueDate,
                    context.locale,
                  )}
                />
              ) : null}
              {receipt.collectedBy ? (
                <Row
                  label={t("payments.collectedByLabel")}
                  value={receipt.collectedBy}
                />
              ) : null}
            </dl>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title={t("payments.share")}
              description={t("payments.receiptKeep")}
            />
            <CardBody>
              <ShareDocument
                url={`/api/receipts/${receipt.paymentId}`}
                fileName={`${receipt.receiptNumber}.png`}
                mimeType="image/png"
                message={message}
                phone={phone}
                shareLabel={t("payments.share")}
                downloadLabel={t("payments.download")}
                busyLabel={t("payments.sharing")}
                fallbackLabel={t("payments.shareFallback")}
              />
            </CardBody>
          </Card>

          {canDelete ? (
            <Card>
              <CardHeader title={t("common.actions")} />
              <CardBody className="flex flex-wrap items-center gap-3">
                {voided ? null : (
                  <ReversePaymentButton paymentId={receipt.paymentId} />
                )}
                <DeleteReceipt paymentId={receipt.paymentId} />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={t("payments.history")} />
            <CardBody className="text-sm">
              <Link
                href={`/loans/${receipt.loan.id}`}
                className="text-brand-strong hover:underline"
              >
                {t("loans.singular")} {receipt.loan.code} →
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
