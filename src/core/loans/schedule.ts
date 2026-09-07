/**
 * Repayment schedule generation.
 *
 * Pure functions: no database, no I/O. Amounts are in cents so that the sum of
 * the installments always equals the total of the loan, with no drift.
 */

import {
  addDays,
  advanceByFrequency,
  nextCollectionDay,
  startOfDay,
} from "../dates";
import {
  addCents,
  percentOf,
  roundToStep,
  splitEvenly,
  type MinorUnitStep,
  type Cents,
} from "../money";
import {
  usesSequentialSkipping,
  type InterestMethod,
  type PaymentFrequency,
  type RateBasis,
} from "../types";

export interface ScheduleInput {
  principalCents: Cents;
  /** Interest rate as a percentage. What it is a percentage of is `rateBasis`. */
  interestRate: number;
  /**
   * Whether the rate covers the whole loan or every installment.
   *
   * Defaults to "PER_PERIOD" so the meaning of an existing call never changes
   * underneath it. Anything creating a loan should pass this explicitly: the
   * two readings differ by a factor of the term, not by rounding.
   */
  rateBasis?: RateBasis;
  interestMethod: InterestMethod;
  frequency: PaymentFrequency;
  /** Number of installments. Ignored for SINGLE, which always produces one. */
  termCount: number;
  firstDueDate: Date;
  /** Days between installments when the frequency is CUSTOM. */
  customIntervalDays?: number;
  /** Weekdays with no collection, 0 = Sunday through 6 = Saturday. */
  nonCollectionDays?: readonly number[];
  /**
   * Smallest chargeable amount, from the company's currency. Defaults to one
   * cent; a currency written without decimals passes 100 so every installment
   * lands on a whole unit and the plan still adds up to the principal.
   */
  minorUnitStep?: MinorUnitStep;
  /**
   * Cargos que se cobran con las cuotas en vez de descontarse al entregar la
   * plata. Se reparten entre todas las cuotas, no ganan interés: 100.000 al
   * 20% con un cargo de 5.000 son 125.000, no 126.000.
   */
  financedChargeCents?: Cents;
}

export interface ScheduledInstallment {
  number: number;
  dueDate: Date;
  principalCents: Cents;
  interestCents: Cents;
  /** Parte del cargo adicional que se cobra en esta cuota. */
  chargeCents: Cents;
  totalCents: Cents;
  /** Outstanding principal once this installment is paid. */
  balanceAfterCents: Cents;
}

export interface Schedule {
  installments: ScheduledInstallment[];
  totalPrincipalCents: Cents;
  totalInterestCents: Cents;
  totalChargeCents: Cents;
  totalToPayCents: Cents;
  /** True when the loan has no fixed end date (revolving credit line). */
  isOpenEnded: boolean;
}

/**
 * Lo que arma cada método antes de repartir los cargos. El cargo se añade
 * después, igual para los cinco métodos, porque no gana interés.
 */
type BareInstallment = Omit<ScheduledInstallment, "chargeCents">;

export class ScheduleError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "ScheduleError";
  }
}

function assertValidInput(input: ScheduleInput): void {
  if (input.principalCents <= 0) {
    throw new ScheduleError("Principal must be greater than zero", "principal");
  }
  if (input.interestRate < 0) {
    throw new ScheduleError("Interest rate cannot be negative", "interestRate");
  }
  if (!Number.isInteger(input.termCount) || input.termCount <= 0) {
    throw new ScheduleError(
      "Term must be a positive whole number",
      "termCount",
    );
  }
  if (Number.isNaN(input.firstDueDate.getTime())) {
    throw new ScheduleError("First due date is invalid", "firstDueDate");
  }
  if ((input.nonCollectionDays?.length ?? 0) >= 7) {
    throw new ScheduleError(
      "At least one weekday must remain available for collection",
      "nonCollectionDays",
    );
  }
  if (
    input.frequency === "CUSTOM" &&
    (!Number.isInteger(input.customIntervalDays) ||
      (input.customIntervalDays ?? 0) < 1)
  ) {
    throw new ScheduleError(
      "A custom frequency needs a whole number of days",
      "customIntervalDays",
    );
  }
}

/**
 * Due dates for the whole plan, with the non-collection weekdays applied.
 *
 * Sub-weekly frequencies walk forward and skip a blocked day, so a daily loan
 * that is not collected on Sunday runs one extra calendar day rather than
 * doubling up on Monday. Weekly and longer frequencies keep their anchor and
 * only nudge the individual date, so a monthly loan due on the 5th stays on
 * the 5th every month.
 */
function dueDates(input: ScheduleInput, count: number): Date[] {
  const blocked = input.nonCollectionDays ?? [];
  const interval = Math.max(1, input.customIntervalDays ?? 1);
  const anchor = nextCollectionDay(startOfDay(input.firstDueDate), blocked);

  if (!usesSequentialSkipping(input.frequency, interval)) {
    return Array.from({ length: count }, (_, index) =>
      nextCollectionDay(
        advanceByFrequency(anchor, input.frequency, index, interval),
        blocked,
      ),
    );
  }

  const step =
    input.frequency === "EVERY_OTHER_DAY"
      ? 2
      : input.frequency === "CUSTOM"
        ? interval
        : 1;

  const dates: Date[] = [];
  let current = anchor;
  for (let index = 0; index < count; index += 1) {
    dates.push(current);
    current = nextCollectionDay(addDays(current, step), blocked);
  }
  return dates;
}

/**
 * What the whole term costs in interest, whichever way the rate was quoted.
 *
 * Computed as one amount and split afterwards rather than multiplied up from a
 * per period figure, so a rate that does not divide evenly by the term cannot
 * leave the installments adding up to a few cents beside the total.
 */
function totalInterestOf(input: ScheduleInput, step: MinorUnitStep): Cents {
  const overWholeLoan = percentOf(
    input.principalCents,
    input.interestRate,
    step,
  );
  return (input.rateBasis ?? "PER_PERIOD") === "TOTAL"
    ? overWholeLoan
    : overWholeLoan * input.termCount;
}

/**
 * The rate one installment carries, for the methods that charge interest on
 * the outstanding balance and therefore need a per period figure.
 */
function ratePerPeriod(input: ScheduleInput): number {
  return (input.rateBasis ?? "PER_PERIOD") === "TOTAL"
    ? input.interestRate / input.termCount
    : input.interestRate;
}

/**
 * Flat rate: the interest of the whole term is computed once over the original
 * principal and then split evenly. This is the model behind "le presto 100 mil
 * al 20% a 30 días" street lending, and the reason its effective cost is far
 * above the headline.
 */
function buildFlatSchedule(input: ScheduleInput): BareInstallment[] {
  const count = input.termCount;
  const step = input.minorUnitStep ?? 1;
  const totalInterest = totalInterestOf(input, step);

  // What the borrower hands over is split first, and the principal share is
  // whatever is left after interest. Splitting principal and interest
  // separately makes both add up but leaves the installments a cent apart —
  // and "cuatro mil diarios" is the number the loan was agreed on, so it is
  // the one that has to come out even.
  const totalParts = splitEvenly(
    input.principalCents + totalInterest,
    count,
    step,
  );
  const interestParts = splitEvenly(totalInterest, count, step);
  const dates = dueDates(input, count);

  let balance = input.principalCents;
  return totalParts.map((totalCents, index) => {
    const interestCents = interestParts[index]!;
    const principalCents = totalCents - interestCents;
    balance -= principalCents;
    return {
      number: index + 1,
      dueDate: dates[index],
      principalCents,
      interestCents,
      totalCents,
      balanceAfterCents: balance,
    };
  });
}

/**
 * French system: a constant installment, with interest charged on the
 * outstanding balance so the principal share grows every period.
 */
function buildFrenchSchedule(input: ScheduleInput): BareInstallment[] {
  const count = input.termCount;
  const step = input.minorUnitStep ?? 1;
  const rate = ratePerPeriod(input) / 100;
  const dates = dueDates(input, count);

  if (rate === 0) {
    return buildGermanSchedule({ ...input, interestRate: 0 });
  }

  const factor = Math.pow(1 + rate, -count);
  const installmentCents = roundToStep(
    (input.principalCents * rate) / (1 - factor),
    step,
  );

  const firstPeriodInterest = roundToStep(input.principalCents * rate, step);
  if (installmentCents <= firstPeriodInterest) {
    throw new ScheduleError(
      "The installment does not cover the interest; lower the rate or extend the term",
      "interestRate",
    );
  }

  const installments: BareInstallment[] = [];
  let balance = input.principalCents;

  for (let index = 0; index < count; index += 1) {
    const isLast = index === count - 1;
    const interestCents = roundToStep(balance * rate, step);
    // The last installment takes whatever balance is left, which stays a whole
    // multiple of the step because every earlier deduction was one too.
    const principalCents = isLast
      ? balance
      : Math.min(installmentCents - interestCents, balance);

    balance -= principalCents;
    installments.push({
      number: index + 1,
      dueDate: dates[index],
      principalCents,
      interestCents,
      totalCents: principalCents + interestCents,
      balanceAfterCents: balance,
    });
  }

  return installments;
}

/**
 * German system: a constant principal share, so the installment decreases as
 * the balance goes down.
 */
function buildGermanSchedule(input: ScheduleInput): BareInstallment[] {
  const count = input.termCount;
  const step = input.minorUnitStep ?? 1;
  const rate = ratePerPeriod(input) / 100;
  const principalParts = splitEvenly(input.principalCents, count, step);
  const dates = dueDates(input, count);

  let balance = input.principalCents;
  return principalParts.map((principalCents, index) => {
    const interestCents = roundToStep(balance * rate, step);
    balance -= principalCents;
    return {
      number: index + 1,
      dueDate: dates[index],
      principalCents,
      interestCents,
      totalCents: principalCents + interestCents,
      balanceAfterCents: balance,
    };
  });
}

/**
 * American system: interest only every period, the whole principal falls due
 * with the last installment.
 */
function buildAmericanSchedule(input: ScheduleInput): BareInstallment[] {
  const count = input.termCount;
  const step = input.minorUnitStep ?? 1;
  // Split rather than repeated: the term's interest has to add up exactly,
  // even when it does not divide evenly into the installments.
  const interestParts = splitEvenly(totalInterestOf(input, step), count, step);
  const dates = dueDates(input, count);

  return dates.map((dueDate, index) => {
    const isLast = index === count - 1;
    const principalCents = isLast ? input.principalCents : 0;
    const interestPerPeriod = interestParts[index]!;
    return {
      number: index + 1,
      dueDate,
      principalCents,
      interestCents: interestPerPeriod,
      totalCents: principalCents + interestPerPeriod,
      balanceAfterCents: isLast ? 0 : input.principalCents,
    };
  });
}

/**
 * Línea de crédito: el cliente paga solo el interés cada periodo y el capital
 * queda parado hasta el final del plazo, donde cae completo.
 *
 * Antes el capital no se programaba en ninguna cuota, y por eso el préstamo
 * quedaba guardado debiendo solo los intereses: uno de 400.000 decía deber
 * 20.000. La deuda salía mal en la ficha, en la barra de avance y en la
 * cartera, y no había cuota contra la cual abonar el capital — el cliente no
 * tenía cómo saldarlo aunque quisiera. Ahora la última cuota lo lleva: si el
 * cliente todavía no lo va a saldar, se le alarga el plazo editando el
 * préstamo, que es lo que mantiene vivo el crédito.
 */
function buildCreditLineSchedule(input: ScheduleInput): BareInstallment[] {
  const step = input.minorUnitStep ?? 1;
  const count = input.termCount;
  const interestParts = splitEvenly(totalInterestOf(input, step), count, step);

  return dueDates(input, count).map((dueDate, index) => {
    const isLast = index === count - 1;
    const interestCents = interestParts[index]!;
    const principalCents = isLast ? input.principalCents : 0;
    return {
      number: index + 1,
      dueDate,
      principalCents,
      interestCents,
      totalCents: principalCents + interestCents,
      balanceAfterCents: isLast ? 0 : input.principalCents,
    };
  });
}

const BUILDERS: Record<
  InterestMethod,
  (input: ScheduleInput) => BareInstallment[]
> = {
  FLAT: buildFlatSchedule,
  FRENCH: buildFrenchSchedule,
  GERMAN: buildGermanSchedule,
  AMERICAN: buildAmericanSchedule,
  CREDIT_LINE: buildCreditLineSchedule,
};

export function buildSchedule(input: ScheduleInput): Schedule {
  assertValidInput(input);

  const step = input.minorUnitStep ?? 1;

  const normalized: ScheduleInput = {
    ...input,
    // A principal that is not a whole chargeable amount can never be split
    // into installments that add back up to it, so it is settled first.
    principalCents: roundToStep(input.principalCents, step),
    ...(input.frequency === "SINGLE" ? { termCount: 1 } : {}),
  };

  const builder = BUILDERS[normalized.interestMethod];
  if (!builder) {
    throw new ScheduleError(
      `Unsupported interest method: ${normalized.interestMethod}`,
      "interestMethod",
    );
  }

  const installments = withFinancedCharges(builder(normalized), step, input);
  const totalPrincipalCents = addCents(
    ...installments.map((installment) => installment.principalCents),
  );
  const totalInterestCents = addCents(
    ...installments.map((installment) => installment.interestCents),
  );
  const totalChargeCents = addCents(
    ...installments.map((installment) => installment.chargeCents),
  );

  return {
    installments,
    totalPrincipalCents,
    totalInterestCents,
    totalChargeCents,
    totalToPayCents:
      totalPrincipalCents + totalInterestCents + totalChargeCents,
    isOpenEnded: normalized.interestMethod === "CREDIT_LINE",
  };
}

/**
 * Reparte el cargo financiado entre las cuotas.
 *
 * Va después de armar el plan y no dentro de cada método, porque un cargo no
 * gana interés: se cobra tal cual, repartido parejo para que las cuotas sigan
 * saliendo iguales, que es como se acuerda un préstamo de calle.
 */
function withFinancedCharges(
  installments: BareInstallment[],
  step: MinorUnitStep,
  input: ScheduleInput,
): ScheduledInstallment[] {
  const financed = roundToStep(input.financedChargeCents ?? 0, step);
  if (financed <= 0) {
    return installments.map((installment) => ({
      ...installment,
      chargeCents: 0,
    }));
  }

  const parts = splitEvenly(financed, installments.length, step);
  return installments.map((installment, index) => {
    const chargeCents = parts[index]!;
    return {
      ...installment,
      chargeCents,
      totalCents: installment.totalCents + chargeCents,
    };
  });
}
