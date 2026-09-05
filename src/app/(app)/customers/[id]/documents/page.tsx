import { notFound } from "next/navigation";

import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { PhotoZoom } from "@/components/ui/photo-zoom";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Las dos caras de la cédula, que van juntas y primero. */
const ID_KINDS = ["ID_FRONT", "ID_BACK"];

/**
 * Los documentos de un cliente.
 *
 * La cédula arriba —es la que se mira— y debajo lo demás que se le haya
 * guardado: el recibo del servicio, la foto de la casa, un contrato. Antes
 * solo se veían las dos caras de la cédula, metidas en la ficha; lo demás
 * estaba guardado y no se veía en ninguna parte.
 */
export default async function CustomerDocumentsPage({
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
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!customer) notFound();

  const idDocuments = customer.attachments.filter((attachment) =>
    ID_KINDS.includes(attachment.kind),
  );
  const others = customer.attachments.filter(
    (attachment) => !ID_KINDS.includes(attachment.kind),
  );

  return (
    <>
      <PageHeader
        title={t("customers.jumpDocuments")}
        description={`${customer.code} · ${customer.firstName} ${customer.lastName}`}
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

      <div className="mt-4 space-y-4">
        <Card>
          <CardHeader
            title={t("customers.idDocuments")}
            description={t("customers.documentsHint")}
          />
          {idDocuments.length === 0 ? (
            <EmptyState icon="image" title={t("common.empty")} />
          ) : (
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {idDocuments.map((document) => (
                <figure key={document.id}>
                  {/* Recortada no se le lee el número al documento, que es
                      para lo que se le tomó la foto. Se abre encima, sin
                      sacar a nadie de la aplicación a otra pestaña. */}
                  <PhotoZoom
                    src={document.url}
                    alt={document.name}
                    caption={
                      document.kind === "ID_FRONT"
                        ? t("customers.idFront")
                        : t("customers.idBack")
                    }
                    className="aspect-[16/10] w-full rounded-xl border border-border object-cover"
                  />
                  <figcaption className="mt-1.5 text-xs text-ink-muted">
                    {document.kind === "ID_FRONT"
                      ? t("customers.idFront")
                      : t("customers.idBack")}
                  </figcaption>
                </figure>
              ))}
            </CardBody>
          )}
        </Card>

        {others.length > 0 ? (
          <Card>
            <CardHeader title={t("customers.otherDocuments")} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {others.map((document) => (
                <figure key={document.id}>
                  <PhotoZoom
                    src={document.url}
                    alt={document.name}
                    caption={document.name}
                    className="aspect-[16/10] w-full rounded-xl border border-border object-cover"
                  />
                  <figcaption className="mt-1.5 text-xs text-ink-muted">
                    <span className="block truncate">{document.name}</span>
                    <span className="numeric text-ink-subtle">
                      {formatDate(document.createdAt, context.locale)}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
