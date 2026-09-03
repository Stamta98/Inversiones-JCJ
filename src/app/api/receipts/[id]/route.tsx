/**
 * The receipt as an image.
 *
 * A collector sends this over WhatsApp the moment they take the money, so it
 * has to be a picture: a link would ask the customer to open a browser, and a
 * customer with no data plan would get nothing. Rendered server side, at a
 * size a phone screen shows without zooming.
 */

import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

import { isLate } from "@/core/loans/receipt";
import { formatCurrency, formatLongDate } from "@/lib/format";
import { t } from "@/i18n";
import { getAuthContext } from "@/server/auth/context";
import { hasPermission } from "@/core/permissions";
import { loadReceipt } from "@/server/services/receipts";

export const dynamic = "force-dynamic";

const INK = "#1d2126";
const MUTED = "#5b6b72";
const BRAND = "#0f766e";
const DANGER = "#b91c1c";
const LINE = "#e3e6e8";

function Row({
  label,
  value,
  strong = false,
  tone = INK,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 24,
        padding: "10px 0",
        borderBottom: `1px solid ${LINE}`,
      }}
    >
      <span style={{ color: MUTED, fontSize: 22 }}>{label}</span>
      <span
        style={{
          color: tone,
          fontSize: 22,
          fontWeight: strong ? 700 : 600,
          textAlign: "right",
          maxWidth: 420,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getAuthContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(context.permissions, "payments.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const receipt = await loadReceipt(context.companyId, id);
  if (!receipt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const money = (amount: number) =>
    formatCurrency(
      amount,
      receipt.company.currencyCode,
      receipt.company.locale,
      receipt.company.decimalPlaces,
    );
  const day = (value: Date | null) =>
    value ? formatLongDate(value, receipt.company.locale) : "—";

  const late = isLate({ daysLate: receipt.loan.daysLate });
  const voided = receipt.status === "REVERSED";

  return new ImageResponse(
    <div
      style={{
        width: 800,
        height: 1180,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        padding: "44px 48px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 84,
            height: 84,
            borderRadius: 22,
            backgroundColor: BRAND,
            color: "#ffffff",
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          {receipt.company.name.slice(0, 3).toUpperCase()}
        </div>
        <span
          style={{ marginTop: 12, fontSize: 26, fontWeight: 700, color: INK }}
        >
          {receipt.company.name}
        </span>
        <span style={{ fontSize: 20, color: MUTED }}>
          {[receipt.company.phone, receipt.company.city]
            .filter(Boolean)
            .join(" · ")}
        </span>

        <div
          style={{
            display: "flex",
            marginTop: 20,
            padding: "10px 26px",
            borderRadius: 999,
            border: `1px solid ${LINE}`,
            color: voided ? DANGER : MUTED,
            fontSize: 20,
            letterSpacing: 2,
            fontWeight: 700,
          }}
        >
          {voided
            ? t("payments.receiptVoided").toUpperCase()
            : t("payments.receiptTitle").toUpperCase()}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 28,
          padding: "26px 0",
          borderRadius: 20,
          backgroundColor: "#f5f7f7",
        }}
      >
        <span style={{ fontSize: 21, color: MUTED }}>
          {t("payments.receiptApplied")}
        </span>
        <span
          style={{
            fontSize: 62,
            fontWeight: 700,
            color: voided ? DANGER : BRAND,
            marginTop: 4,
          }}
        >
          {money(receipt.amount)}
        </span>
        {late ? (
          <div
            style={{
              display: "flex",
              marginTop: 12,
              padding: "6px 18px",
              borderRadius: 999,
              backgroundColor: "#fdf1dc",
              color: "#8a5a00",
              fontSize: 19,
              fontWeight: 700,
            }}
          >
            {t("payments.receiptLate").replace(
              "{days}",
              String(receipt.loan.daysLate),
            )}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
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
        <Row label={t("payments.receipt")} value={receipt.receiptNumber} />
        <Row label={t("payments.paidAt")} value={day(receipt.paidAt)} />
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
          tone={DANGER}
        />
        <Row
          label={t("payments.receiptNextDue")}
          value={day(receipt.loan.nextDueDate)}
        />
        <Row
          label={t("payments.receiptLastDue")}
          value={day(receipt.loan.lastDueDate)}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: "auto",
        }}
      >
        <span style={{ fontSize: 21, fontWeight: 700, color: INK }}>
          {t("payments.receiptFooter")}
        </span>
        <span
          style={{ marginTop: 6, fontSize: 18, color: MUTED, letterSpacing: 1 }}
        >
          {t("payments.receiptKeep")}
        </span>
      </div>
    </div>,
    { width: 800, height: 1180 },
  );
}
