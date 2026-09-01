import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  TableWrap,
  Td,
  Th,
  type Tone,
} from "@/components/ui";
import { es } from "@/i18n/es";
import { formatDateTime } from "@/lib/format";
import { can, requirePermission } from "@/server/auth/context";
import { db } from "@/server/db";

import {
  runMessagingNow,
  toggleAutomationRule,
} from "./actions";
import { AccountForm, RuleForm } from "./forms";

export const dynamic = "force-dynamic";

const MESSAGE_TONES: Record<string, Tone> = {
  QUEUED: "neutral",
  SENDING: "info",
  SENT: "positive",
  DELIVERED: "positive",
  READ: "brand",
  FAILED: "danger",
  CANCELLED: "neutral",
};

export default async function MessagingPage() {
  const context = await requirePermission("messaging.read");

  const [accounts, rules, messages, templates] = await Promise.all([
    db.messagingAccount.findMany({
      where: { companyId: context.companyId },
      orderBy: { createdAt: "asc" },
    }),
    db.automationRule.findMany({
      where: { companyId: context.companyId },
      include: { template: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.outboundMessage.findMany({
      where: { companyId: context.companyId },
      include: { customer: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.template.findMany({
      where: { companyId: context.companyId, kind: "WHATSAPP", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const { t } = context;
  const canEdit = can(context, "messaging.create");

  return (
    <>
      <PageHeader
        title={t("messaging.title")}
        description={t("modules.messaging.description")}
        action={
          canEdit ? (
            <form action={runMessagingNow}>
              <Button type="submit" icon="send" variant="secondary">
                {t("messaging.sendNow")}
              </Button>
            </form>
          ) : null
        }
      />

      {accounts.length === 0 ? (
        <div className="mb-4">
          <Alert tone="warning">{t("messaging.noAccount")}</Alert>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("messaging.accounts")} />
          {accounts.length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("messaging.displayName")}</Th>
                  <Th>{t("messaging.provider")}</Th>
                  <Th>{t("messaging.phoneNumber")}</Th>
                  <Th align="center">{t("common.status")}</Th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <Td>
                      {account.displayName}
                      {account.isDefault ? (
                        <Badge tone="brand" className="ml-2">
                          {t("messaging.isDefault")}
                        </Badge>
                      ) : null}
                    </Td>
                    <Td>
                      {es.messaging.providerLabel[
                        account.provider as keyof typeof es.messaging.providerLabel
                      ] ?? account.provider}
                    </Td>
                    <Td numeric>{account.phoneNumber ?? "—"}</Td>
                    <Td align="center">
                      <Badge tone={account.isActive ? "positive" : "neutral"}>
                        {account.isActive
                          ? t("common.enabled")
                          : t("common.disabled")}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : null}
          {canEdit ? <AccountForm /> : null}
        </Card>

        <Card>
          <CardHeader title={t("messaging.automation")} />
          {rules.length === 0 ? (
            <EmptyState
              icon="message-circle"
              title={t("messaging.emptyTitle")}
              hint={t("messaging.emptyHint")}
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{t("messaging.ruleName")}</Th>
                  <Th>{t("messaging.trigger")}</Th>
                  <Th>{t("messaging.template")}</Th>
                  <Th align="center">{t("common.status")}</Th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <Td>
                      {rule.name}
                      <span className="block text-xs text-ink-subtle">
                        {rule.sendAtTime}
                      </span>
                    </Td>
                    <Td>
                      {t(`messaging.triggerLabel.${rule.trigger}`)}
                      {rule.offsetDays > 0 ? (
                        <span className="block text-xs text-ink-subtle">
                          {rule.offsetDays} {t("messaging.offsetDays").toLowerCase()}
                        </span>
                      ) : null}
                    </Td>
                    <Td>{rule.template.name}</Td>
                    <Td align="center">
                      {can(context, "messaging.update") ? (
                        <form action={toggleAutomationRule}>
                          <input type="hidden" name="id" value={rule.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant={rule.isActive ? "secondary" : "primary"}
                          >
                            {rule.isActive
                              ? t("common.disable")
                              : t("common.enable")}
                          </Button>
                        </form>
                      ) : (
                        <Badge tone={rule.isActive ? "positive" : "neutral"}>
                          {rule.isActive
                            ? t("common.enabled")
                            : t("common.disabled")}
                        </Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
          {canEdit && templates.length > 0 ? (
            <RuleForm templates={templates} />
          ) : canEdit ? (
            <CardBody>
              <Alert tone="info">{t("templates.emptyHint")}</Alert>
            </CardBody>
          ) : null}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title={t("messaging.outbox")} />
        {messages.length === 0 ? (
          <EmptyState
            icon="send"
            title={t("messaging.emptyTitle")}
            hint={t("messaging.emptyHint")}
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>{t("loans.customer")}</Th>
                <Th>{t("messaging.phoneNumber")}</Th>
                <Th>{t("templates.body")}</Th>
                <Th>{t("common.date")}</Th>
                <Th align="center">{t("common.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id}>
                  <Td>
                    {message.customer
                      ? `${message.customer.firstName} ${message.customer.lastName}`
                      : "—"}
                  </Td>
                  <Td numeric>{message.toAddress}</Td>
                  <Td className="max-w-md">
                    <span className="line-clamp-2 text-ink-muted">
                      {message.body}
                    </span>
                  </Td>
                  <Td numeric>{formatDateTime(message.createdAt)}</Td>
                  <Td align="center">
                    <Badge tone={MESSAGE_TONES[message.status] ?? "neutral"}>
                      {t(`messaging.statusLabel.${message.status}`)}
                    </Badge>
                    {message.failureReason ? (
                      <span className="block text-xs text-danger">
                        {message.failureReason}
                      </span>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
