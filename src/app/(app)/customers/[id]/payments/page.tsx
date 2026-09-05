import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  LinkButton,
  PageHeader,
  StatCard,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Cuántos caben antes de que la página pese más de lo que sirve.
 *
 * Un préstamo diario de seis meses son ciento ochenta recibos, y un cliente
 * viejo puede llevar varios: traerlos todos sería una tabla que nadie baja.
 * Se traen los últimos y se dice cuántos quedaron fuera, para que nadie crea
 * que eso es todo lo que ha pagado.
 */
const PAGE_SIZE = 100;

/**
 * Los abonos de un cliente, de todos sus préstamos juntos.
 *
 * Antes era un cuadro dentro de la ficha, con los últimos treinta y sin
 * decir que había más.
 */
export default async function CustomerPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("customers.read");
  const { id } = await params;
  const { t, money } = context;

  const customer = await db.customer.findFirst({
    where: { id, companyId: context.companyId },
    select: { id: true, code: true, firstName: true, lastName: true },
  });
  if (!customer) notFound();

  const where = {
    companyId: context.companyId,
    loan: { customerId: customer.id },
  };

  const [payments, total, posted] = await Promise.all([
    db.payment.findMany({
      where,
      include: { loan: { select: { id: true, code: true } } },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: PAGE_SIZE,
    }),
    db.payment.count({ where }),
    // Lo abonado de verdad: un recibo anulado no entró a la caja.
    db.payment.aggregate({
      where: { ...where, status: "POSTED" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return (
    <>
      <PageHeader
        title={t("payments.history")}
        description={`${customer.code} · ${customer.firstName} ${customer.lastName} · ${t("payments.historyHint")}`}
        action={
          <LinkButton
            href={`/customers/${customer.id}`}
            variant="secondary"
            icon="arrow-left"
          >
            {t("common.back")}
          </LinkButton>
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard
          compact
          label={t("customers.paymentsCount")}
          value={String(posted._count)}
          icon="receipt"
        />
        <StatCard
          compact
          label={t("customers.paidTotal")}
          value={money(Number(posted._sum.amount ?? 0))}
          icon="wallet"
          tone="positive"
        />
      </div>

      <div className="mt-4">
        <Card>
          {payments.length === 0 ? (
            <EmptyState icon="receipt" title={t("payments.emptyTitle")} />
          ) : (
            <>
              <TableWrap>
                <thead>
                  <tr>
                    <Th>{t("payments.receipt")}</Th>
                    <Th>{t("payments.paidAt")}</Th>
                    <Th>{t("loans.code")}</Th>
                    <Th align="right">{t("common.amount")}</Th>
                    <Th align="center">{t("common.status")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <Td numeric>
                        <Link
                          href={`/payments/${payment.id}`}
                          className="text-brand-strong hover:underline"
                        >
                          {payment.receiptNumber}
                        </Link>
                      </Td>
                      <Td numeric>
                        {formatDate(payment.paidAt, context.locale)}
                      </Td>
                      <Td>
                        <Link
                          href={`/loans/${payment.loan.id}`}
                          className="text-ink-muted hover:underline"
                        >
                          {payment.loan.code}
                        </Link>
                      </Td>
                      <Td align="right" numeric>
                        {money(Number(payment.amount))}
                      </Td>
                      <Td align="center">
                        <Badge
                          tone={
                            payment.status === "REVERSED"
                              ? "danger"
                              : "positive"
                          }
                        >
                          {t(`payments.statusLabel.${payment.status}`)}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              {/* Se dice cuántos no caben: una lista cortada en silencio hace
                  creer que el cliente abonó menos de lo que abonó. */}
              {total > payments.length ? (
                <CardBody className="border-t border-border">
                  <p className="numeric text-xs text-ink-muted">
                    {t("customers.paymentsTruncated")
                      .replace("{shown}", String(payments.length))
                      .replace("{total}", String(total))}
                  </p>
                </CardBody>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
