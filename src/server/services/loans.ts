/**
 * Loan service.
 *
 * Owns everything that writes to a loan: creating it with its schedule,
 * disbursing it, and recomputing its totals and arrears after any change.
 */

import type { Prisma } from "@prisma/client";

import { summarizeArrears, type LateFeePolicy } from "@/core/loans/arrears";
import {
  cashHandedOver,
  normalizeCharge,
  summarizeCharges,
  type Charge,
} from "@/core/loans/charges";
import { allocatePayment } from "@/core/loans/allocation";
import { canCancel, canEditAtAll } from "@/core/loans/editable";
import { buildSchedule, type Schedule } from "@/core/loans/schedule";
import { fromCents, stepForDecimals, toCents } from "@/core/money";
import type {
  InstallmentStatus,
  InterestMethod,
  LateFeeMode,
  PaymentFrequency,
  RateBasis,
} from "@/core/types";

import { db } from "../db";
import { reversePayment } from "./payments";
import { nextLoanCode, withCodeRetry } from "./sequences";

export interface CreateLoanInput {
  companyId: string;
  branchId?: string | null;
  customerId: string;
  loanProductId?: string | null;
  principal: number;
  interestRate: number;
  /** What the rate is a percentage of. Defaults to the whole loan. */
  rateBasis?: RateBasis;
  interestMethod: InterestMethod;
  frequency: PaymentFrequency;
  /** Days between installments when the frequency is CUSTOM. */
  customIntervalDays?: number | null;
  /** Weekdays with no collection, 0 = Sunday through 6 = Saturday. */
  nonCollectionDays?: number[];
  termCount: number;
  firstDueDate: Date;
  lateFeeMode?: LateFeeMode;
  lateFeeValue?: number;
  gracePeriodDays?: number;
  notes?: string | null;
  /**
   * Lo que se cobra aparte del interés. Un cargo descontado sale de lo que se
   * entrega; uno financiado se suma a lo que el cliente debe.
   */
  charges?: Array<{ name: string; amount: number; mode: Charge["mode"] }>;
  /**
   * Decimals the company writes amounts with. Zero makes every installment
   * land on a whole unit, so a plan in Colombian pesos adds up to the
   * principal instead of drifting by a few pesos.
   */
  decimalPlaces?: number;
  /** Disburse straight away instead of leaving the loan as a draft. */
  disburseNow?: boolean;
  cashBoxId?: string | null;
  createdById?: string | null;
}

/** Builds the schedule without writing anything, for the preview screen. */
export function previewSchedule(
  input: Pick<
    CreateLoanInput,
    | "principal"
    | "interestRate"
    | "rateBasis"
    | "interestMethod"
    | "frequency"
    | "termCount"
    | "firstDueDate"
    | "customIntervalDays"
    | "nonCollectionDays"
    | "decimalPlaces"
    | "charges"
  >,
): Schedule {
  const step = stepForDecimals(input.decimalPlaces ?? 2);

  return buildSchedule({
    principalCents: toCents(input.principal),
    interestRate: input.interestRate,
    // Explicit: the engine still defaults to a rate per installment, which for
    // a daily loan would multiply the quoted rate by the term.
    rateBasis: input.rateBasis ?? "TOTAL",
    interestMethod: input.interestMethod,
    frequency: input.frequency,
    termCount: input.termCount,
    firstDueDate: input.firstDueDate,
    customIntervalDays: input.customIntervalDays ?? undefined,
    nonCollectionDays: input.nonCollectionDays,
    minorUnitStep: step,
    financedChargeCents: summarizeCharges(normalizedCharges(input.charges, step), step)
      .financedCents,
  });
}

/** Los cargos ya listos para guardar, o un error diciendo cuál no sirve. */
export function normalizedCharges(
  charges: CreateLoanInput["charges"],
  step: ReturnType<typeof stepForDecimals>,
): Charge[] {
  return (charges ?? []).map((charge) =>
    normalizeCharge(
      { name: charge.name, amountCents: toCents(charge.amount), mode: charge.mode },
      step,
    ),
  );
}

export async function createLoan(input: CreateLoanInput): Promise<string> {
  const step = stepForDecimals(input.decimalPlaces ?? 2);
  const charges = normalizedCharges(input.charges, step);
  const chargeSummary = summarizeCharges(charges, step);
  // Se comprueba antes de escribir nada: un cargo que se come el préstamo
  // entero dejaría al cliente sin plata y debiendo.
  const handedOver = fromCents(
    cashHandedOver(toCents(input.principal), chargeSummary.deductedCents),
  );

  const schedule = previewSchedule(input);
  const lateFeeMode = input.lateFeeMode ?? "NONE";
  const lateFeeValue = input.lateFeeValue ?? 0;
  const gracePeriodDays = input.gracePeriodDays ?? 0;

  return withCodeRetry(() =>
    db.$transaction(async (tx) => {
      const code = await nextLoanCode(tx, input.companyId);
      const now = new Date();

      const loan = await tx.loan.create({
        data: {
          companyId: input.companyId,
          branchId: input.branchId ?? null,
          customerId: input.customerId,
          loanProductId: input.loanProductId ?? null,
          code,
          principal: input.principal,
          interestMethod: input.interestMethod,
          interestRate: input.interestRate,
          rateBasis: input.rateBasis ?? "TOTAL",
          frequency: input.frequency,
          customIntervalDays: input.customIntervalDays ?? null,
          nonCollectionDays: input.nonCollectionDays ?? [],
          termCount: schedule.installments.length,
          firstDueDate: input.firstDueDate,
          disbursedAt: input.disburseNow ? now : null,
          status: input.disburseNow ? "ACTIVE" : "DRAFT",
          lateFeeMode,
          lateFeeValue,
          gracePeriodDays,
          notes: input.notes ?? null,
          totalPrincipal: fromCents(schedule.totalPrincipalCents),
          totalInterest: fromCents(schedule.totalInterestCents),
          outstanding: fromCents(schedule.totalToPayCents),
          charges: {
            create: charges.map((charge) => ({
              name: charge.name,
              amount: fromCents(charge.amountCents),
              mode: charge.mode,
            })),
          },
          installments: {
            create: schedule.installments.map((installment) => ({
              number: installment.number,
              dueDate: installment.dueDate,
              principalAmount: fromCents(installment.principalCents),
              interestAmount: fromCents(installment.interestCents),
              chargeAmount: fromCents(installment.chargeCents),
              totalAmount: fromCents(installment.totalCents),
              balanceAfter: fromCents(installment.balanceAfterCents),
            })),
          },
        },
      });

      if (input.disburseNow && input.cashBoxId) {
        // Sale el préstamo completo y vuelve a entrar el cargo. El neto es
        // exactamente lo que salió del cajón — 100.000 menos 5.000 son los
        // 95.000 que se entregaron — y el cargo queda a la vista como ingreso
        // en vez de desaparecer dentro de un desembolso más pequeño.
        await recordDisbursement(tx, {
          cashBoxId: input.cashBoxId,
          amount: input.principal,
          loanCode: code,
          loanId: loan.id,
          createdById: input.createdById ?? null,
        });
        await recordDeductedCharges(tx, {
          cashBoxId: input.cashBoxId,
          amount: fromCents(chargeSummary.deductedCents),
          loanCode: code,
          loanId: loan.id,
          createdById: input.createdById ?? null,
        });
      }

      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          userId: input.createdById ?? null,
          action: "loan.created",
          entityType: "Loan",
          entityId: loan.id,
          metadata: {
            code,
            principal: input.principal,
            interestMethod: input.interestMethod,
            termCount: schedule.installments.length,
            handedOver,
            deductedCharges: fromCents(chargeSummary.deductedCents),
            financedCharges: fromCents(chargeSummary.financedCents),
          },
        },
      });

      return loan.id;
    }),
  );
}

export class LoanServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "notFound"
      | "termsLocked"
      | "closed"
      | "cannotCancel"
      | "alreadyRenewed",
  ) {
    super(message);
    this.name = "LoanServiceError";
  }
}

export interface UpdateLoanInput {
  companyId: string;
  loanId: string;
  notes?: string | null;
  branchId?: string | null;
  /** Only accepted while the loan is still a draft; see `core/loans/editable`. */
  terms?: Pick<
    CreateLoanInput,
    | "principal"
    | "interestRate"
    | "rateBasis"
    | "interestMethod"
    | "frequency"
    | "customIntervalDays"
    | "nonCollectionDays"
    | "termCount"
    | "firstDueDate"
    | "lateFeeMode"
    | "lateFeeValue"
    | "gracePeriodDays"
    | "decimalPlaces"
  >;
  /**
   * Los cargos que quedan. Sin pasarlos no se tocan; una lista vacía los
   * quita todos, que es lo que significa borrarlos en la pantalla.
   */
  charges?: CreateLoanInput["charges"];
  /** Decimales de la moneda, para redondear los cargos como se cobran. */
  decimalPlaces?: number;
  updatedById?: string | null;
}

/**
 * Edits a loan.
 *
 * The notes travel freely, but the terms only while the loan is a draft: past
 * that point the installments carry payments, and rewriting them would change
 * what the customer already owed. `core/loans/editable` holds that rule and
 * this function enforces it again server-side, since the UI can be bypassed.
 */
export async function updateLoan(input: UpdateLoanInput): Promise<void> {
  await db.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({
      where: { id: input.loanId, companyId: input.companyId },
      include: { charges: true },
    });
    if (!loan) throw new LoanServiceError("Loan not found", "notFound");
    if (!canEditAtAll(loan.status)) {
      throw new LoanServiceError("Loan is closed", "closed");
    }

    // Las condiciones se pueden corregir después de creado el préstamo: quien
    // presta se equivoca tecleando y lo que hace falta es arreglarlo, no
    // anularlo y volver a empezar. Lo que ya se cobró no se pierde — se vuelve
    // a aplicar contra el plan nuevo más abajo.
    const step = stepForDecimals(
      input.terms?.decimalPlaces ?? input.decimalPlaces ?? 2,
    );
    const charges = normalizedCharges(
      input.charges ?? chargesOf(loan),
      step,
    );
    const chargeSummary = summarizeCharges(charges, step);
    const previousDeducted = summarizeCharges(
      normalizedCharges(chargesOf(loan), step),
      step,
    ).deductedCents;

    // Se comprueba antes de escribir: un cargo descontado no puede llevarse
    // todo lo que se le entregó al cliente.
    cashHandedOver(
      toCents(input.terms?.principal ?? Number(loan.principal)),
      chargeSummary.deductedCents,
    );

    const schedule = input.terms
      ? previewSchedule({ ...input.terms, charges: input.charges ?? chargesOf(loan) })
      : null;

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.terms && schedule
          ? {
              principal: input.terms.principal,
              interestRate: input.terms.interestRate,
              rateBasis: input.terms.rateBasis ?? "TOTAL",
              interestMethod: input.terms.interestMethod,
              frequency: input.terms.frequency,
              customIntervalDays: input.terms.customIntervalDays ?? null,
              nonCollectionDays: input.terms.nonCollectionDays ?? [],
              termCount: schedule.installments.length,
              firstDueDate: input.terms.firstDueDate,
              lateFeeMode: input.terms.lateFeeMode ?? "NONE",
              lateFeeValue: input.terms.lateFeeValue ?? 0,
              gracePeriodDays: input.terms.gracePeriodDays ?? 0,
              totalPrincipal: fromCents(schedule.totalPrincipalCents),
              totalInterest: fromCents(schedule.totalInterestCents),
              outstanding: fromCents(schedule.totalToPayCents),
            }
          : {}),
      },
    });

    if (input.charges !== undefined) {
      await tx.loanCharge.deleteMany({ where: { loanId: loan.id } });
      await tx.loanCharge.createMany({
        data: charges.map((charge) => ({
          loanId: loan.id,
          name: charge.name,
          amount: fromCents(charge.amountCents),
          mode: charge.mode,
        })),
      });
    }

    if (schedule) {
      // Las aplicaciones viejas apuntan a cuotas que dejan de existir, así que
      // se van primero y los cobros se vuelven a repartir sobre el plan nuevo.
      const payments = await tx.payment.findMany({
        where: { loanId: loan.id },
        select: { id: true },
      });
      await tx.paymentAllocation.deleteMany({
        where: { paymentId: { in: payments.map((payment) => payment.id) } },
      });
      await tx.loanInstallment.deleteMany({ where: { loanId: loan.id } });
      await tx.loanInstallment.createMany({
        data: schedule.installments.map((installment) => ({
          loanId: loan.id,
          number: installment.number,
          dueDate: installment.dueDate,
          principalAmount: fromCents(installment.principalCents),
          interestAmount: fromCents(installment.interestCents),
          chargeAmount: fromCents(installment.chargeCents),
          totalAmount: fromCents(installment.totalCents),
          balanceAfter: fromCents(installment.balanceAfterCents),
        })),
      });

      await reapplyPayments(tx, loan.id);
      await refreshLoan(tx, loan.id);
    }

    // La plata ya había salido: si cambió el monto o lo que se le descontó, la
    // caja tiene que moverse por la diferencia o diría que se entregó lo que
    // no se entregó. Un préstamo más grande saca más; un cargo más alto deja
    // más adentro.
    const principalDelta = input.terms
      ? input.terms.principal - Number(loan.principal)
      : 0;
    const chargeDelta = fromCents(chargeSummary.deductedCents - previousDeducted);
    if (principalDelta !== 0 || chargeDelta !== 0) {
      await adjustLoanCash(tx, {
        loanId: loan.id,
        loanCode: loan.code,
        cashDelta: chargeDelta - principalDelta,
        createdById: input.updatedById ?? null,
      });
    }

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.updatedById ?? null,
        action: "loan.updated",
        entityType: "Loan",
        entityId: loan.id,
        metadata: {
          code: loan.code,
          termsChanged: schedule !== null,
          chargesChanged: input.charges !== undefined,
        },
      },
    });
  });
}

/** Los cargos guardados del préstamo, en la forma que espera el motor. */
function chargesOf(loan: {
  charges?: Array<{ name: string; amount: Prisma.Decimal | number; mode: string }>;
}): CreateLoanInput["charges"] {
  return (loan.charges ?? []).map((charge) => ({
    name: charge.name,
    amount: Number(charge.amount),
    mode: charge.mode as "DEDUCTED" | "FINANCED",
  }));
}

/**
 * Vuelve a repartir lo ya cobrado sobre el plan nuevo.
 *
 * Se aplican en el orden en que se cobraron, que es el único orden que da el
 * mismo resultado que si el plan hubiera sido este desde el principio.
 */
async function reapplyPayments(
  tx: Prisma.TransactionClient,
  loanId: string,
): Promise<void> {
  const payments = await tx.payment.findMany({
    where: { loanId, status: "POSTED" },
    orderBy: [{ paidAt: "asc" }, { receiptNumber: "asc" }],
    select: { id: true, amount: true, paidAt: true },
  });
  if (payments.length === 0) return;

  const installments = await tx.loanInstallment.findMany({
    where: { loanId },
    orderBy: { number: "asc" },
  });

  // El estado de las cuotas se lleva en memoria mientras se reparte cobro a
  // cobro; se escribe una sola vez al final.
  const state = installments.map((installment) => ({
    id: installment.id,
    number: installment.number,
    dueDate: installment.dueDate,
    principalCents: toCents(Number(installment.principalAmount)),
    interestCents: toCents(Number(installment.interestAmount)),
    chargeCents: toCents(Number(installment.chargeAmount)),
    lateFeeCents: 0,
    paidCents: 0,
    status: "PENDING" as InstallmentStatus,
  }));

  for (const payment of payments) {
    const result = allocatePayment(toCents(Number(payment.amount)), state);

    for (const allocation of result.allocations) {
      const target = state.find((item) => item.id === allocation.installmentId);
      if (!target) continue;
      target.paidCents = allocation.resultingPaidCents;
      target.status = allocation.resultingStatus;
    }

    await tx.paymentAllocation.createMany({
      data: result.allocations.map((allocation) => ({
        paymentId: payment.id,
        installmentId: allocation.installmentId,
        principalAmount: fromCents(allocation.principalCents),
        interestAmount: fromCents(allocation.interestCents),
        chargeAmount: fromCents(allocation.chargeCents),
        lateFeeAmount: fromCents(allocation.lateFeeCents),
      })),
    });
  }

  for (const item of state) {
    await tx.loanInstallment.update({
      where: { id: item.id },
      data: {
        paidAmount: fromCents(item.paidCents),
        status: item.status,
        paidAt: null,
      },
    });
  }
}

/**
 * Corrige la caja cuando cambia lo que un préstamo ya desembolsado movió.
 *
 * Se busca de qué caja salió por sus propios movimientos, así que un préstamo
 * que nunca se desembolsó no toca nada. `cashDelta` es lo que le sobra o le
 * falta al saldo: positivo entra, negativo sale.
 */
async function adjustLoanCash(
  tx: Prisma.TransactionClient,
  input: {
    loanId: string;
    loanCode: string;
    cashDelta: number;
    createdById: string | null;
  },
): Promise<void> {
  if (input.cashDelta === 0) return;

  const disbursement = await tx.cashMovement.findFirst({
    where: { loanId: input.loanId, kind: "LOAN_DISBURSEMENT" },
    orderBy: { createdAt: "asc" },
    select: { cashBoxId: true },
  });
  if (!disbursement) return;

  const cashBox = await tx.cashBox.findUniqueOrThrow({
    where: { id: disbursement.cashBoxId },
    select: { balance: true },
  });
  const balanceAfter = Number(cashBox.balance) + input.cashDelta;

  await tx.cashBox.update({
    where: { id: disbursement.cashBoxId },
    data: { balance: balanceAfter },
  });
  await tx.cashMovement.create({
    data: {
      cashBoxId: disbursement.cashBoxId,
      kind: "ADJUSTMENT",
      amount: input.cashDelta,
      balanceAfter,
      description: `Corrección ${input.loanCode}`,
      loanId: input.loanId,
      createdById: input.createdById,
    },
  });
}

/**
 * Cancels a loan. Nothing is deleted: the record and its schedule stay, so the
 * history of what was agreed and what was collected remains readable.
 */
export async function cancelLoan(input: {
  companyId: string;
  loanId: string;
  reason?: string | null;
  cancelledById?: string | null;
}): Promise<void> {
  await db.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({
      where: { id: input.loanId, companyId: input.companyId },
    });
    if (!loan) throw new LoanServiceError("Loan not found", "notFound");
    if (!canCancel(loan.status)) {
      throw new LoanServiceError("Loan cannot be cancelled", "cannotCancel");
    }

    await tx.loan.update({
      where: { id: loan.id },
      data: { status: "CANCELLED", closingDate: new Date() },
    });

    // Cancelling a refinance or a renewal is how one gets undone: the balance
    // this loan absorbed goes back onto the loan it came from. Only the
    // bookkeeping is reversed — cash already handed over is not clawed back
    // here, exactly as it is not for an ordinary cancelled loan.
    if (loan.parentLoanId) {
      const settlement = await tx.payment.findFirst({
        where: {
          loanId: loan.parentLoanId,
          method: "REFINANCE",
          status: "POSTED",
        },
        select: { id: true },
      });

      if (settlement) {
        await reversePayment(settlement.id, {
          reason: `${loan.code}`,
          userId: input.cancelledById ?? null,
          allowRefinanceSettlement: true,
        });
      }
    }

    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.cancelledById ?? null,
        action: "loan.cancelled",
        entityType: "Loan",
        entityId: loan.id,
        metadata: {
          code: loan.code,
          reason: input.reason ?? null,
          releasedLoanId: loan.parentLoanId,
        },
      },
    });
  });
}

/**
 * Takes money out of a cash box for a loan.
 *
 * Shared with the refinance service, where the amount handed over is the net
 * of a renewal rather than the loan's principal.
 */
/**
 * Borra un préstamo para siempre.
 *
 * Anular deja el préstamo cerrado y a la vista, que es lo correcto casi
 * siempre. Esto es para el préstamo que nunca debió existir — el monto mal
 * tecleado, el cliente equivocado — y por eso lo deja como si nunca hubiera
 * pasado, empezando por la caja: vuelve el desembolso, se van los cobros y el
 * saldo queda exactamente donde estaba antes de crearlo.
 *
 * Lo único que sobrevive es la auditoría, que es la razón por la que se puede
 * borrar del todo sin perder el rastro de que se borró.
 */
export async function deleteLoan(
  companyId: string,
  loanId: string,
  options: { userId?: string | null } = {},
): Promise<void> {
  await db.$transaction((tx) =>
    deleteLoanWithin(tx, companyId, loanId, options),
  );
}

/**
 * El borrado en sí, dentro de una transacción que ya existe.
 *
 * Aparte para que borrar un cliente pueda llevarse sus préstamos en la misma
 * transacción: o se va todo o no se va nada.
 */
export async function deleteLoanWithin(
  tx: Prisma.TransactionClient,
  companyId: string,
  loanId: string,
  options: { userId?: string | null; skipRenewalCheck?: boolean } = {},
): Promise<void> {
  {
    const loan = await tx.loan.findFirst({
      where: { id: loanId, companyId },
      select: {
        id: true,
        code: true,
        principal: true,
        totalPaid: true,
        customerId: true,
        payments: { select: { id: true } },
      },
    });
    if (!loan) return;

    // Un préstamo que ya fue refinanciado o renovado no se puede borrar sin
    // dejar al otro préstamo cobrando un saldo que salió de este. Borrando al
    // cliente entero se van los dos, así que ahí no aplica.
    if (!options.skipRenewalCheck) {
      const replacement = await tx.loan.findFirst({
        where: { parentLoanId: loan.id, status: { not: "CANCELLED" } },
        select: { code: true },
      });
      if (replacement) {
        throw new LoanServiceError(
          `Replaced by ${replacement.code}`,
          "alreadyRenewed",
        );
      }
    }

    // Todo lo que este préstamo movió en caja: su desembolso, sus cargos y
    // cada cobro que se le hizo.
    const paymentIds = loan.payments.map((payment) => payment.id);
    const movements = await tx.cashMovement.findMany({
      where: {
        OR: [
          { loanId: loan.id },
          ...(paymentIds.length > 0 ? [{ paymentId: { in: paymentIds } }] : []),
        ],
      },
      select: { id: true, cashBoxId: true, amount: true },
    });

    // Se deshace por caja, porque un préstamo pudo desembolsarse de una y
    // cobrarse en otra.
    const perBox = new Map<string, number>();
    for (const movement of movements) {
      perBox.set(
        movement.cashBoxId,
        (perBox.get(movement.cashBoxId) ?? 0) + Number(movement.amount),
      );
    }

    for (const [cashBoxId, net] of perBox) {
      if (net === 0) continue;
      const cashBox = await tx.cashBox.findUnique({
        where: { id: cashBoxId },
        select: { balance: true },
      });
      if (!cashBox) continue;
      await tx.cashBox.update({
        where: { id: cashBoxId },
        data: { balance: Number(cashBox.balance) - net },
      });
    }

    await tx.cashMovement.deleteMany({
      where: { id: { in: movements.map((movement) => movement.id) } },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        userId: options.userId ?? null,
        action: "loan.deleted",
        entityType: "Loan",
        entityId: loan.id,
        metadata: {
          code: loan.code,
          principal: Number(loan.principal),
          totalPaid: Number(loan.totalPaid),
          customerId: loan.customerId,
          payments: paymentIds.length,
          cashMovements: movements.length,
        },
      },
    });

    // Las cuotas, los cobros, sus aplicaciones y los cargos se van con él.
    await tx.loan.delete({ where: { id: loan.id } });
  }
}

export async function recordDisbursement(
  tx: Prisma.TransactionClient,
  input: {
    cashBoxId: string;
    amount: number;
    loanCode: string;
    /** Para poder deshacerlo si el préstamo se borra. */
    loanId: string;
    createdById: string | null;
  },
): Promise<void> {
  const cashBox = await tx.cashBox.findUniqueOrThrow({
    where: { id: input.cashBoxId },
    select: { balance: true },
  });

  const balanceAfter = Number(cashBox.balance) - input.amount;

  await tx.cashBox.update({
    where: { id: input.cashBoxId },
    data: { balance: balanceAfter },
  });

  await tx.cashMovement.create({
    data: {
      cashBoxId: input.cashBoxId,
      kind: "LOAN_DISBURSEMENT",
      amount: -input.amount,
      balanceAfter,
      description: `Desembolso ${input.loanCode}`,
      loanId: input.loanId,
      createdById: input.createdById,
    },
  });
}

/**
 * Anota el cargo descontado como ingreso.
 *
 * Esa plata nunca salió de la caja — sencillamente no se entregó — así que el
 * saldo sube, y queda escrita como movimiento propio para que los reportes la
 * cuenten sin confundirla con un cobro.
 */
export async function recordDeductedCharges(
  tx: Prisma.TransactionClient,
  input: {
    cashBoxId: string;
    amount: number;
    loanCode: string;
    /** Para poder deshacerlo si el préstamo se borra. */
    loanId: string;
    createdById: string | null;
  },
): Promise<void> {
  if (input.amount <= 0) return;

  const cashBox = await tx.cashBox.findUniqueOrThrow({
    where: { id: input.cashBoxId },
    select: { balance: true },
  });
  const balanceAfter = Number(cashBox.balance) + input.amount;

  await tx.cashBox.update({
    where: { id: input.cashBoxId },
    data: { balance: balanceAfter },
  });

  await tx.cashMovement.create({
    data: {
      cashBoxId: input.cashBoxId,
      kind: "CHARGE_COLLECTED",
      amount: input.amount,
      balanceAfter,
      description: `Cargos ${input.loanCode}`,
      loanId: input.loanId,
      createdById: input.createdById,
    },
  });
}

export function lateFeePolicyOf(
  loan: {
    lateFeeMode: string;
    lateFeeValue: Prisma.Decimal | number;
    gracePeriodDays: number;
  },
  decimalPlaces = 2,
): LateFeePolicy {
  const rawValue = Number(loan.lateFeeValue);
  const mode = loan.lateFeeMode as LateFeeMode;

  return {
    mode,
    // The fixed modes store an amount of money; the percent modes store a rate.
    value:
      mode === "FIXED_PER_DAY" || mode === "FIXED_ONCE"
        ? toCents(rawValue)
        : rawValue,
    gracePeriodDays: loan.gracePeriodDays,
    minorUnitStep: stepForDecimals(decimalPlaces),
  };
}

/**
 * Recomputes late fees, installment statuses, denormalized totals and the loan
 * status. Called after every payment and by the nightly job.
 */
export async function refreshLoan(
  tx: Prisma.TransactionClient,
  loanId: string,
  asOf: Date = new Date(),
): Promise<void> {
  const loan = await tx.loan.findUniqueOrThrow({
    where: { id: loanId },
    include: {
      installments: { orderBy: { number: "asc" } },
      // The late fee has to be a chargeable amount too, and how small that is
      // depends on the company's currency.
      company: { select: { decimalPlaces: true } },
    },
  });

  if (loan.status === "CANCELLED" || loan.status === "WRITTEN_OFF") return;

  const policy = lateFeePolicyOf(loan, loan.company.decimalPlaces);
  const snapshots = loan.installments.map((installment) => ({
    id: installment.id,
    number: installment.number,
    dueDate: installment.dueDate,
    principalCents: toCents(Number(installment.principalAmount)),
    interestCents: toCents(Number(installment.interestAmount)),
    chargeCents: toCents(Number(installment.chargeAmount)),
    lateFeeCents: toCents(Number(installment.lateFeeAmount)),
    paidCents: toCents(Number(installment.paidAmount)),
    status: installment.status,
  }));

  const summary = summarizeArrears(snapshots, policy, asOf);

  // Refresh each installment's late fee and status.
  let totalPaidCents = 0;
  let totalLateFeeCents = 0;
  let outstandingCents = 0;

  for (const snapshot of snapshots) {
    const dueCents =
      snapshot.principalCents + snapshot.interestCents + snapshot.chargeCents;
    const isSettled =
      snapshot.status === "PAID" || snapshot.status === "WAIVED";

    const lateFeeCents = isSettled
      ? snapshot.lateFeeCents
      : Math.max(
          snapshot.lateFeeCents,
          // Recompute from scratch so a fee never shrinks below what was paid.
          summarizeArrears([snapshot], policy, asOf).lateFeeCents,
        );

    const owedCents = Math.max(0, dueCents + lateFeeCents - snapshot.paidCents);

    let status = snapshot.status;
    if (!isSettled) {
      if (snapshot.paidCents >= dueCents + lateFeeCents) {
        status = "PAID";
      } else if (snapshot.dueDate < asOf) {
        status = "OVERDUE";
      } else if (snapshot.paidCents > 0) {
        status = "PARTIALLY_PAID";
      } else {
        status = "PENDING";
      }
    }

    if (lateFeeCents !== snapshot.lateFeeCents || status !== snapshot.status) {
      await tx.loanInstallment.update({
        where: { id: snapshot.id },
        data: {
          lateFeeAmount: fromCents(lateFeeCents),
          totalAmount: fromCents(dueCents + lateFeeCents),
          status,
          paidAt: status === "PAID" ? (asOf ?? new Date()) : null,
        },
      });
    }

    totalPaidCents += snapshot.paidCents;
    totalLateFeeCents += lateFeeCents;
    outstandingCents += owedCents;
  }

  const isPaid = outstandingCents === 0;
  const nextStatus =
    loan.status === "DRAFT" || loan.status === "PENDING_APPROVAL"
      ? loan.status
      : isPaid
        ? "PAID"
        : summary.daysInArrears > 0
          ? "IN_ARREARS"
          : "ACTIVE";

  await tx.loan.update({
    where: { id: loanId },
    data: {
      totalPaid: fromCents(totalPaidCents),
      totalLateFees: fromCents(totalLateFeeCents),
      outstanding: fromCents(outstandingCents),
      daysInArrears: summary.daysInArrears,
      status: nextStatus,
      closingDate: isPaid ? (loan.closingDate ?? asOf) : null,
    },
  });
}

export async function disburseLoan(
  loanId: string,
  options: { cashBoxId?: string | null; userId?: string | null } = {},
): Promise<void> {
  await db.$transaction(async (tx) => {
    const loan = await tx.loan.findUniqueOrThrow({ where: { id: loanId } });
    if (loan.status !== "DRAFT" && loan.status !== "APPROVED") return;

    await tx.loan.update({
      where: { id: loanId },
      data: { status: "ACTIVE", disbursedAt: new Date() },
    });

    if (options.cashBoxId) {
      await recordDisbursement(tx, {
        cashBoxId: options.cashBoxId,
        amount: Number(loan.principal),
        loanCode: loan.code,
        loanId: loan.id,
        createdById: options.userId ?? null,
      });
    }

    await tx.auditLog.create({
      data: {
        companyId: loan.companyId,
        userId: options.userId ?? null,
        action: "loan.disbursed",
        entityType: "Loan",
        entityId: loanId,
        metadata: { code: loan.code },
      },
    });

    await refreshLoan(tx, loanId);
  });
}
