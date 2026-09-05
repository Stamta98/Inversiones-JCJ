import { notFound } from "next/navigation";

import {
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Las gestiones que se le han hecho a un cliente: llamadas, visitas, mensajes.
 *
 * En la ficha se veían las diez últimas y las de antes no se veían en ninguna
 * parte. Aquí caben todas.
 */
export default async function CustomerInteractionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("customers.read");
  const { id } = await params;
  const { t } = context;

  const customer = await db.customer.findFirst({
    where: { id, companyId: context.companyId },
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      interactions: {
        orderBy: { occurredAt: "desc" },
        include: { agent: { select: { fullName: true } } },
      },
    },
  });
  if (!customer) notFound();

  return (
    <>
      <PageHeader
        title={t("customers.interactionsTab")}
        description={`${customer.code} · ${customer.firstName} ${customer.lastName} · ${t("customers.interactionsHint")}`}
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

      <div className="mt-4">
        <Card>
          {customer.interactions.length === 0 ? (
            <EmptyState icon="headset" title={t("common.empty")} />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("callCenter.occurredAt")}</Th>
                  <Th>{t("callCenter.channel")}</Th>
                  <Th>{t("callCenter.outcome")}</Th>
                  <Th>{t("callCenter.agent")}</Th>
                </tr>
              </thead>
              <tbody>
                {customer.interactions.map((interaction) => (
                  <tr key={interaction.id}>
                    <Td numeric>{formatDate(interaction.occurredAt)}</Td>
                    <Td>
                      {t(`callCenter.channelLabel.${interaction.channel}`)}
                    </Td>
                    <Td>
                      {t(`callCenter.outcomeLabel.${interaction.outcome}`)}
                    </Td>
                    <Td>{interaction.agent?.fullName ?? "—"}</Td>
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
