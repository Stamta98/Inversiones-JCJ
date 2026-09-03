/**
 * Saving the order a person put their lists in.
 *
 * The move arrives as "put this row before that one", never as an index: the
 * list on screen may be searched or filtered, so the row above it there is not
 * always the row above it here. Naming the neighbour means the same thing in
 * both views.
 *
 * Positions start at zero for everything, so a company that never reorders
 * anything keeps its usual sort. The first move numbers the list once and
 * every move after that touches only the rows between where the row was and
 * where it went.
 */

import { Prisma } from "@prisma/client";

import {
  changedPositions,
  moveRelativeTo,
  type Placement,
  type Positioned,
} from "@/core/ordering";

import { db } from "../db";

export interface MoveInput {
  companyId: string;
  id: string;
  /** The row it is being put next to. Null when it goes to the front. */
  targetId?: string | null;
  placement: Placement;
}

/**
 * The order the lists are read in, and the one a move is computed against.
 *
 * The id at the end makes it total: without it two customers with the same
 * name could swap places between two reads and a move would land somewhere
 * nobody asked for.
 */
const CUSTOMER_ORDER: Prisma.CustomerOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { lastName: "asc" },
  { firstName: "asc" },
  { id: "asc" },
];

const LOAN_ORDER: Prisma.LoanOrderByWithRelationInput[] = [
  { sortOrder: "asc" },
  { daysInArrears: "desc" },
  { createdAt: "desc" },
  { id: "asc" },
];

export { CUSTOMER_ORDER, LOAN_ORDER };

/**
 * Writes the new positions in one statement.
 *
 * A first move on a long list renumbers all of it, and a row at a time would
 * be a round trip each.
 */
async function writePositions(
  table: "Customer" | "Loan",
  companyId: string,
  changed: readonly Positioned[],
): Promise<void> {
  if (changed.length === 0) return;

  const values = Prisma.join(
    changed.map((row) => Prisma.sql`(${row.id}, ${row.sortOrder})`),
  );
  // The company is in the WHERE as well as the id: an id typed into the form
  // must not be able to renumber another company's list.
  const target = table === "Customer" ? Prisma.sql`"Customer"` : Prisma.sql`"Loan"`;

  await db.$executeRaw`
    UPDATE ${target} AS t
    SET "sortOrder" = v.position::int
    FROM (VALUES ${values}) AS v(id, position)
    WHERE t.id = v.id::text AND t."companyId" = ${companyId}
  `;
}

export async function moveCustomer(input: MoveInput): Promise<void> {
  const rows = await db.customer.findMany({
    where: { companyId: input.companyId },
    orderBy: CUSTOMER_ORDER,
    select: { id: true, sortOrder: true },
  });

  const order = moveRelativeTo(
    rows.map((row) => row.id),
    input.id,
    input.targetId ?? null,
    input.placement,
  );

  await writePositions(
    "Customer",
    input.companyId,
    changedPositions(order, new Map(rows.map((row) => [row.id, row.sortOrder]))),
  );
}

export async function moveLoan(input: MoveInput): Promise<void> {
  const rows = await db.loan.findMany({
    where: { companyId: input.companyId },
    orderBy: LOAN_ORDER,
    select: { id: true, sortOrder: true },
  });

  const order = moveRelativeTo(
    rows.map((row) => row.id),
    input.id,
    input.targetId ?? null,
    input.placement,
  );

  await writePositions(
    "Loan",
    input.companyId,
    changedPositions(order, new Map(rows.map((row) => [row.id, row.sortOrder]))),
  );
}

/** Back to the automatic order, for a list that got shuffled into a mess. */
export async function resetCustomerOrder(companyId: string): Promise<void> {
  await db.customer.updateMany({
    where: { companyId, sortOrder: { not: 0 } },
    data: { sortOrder: 0 },
  });
}

export async function resetLoanOrder(companyId: string): Promise<void> {
  await db.loan.updateMany({
    where: { companyId, sortOrder: { not: 0 } },
    data: { sortOrder: 0 },
  });
}
