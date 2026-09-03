"use client";

import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import type { Schedule } from "@/core/loans/schedule";
import { fromCents } from "@/core/money";
import { es } from "@/i18n/es";
import { formatDate } from "@/lib/format";

/**
 * La tabla de cuotas antes de guardar nada.
 *
 * La usan el préstamo nuevo y la refinanciación, y en las dos sale del mismo
 * motor puro que corre después en el servidor: lo que se ve aquí es lo que se
 * va a guardar.
 */
export function SchedulePreview({
  schedule,
  error,
  money,
  title = es.loans.schedulePreview,
}: {
  schedule: Schedule | null;
  error: string | null;
  money: (amount: number) => string;
  title?: string;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        description={
          schedule
            ? `${es.loans.totalToPay}: ${money(fromCents(schedule.totalToPayCents))} · ${es.loans.totalInterest}: ${money(fromCents(schedule.totalInterestCents))}`
            : undefined
        }
      />
      {error ? (
        <CardBody>
          <Alert tone="danger">{error}</Alert>
        </CardBody>
      ) : schedule ? (
        <>
          {schedule.isOpenEnded ? (
            <CardBody className="pb-0">
              <Alert tone="info" icon="clock">
                {es.loans.openEndedNotice}
              </Alert>
            </CardBody>
          ) : null}
          <div className="max-h-[28rem] overflow-y-auto">
            <TableWrap dense>
              <thead className="sticky top-0 bg-surface">
                <tr>
                  <Th>{es.loans.installment}</Th>
                  <Th>{es.loans.dueDate}</Th>
                  <Th align="right">{es.loans.principalPart}</Th>
                  <Th align="right">{es.loans.interestPart}</Th>
                  <Th align="right">{es.loans.installmentTotal}</Th>
                  <Th align="right">{es.loans.balanceAfter}</Th>
                </tr>
              </thead>
              <tbody>
                {schedule.installments.map((installment) => (
                  <tr key={installment.number}>
                    <Td numeric>{installment.number}</Td>
                    <Td numeric>{formatDate(installment.dueDate)}</Td>
                    <Td align="right" numeric>
                      {money(fromCents(installment.principalCents))}
                    </Td>
                    <Td align="right" numeric>
                      {money(fromCents(installment.interestCents))}
                    </Td>
                    <Td align="right" numeric className="font-medium">
                      {money(fromCents(installment.totalCents))}
                    </Td>
                    <Td align="right" numeric>
                      {money(fromCents(installment.balanceAfterCents))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        </>
      ) : null}
    </Card>
  );
}
