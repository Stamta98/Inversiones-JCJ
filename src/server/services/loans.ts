/**
 * Loan service.
 *
 * Owns everything that writes to a loan: creating it with its schedule,
 * disbursing it, and recomputing its totals and arrears after any change.
 */

import type { Prisma } from "@prisma/client";

import {
  afterEndLateFee,
  summarizeArrears,
  type LateFeePolicy,
} from "@/core/loans/arrears";
import {
  cashHandedOver,
  normalizeCharge,
  summarizeCharges,
  type Charge,
  type ChargeMode,
} from "@/core/loans/charges";
import { allocatePayment } from "@/core/loans/allocation";
import { canEditAtAll } from "@/core/loans/editable";
import { guarantorProblem } from "@/core/loans/guarantor";
import { buildSchedule, type Schedule } from "@/core/loans/schedule";
import { fromCents, stepForDecimals, toCents } from "@/core/money";
import { isPercentLateFee } from "@/core/types";
import type {
  InstallmentStatus,
  InterestMethod,
  LateFeeMode,
  PaymentFrequency,
  RateBasis,
} from "@/core/types";

import { db } from "../db";
import { nextLoanCode, withCodeRetry } from "./sequences";

export interface CreateLoanInput {
  companyId: string;
  branchId?: string | null;
  customerId: string;
  /** Quien responde si el cliente no paga. Otro cliente de la empresa. */
  guarantorId?: string | null;
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
    financedChargeCents: summarizeCharges(
      normalizedCharges(input.charges, step),
      step,
    ).financedCents,
  });
}

/** Los cargos ya listos para guardar, o un error diciendo cuál no sirve. */
export function normalizedCharges(
  charges: CreateLoanInput["charges"],
  step: ReturnType<typeof stepForDecimals>,
): Charge[] {
  return (charges ?? []).map((charge) =>
    normalizeCharge(
      {
        name: charge.name,
        amountCents: toCents(charge.amount),
        mode: charge.mode,
      },
      step,
    ),
  );
}

/**
 * Comprueba el fiador antes de guardar nada.
 *
 * Dos cosas que la llave de la base no puede decir por sí sola: que el
 * fiador sea de esta empresa —la llave acepta cualquier cliente, también el
 * de otra oficina— y que no sea el mismo que pide la plata, que no respalda
 * nada y solo confunde el papel.
 */
async function checkGuarantor(
  tx: Pick<typeof db, "customer">,
  companyId: string,
  guarantorId: string | null | undefined,
  customerId: string,
): Promise<string | null> {
  if (!guarantorId) return null;
  // Solo se pregunta a la base cuando hace falta: si se puso a sí mismo, la
  // regla ya lo rechaza sin consultar nada.
  const found =
    guarantorId === customerId
      ? false
      : (await tx.customer.findFirst({
          where: { id: guarantorId, companyId },
          select: { id: true },
        })) !== null;

  const problem = guarantorProblem(guarantorId, customerId, found);
  if (problem)
    throw new LoanServiceError(`Invalid guarantor: ${problem}`, problem);
  return guarantorId;
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
      const guarantorId = await checkGuarantor(
        tx,
        input.companyId,
        input.guarantorId,
        input.customerId,
      );
      const code = await nextLoanCode(tx, input.companyId);
      const now = new Date();

      const loan = await tx.loan.create({
        data: {
          companyId: input.companyId,
          branchId: input.branchId ?? null,
          customerId: input.customerId,
          guarantorId,
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
          // La del plan, no la que se escogió en el formulario: si el día
          // elegido cae en uno que no se cobra, la cuota se corre y el
          // préstamo tiene que decir el día en que de verdad se cobra.
          firstDueDate: schedule.installments[0]?.dueDate ?? input.firstDueDate,
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
      | "alreadyRenewed"
      | "guarantorNotFound"
      | "guarantorIsBorrower"
      | "belowPaid",
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
  /** El fiador. Sin pasarlo no se toca; vacío lo quita. */
  guarantorId?: string | null;
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

    if (input.guarantorId !== undefined) {
      await checkGuarantor(
        tx,
        input.companyId,
        input.guarantorId || null,
        loan.customerId,
      );
    }

    // Las condiciones se pueden corregir después de creado el préstamo: quien
    // presta se equivoca tecleando y lo que hace falta es arreglarlo, no
    // borrarlo y volver a empezar. Lo que ya se cobró no se pierde — se vuelve
    // a aplicar contra el plan nuevo más abajo.
    const step = stepForDecimals(
      input.terms?.decimalPlaces ?? input.decimalPlaces ?? 2,
    );
    // Con la plata ya entregada, cómo se cobra un cargo deja de escogerse.
    // Descontarle 50.000 a una entrega que ya pasó no le quita nada al
    // cliente — la plata está en su bolsillo — pero le sumaba 50.000 a la
    // caja que nadie había dado, y no quedaba ni deuda ni dueño. Un cargo
    // puesto después queda debiéndose y se cobra aparte; uno que ya venía
    // conserva el suyo, que era parte del trato el día que se firmó.
    const charges = normalizedCharges(
      input.charges === undefined
        ? chargesOf(loan)
        : loan.disbursedAt
          ? input.charges.map((charge) => {
              const before = loan.charges.find(
                (saved) =>
                  saved.name === charge.name.trim().replace(/\s+/g, " "),
              );
              return {
                ...charge,
                mode: (before?.mode ?? "PENDING") as ChargeMode,
              };
            })
          : input.charges,
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
      ? previewSchedule({
          ...input.terms,
          charges: input.charges ?? chargesOf(loan),
        })
      : null;

    // Un plan nuevo que valga menos de lo que el cliente ya abonó no se
    // guarda. Los cobros se vuelven a repartir sobre las cuotas nuevas, y lo
    // que no cabe en ninguna se pierde sin dejar rastro: un préstamo con
    // 54.000 abonados en dos recibos, bajado a 48.000, quedaba diciendo que
    // el cliente pagó 48.000 y saldado. Los 6.000 estaban en la caja pero ya
    // no eran de nadie, y ni el recibo ni la pantalla decían que se le debían
    // devolver. Se dice antes de escribir, que es cuando todavía se puede
    // arreglar el número mal tecleado.
    if (schedule) {
      const paid = await tx.payment.aggregate({
        where: { loanId: loan.id, status: "POSTED" },
        _sum: { amount: true },
      });
      const paidCents = toCents(Number(paid._sum.amount ?? 0));
      if (schedule.totalToPayCents < paidCents) {
        throw new LoanServiceError(
          "New terms owe less than what was already paid",
          "belowPaid",
        );
      }
    }

    await tx.loan.update({
      where: { id: loan.id },
      data: {
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.guarantorId !== undefined
          ? { guarantorId: input.guarantorId || null }
          : {}),
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
              firstDueDate:
                schedule.installments[0]?.dueDate ?? input.terms.firstDueDate,
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
      // Lo que ya se cobró de un cargo pendiente no se puede perder al
      // reescribir la lista: borrarlo y volverlo a crear lo dejaba debiendo
      // otra vez lo que el cliente ya había pagado, con la plata en la caja.
      // Se rescata por nombre, que es con lo que el cobrador lo reconoce.
      const paidBefore = new Map(
        (
          await tx.loanCharge.findMany({
            where: { loanId: loan.id, paidAmount: { gt: 0 } },
            select: { name: true, paidAmount: true },
          })
        ).map((charge) => [charge.name, Number(charge.paidAmount)]),
      );

      await tx.loanCharge.deleteMany({ where: { loanId: loan.id } });
      await tx.loanCharge.createMany({
        data: charges.map((charge) => ({
          loanId: loan.id,
          name: charge.name,
          amount: fromCents(charge.amountCents),
          mode: charge.mode,
          // Y nunca más de lo que el cargo vale: si le bajaron el monto por
          // debajo de lo ya cobrado, queda saldado y no sobrando.
          paidAmount:
            charge.mode === "PENDING"
              ? Math.min(
                  paidBefore.get(charge.name) ?? 0,
                  fromCents(charge.amountCents),
                )
              : 0,
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
    //
    // Van en dos movimientos y no en uno solo: corregir el monto es una
    // corrección, pero un cargo es un cargo, y juntos en un renglón el
    // resumen del día no podía ver los cargos que se agregan después de
    // crear el préstamo — decía «ninguno» de plata que sí había entrado.
    const principalDelta = input.terms
      ? input.terms.principal - Number(loan.principal)
      : 0;
    const chargeDelta = fromCents(
      chargeSummary.deductedCents - previousDeducted,
    );
    if (principalDelta !== 0) {
      await adjustLoanCash(tx, {
        loanId: loan.id,
        loanCode: loan.code,
        cashDelta: -principalDelta,
        createdById: input.updatedById ?? null,
      });
    }
    if (chargeDelta !== 0) {
      await adjustLoanCharges(tx, {
        loanId: loan.id,
        loanCode: loan.code,
        amount: chargeDelta,
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
  charges?: Array<{
    name: string;
    amount: Prisma.Decimal | number;
    mode: string;
  }>;
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
 * Borra un préstamo para siempre.
 *
 * Es para el préstamo que nunca debió existir — el monto mal tecleado, el
 * cliente equivocado — y por eso lo deja como si nunca hubiera pasado,
 * empezando por la caja: vuelve el desembolso, se van los cobros y el saldo
 * queda exactamente donde estaba antes de crearlo.
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
        where: { parentLoanId: loan.id },
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

/**
 * Mueve la caja por un cargo que cambió después de entregar la plata.
 *
 * Es un cargo, no una corrección: entra al cajón con su propia clase para que
 * el resumen del día lo cuente entre los cargos y no lo pierda dentro de un
 * renglón de ajustes. Sin nombre, como el que se netea al entregar: el que se
 * cobra aparte en la puerta lleva el suyo y va en otro renglón.
 */
async function adjustLoanCharges(
  tx: Prisma.TransactionClient,
  input: {
    loanId: string;
    loanCode: string;
    /** Positivo si el cargo subió — entra plata —, negativo si bajó. */
    amount: number;
    createdById: string | null;
  },
): Promise<void> {
  if (input.amount === 0) return;

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
  const balanceAfter = Number(cashBox.balance) + input.amount;

  await tx.cashBox.update({
    where: { id: disbursement.cashBoxId },
    data: { balance: balanceAfter },
  });
  await tx.cashMovement.create({
    data: {
      cashBoxId: disbursement.cashBoxId,
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
    value: isPercentLateFee(mode) ? rawValue : toCents(rawValue),
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

  if (loan.status === "WRITTEN_OFF") return;

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

  // La mora por vencimiento del crédito, que no es de ninguna cuota sino del
  // préstamo entero: corre desde el día en que debía estar saldado y se saca
  // sobre todo lo que quedó debiendo. Se calcula aquí, una sola vez, y se
  // anota en la última cuota, que es la que marca ese vencimiento; así se
  // cobra por el mismo camino que las demás — el abono la salda primero — sin
  // inventar un renglón de deuda que viva fuera del plan.
  //
  // La base no lleva la mora encima: sacada del saldo completo se cobraría a
  // sí misma y crecería sola cada noche.
  const lastSnapshot = snapshots[snapshots.length - 1];
  const unpaidWithoutLateFees = snapshots.reduce(
    (total, snapshot) =>
      total +
      Math.max(
        0,
        snapshot.principalCents +
          snapshot.interestCents +
          snapshot.chargeCents -
          snapshot.paidCents,
      ),
    0,
  );
  const afterEndCents = lastSnapshot
    ? afterEndLateFee(
        {
          endDate: lastSnapshot.dueDate,
          unpaidCents: unpaidWithoutLateFees,
        },
        policy,
        asOf,
      )
    : 0;

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
          summarizeArrears([snapshot], policy, asOf).lateFeeCents +
            (snapshot.id === lastSnapshot?.id ? afterEndCents : 0),
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
  options: {
    cashBoxId?: string | null;
    userId?: string | null;
    /** Decimales de la moneda, para redondear el cargo como se cobra. */
    decimalPlaces?: number;
  } = {},
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
      // Y el cargo descontado vuelve al cajón, igual que cuando el préstamo
      // se entrega en el momento de crearlo. Sin esto, un préstamo guardado
      // en borrador y entregado después dejaba el cargo sin cobrar: la caja
      // decía que salieron los 500.000 completos cuando salieron 490.000, y
      // el resumen del día no veía el cargo por ninguna parte.
      const charges = await tx.loanCharge.findMany({
        where: { loanId: loan.id },
        select: { name: true, amount: true, mode: true },
      });
      const step = stepForDecimals(options.decimalPlaces ?? 2);
      const deducted = summarizeCharges(
        charges.map((charge) =>
          normalizeCharge(
            {
              name: charge.name,
              amountCents: toCents(Number(charge.amount)),
              mode: charge.mode as Charge["mode"],
            },
            step,
          ),
        ),
        step,
      ).deductedCents;

      await recordDeductedCharges(tx, {
        cashBoxId: options.cashBoxId,
        amount: fromCents(deducted),
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
