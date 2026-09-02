/**
 * Seed script.
 *
 * Creates one company with its roles, modules, templates, automation rules and
 * a small but realistic portfolio, so the app is usable the moment it starts.
 *
 *   npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { buildSchedule } from "../src/core/loans/schedule";
import { defaultEnabledModuleKeys, MODULE_REGISTRY } from "../src/core/modules/registry";
import { fromCents, toCents } from "../src/core/money";
import { ROLE_PRESETS } from "../src/core/permissions";
import { addDays } from "../src/core/dates";
import { es } from "../src/i18n/es";
import {
  DEFAULT_AUTOMATION_RULES,
  DEFAULT_TEMPLATES,
} from "../src/modules/templates/defaults";

const db = new PrismaClient();

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "Cambiar123";

const DEMO_CUSTOMERS = [
  {
    firstName: "María",
    lastName: "Pérez",
    mobilePhone: "18095550101",
    address: "Calle Duarte 45",
    neighborhood: "Villa Consuelo",
    landmark: "Frente al colmado Mi Ranchito",
    city: "Santo Domingo",
    latitude: 18.4861,
    longitude: -69.8967,
    paydayKind: "DAILY" as const,
    references: [
      { fullName: "Rosa Pérez", relationship: "Hermana", phone: "18095550201" },
      { fullName: "Julio Castro", relationship: "Vecino", phone: "18095550202" },
    ],
    employmentType: "INDEPENDENT" as const,
    occupation: "Comerciante",
    workAddress: "Puesto 14, Mercado Nuevo",
    workNeighborhood: "Villa Consuelo",
    monthlyIncome: 45000,
  },
  {
    firstName: "José",
    lastName: "Rodríguez",
    mobilePhone: "18095550102",
    address: "Av. Independencia 210",
    neighborhood: "Los Jardines",
    landmark: "Casa verde al lado del play",
    city: "Santiago",
    latitude: 19.4517,
    longitude: -70.6970,
    paydayKind: "SEMIMONTHLY" as const,
    references: [
      { fullName: "Ana Rodríguez", relationship: "Esposa", phone: "18095550203" },
    ],
    employmentType: "EMPLOYEE" as const,
    occupation: "Chofer",
    employerName: "Transporte del Cibao",
    workAddress: "Carretera Duarte km 4",
    workNeighborhood: "Gurabo",
    monthlyIncome: 32000,
  },
  {
    firstName: "Carmen",
    lastName: "Santana",
    mobilePhone: "18095550103",
    address: "Calle El Sol 12",
    neighborhood: "Don Bosco",
    landmark: "Al lado de la farmacia Carolina",
    city: "La Vega",
    paydayKind: "DAILY" as const,
    references: [
      { fullName: "Miguel Santana", relationship: "Hermano", phone: "18095550204" },
    ],
    employmentType: "INDEPENDENT" as const,
    occupation: "Estilista",
    workAddress: "Salón Carmen, Calle Restauración 30",
    workNeighborhood: "Centro",
    monthlyIncome: 28000,
  },
  {
    firstName: "Luis",
    lastName: "Fernández",
    mobilePhone: "18095550104",
    address: "Calle Primera 7",
    neighborhood: "Los Mina",
    landmark: "Detrás del taller de motores",
    city: "Santo Domingo Este",
    latitude: 18.4939,
    longitude: -69.8570,
    paydayKind: "WEEKLY" as const,
    paydayWeekday: 6,
    references: [
      { fullName: "Elena Fernández", relationship: "Madre", phone: "18095550205" },
      { fullName: "Rafael Guzmán", relationship: "Compadre", phone: "18095550206" },
    ],
    employmentType: "INDEPENDENT" as const,
    occupation: "Mecánico",
    workAddress: "Taller Luis, Av. San Vicente 88",
    workNeighborhood: "Los Mina Norte",
    monthlyIncome: 38000,
  },
  {
    firstName: "Ana",
    lastName: "Jiménez",
    mobilePhone: "18095550105",
    address: "Calle Mella 8",
    neighborhood: "Madre Vieja Sur",
    landmark: "Frente a la escuela",
    city: "San Cristóbal",
    paydayKind: "MONTHLY" as const,
    paydayDayOfMonth: 30,
    references: [
      { fullName: "Sonia Jiménez", relationship: "Hermana", phone: "18095550207" },
    ],
    employmentType: "EMPLOYEE" as const,
    occupation: "Enfermera",
    employerName: "Hospital Juan Pablo Pina",
    workAddress: "Av. Constitución 2",
    workNeighborhood: "Centro",
    monthlyIncome: 52000,
  },
];

/** Loans spread across methods, frequencies and arrears so screens have data. */
const DEMO_LOANS = [
  {
    customerIndex: 0,
    principal: 25000,
    interestRate: 10,
    interestMethod: "FLAT" as const,
    frequency: "MONTHLY" as const,
    termCount: 6,
    firstDueDateOffsetDays: -90,
    paymentsToPost: 3,
  },
  {
    customerIndex: 1,
    principal: 15000,
    interestRate: 5,
    interestMethod: "FLAT" as const,
    frequency: "WEEKLY" as const,
    termCount: 12,
    firstDueDateOffsetDays: -60,
    paymentsToPost: 4,
  },
  {
    customerIndex: 2,
    principal: 40000,
    interestRate: 3,
    interestMethod: "FRENCH" as const,
    frequency: "MONTHLY" as const,
    termCount: 12,
    firstDueDateOffsetDays: -45,
    paymentsToPost: 1,
  },
  {
    // Diario pero sin domingos, que es como se cobra en la calle.
    customerIndex: 3,
    principal: 8000,
    interestRate: 2,
    interestMethod: "FLAT" as const,
    frequency: "DAILY" as const,
    nonCollectionDays: [0],
    termCount: 30,
    firstDueDateOffsetDays: -20,
    paymentsToPost: 10,
  },
  {
    customerIndex: 4,
    principal: 60000,
    interestRate: 4,
    interestMethod: "AMERICAN" as const,
    frequency: "MONTHLY" as const,
    termCount: 6,
    firstDueDateOffsetDays: 5,
    paymentsToPost: 0,
  },
];

async function main(): Promise<void> {
  console.log("Sembrando datos…");

  const company = await db.company.upsert({
    where: { id: "seed-company" },
    update: {},
    create: {
      id: "seed-company",
      name: "Inversiones JCJ",
      legalName: "Inversiones JCJ, SRL",
      phone: "809-555-0100",
      currencyCode: "DOP",
      locale: "es-DO",
      timezone: "America/Santo_Domingo",
    },
  });

  // Roles ------------------------------------------------------------------
  for (const preset of ROLE_PRESETS) {
    await db.role.upsert({
      where: { companyId_key: { companyId: company.id, key: preset.key } },
      update: { permissions: preset.permissions },
      create: {
        companyId: company.id,
        key: preset.key,
        name: (es.roles as Record<string, string>)[preset.key] ?? preset.key,
        permissions: preset.permissions,
        isSystem: preset.isSystem,
      },
    });
  }

  const ownerRole = await db.role.findFirstOrThrow({
    where: { companyId: company.id, key: "owner" },
  });
  const collectorRole = await db.role.findFirstOrThrow({
    where: { companyId: company.id, key: "collector" },
  });

  // Modules ----------------------------------------------------------------
  for (const moduleKey of defaultEnabledModuleKeys()) {
    const definition = MODULE_REGISTRY.find((item) => item.key === moduleKey);
    await db.moduleInstallation.upsert({
      where: { companyId_moduleKey: { companyId: company.id, moduleKey } },
      update: {},
      create: {
        companyId: company.id,
        moduleKey,
        sortOrder: definition?.sortOrder ?? 0,
      },
    });
  }

  // Users ------------------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const owner = await db.user.upsert({
    where: { email: "admin@inversionesjcj.com" },
    update: {},
    create: {
      email: "admin@inversionesjcj.com",
      passwordHash,
      fullName: "Juan Carlos Jiménez",
      phone: "809-555-0100",
    },
  });

  const collector = await db.user.upsert({
    where: { email: "cobrador@inversionesjcj.com" },
    update: {},
    create: {
      email: "cobrador@inversionesjcj.com",
      passwordHash,
      fullName: "Pedro Martínez",
    },
  });

  for (const [user, role] of [
    [owner, ownerRole],
    [collector, collectorRole],
  ] as const) {
    await db.membership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      update: { roleId: role.id },
      create: { userId: user.id, companyId: company.id, roleId: role.id },
    });
  }

  // Cash and expense categories -------------------------------------------
  const cashBox = await db.cashBox.findFirst({
    where: { companyId: company.id, name: "Caja principal" },
  });

  const mainCashBox =
    cashBox ??
    (await db.cashBox.create({
      data: {
        companyId: company.id,
        name: "Caja principal",
        kind: "CASH",
        balance: 500000,
      },
    }));

  for (const name of ["Transporte", "Papelería", "Comisiones", "Servicios"]) {
    await db.expenseCategory.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: {},
      create: { companyId: company.id, name },
    });
  }

  // Templates --------------------------------------------------------------
  for (const template of DEFAULT_TEMPLATES) {
    await db.template.upsert({
      where: { companyId_key: { companyId: company.id, key: template.key } },
      update: { body: template.body },
      create: {
        companyId: company.id,
        key: template.key,
        name: template.name,
        kind: template.kind,
        body: template.body,
        isSystem: true,
      },
    });
  }

  // Messaging account in test mode: nothing leaves the building until the
  // operator connects a real provider from the settings screen.
  const existingAccount = await db.messagingAccount.findFirst({
    where: { companyId: company.id },
  });
  if (!existingAccount) {
    await db.messagingAccount.create({
      data: {
        companyId: company.id,
        channel: "WHATSAPP",
        provider: "log",
        displayName: "WhatsApp (modo prueba)",
        isDefault: true,
      },
    });
  }

  // Automation rules -------------------------------------------------------
  const rulesToCreate = DEFAULT_AUTOMATION_RULES;

  for (const rule of rulesToCreate) {
    const existing = await db.automationRule.findFirst({
      where: { companyId: company.id, name: rule.name },
    });
    if (existing) continue;

    const template = await db.template.findFirstOrThrow({
      where: { companyId: company.id, key: rule.templateKey },
    });

    await db.automationRule.create({
      data: {
        companyId: company.id,
        name: rule.name,
        trigger: rule.trigger,
        offsetDays: rule.offsetDays,
        channel: "WHATSAPP",
        templateId: template.id,
        sendAtTime: "09:00",
      },
    });
  }

  // Customers --------------------------------------------------------------
  const customerCount = await db.customer.count({
    where: { companyId: company.id },
  });

  if (customerCount === 0) {
    await Promise.all(
      DEMO_CUSTOMERS.map((customer, index) => {
        const { references, ...fields } = customer;
        return db.customer.create({
          data: {
            companyId: company.id,
            code: `CLI-${String(index + 1).padStart(6, "0")}`,
            ...fields,
            references: { create: references },
          },
        });
      }),
    );
  }

  const customers = await db.customer.findMany({
    where: { companyId: company.id },
    orderBy: { code: "asc" },
  });

  // Loans ------------------------------------------------------------------
  const loanCount = await db.loan.count({ where: { companyId: company.id } });

  if (loanCount === 0) {
    const today = new Date();

    for (const [index, spec] of DEMO_LOANS.entries()) {
      const customer = customers[spec.customerIndex];
      if (!customer) continue;

      const firstDueDate = addDays(today, spec.firstDueDateOffsetDays);
      const nonCollectionDays =
        "nonCollectionDays" in spec ? spec.nonCollectionDays : [];

      const schedule = buildSchedule({
        principalCents: toCents(spec.principal),
        interestRate: spec.interestRate,
        interestMethod: spec.interestMethod,
        frequency: spec.frequency,
        termCount: spec.termCount,
        firstDueDate,
        nonCollectionDays,
      });

      await db.loan.create({
        data: {
          companyId: company.id,
          customerId: customer.id,
          code: `PRE-${String(index + 1).padStart(6, "0")}`,
          principal: spec.principal,
          interestMethod: spec.interestMethod,
          interestRate: spec.interestRate,
          frequency: spec.frequency,
          nonCollectionDays,
          termCount: spec.termCount,
          firstDueDate,
          disbursedAt: firstDueDate,
          status: "ACTIVE",
          lateFeeMode: "PERCENT_PER_DAY",
          lateFeeValue: 1,
          gracePeriodDays: 2,
          totalPrincipal: fromCents(schedule.totalPrincipalCents),
          totalInterest: fromCents(schedule.totalInterestCents),
          outstanding: fromCents(schedule.totalToPayCents),
          installments: {
            create: schedule.installments.map((installment) => ({
              number: installment.number,
              dueDate: installment.dueDate,
              principalAmount: fromCents(installment.principalCents),
              interestAmount: fromCents(installment.interestCents),
              totalAmount: fromCents(installment.totalCents),
              balanceAfter: fromCents(installment.balanceAfterCents),
            })),
          },
        },
      });
    }

    // Payments are posted through the real service so the allocations, cash
    // movements and arrears all end up consistent with production behaviour.
    const { postPayment } = await import("../src/server/services/payments");
    const loans = await db.loan.findMany({
      where: { companyId: company.id },
      include: { installments: { orderBy: { number: "asc" } } },
      orderBy: { code: "asc" },
    });

    for (const [index, loan] of loans.entries()) {
      const spec = DEMO_LOANS[index];
      if (!spec) continue;

      for (let n = 0; n < spec.paymentsToPost; n += 1) {
        const installment = loan.installments[n];
        if (!installment) break;

        await postPayment({
          companyId: company.id,
          loanId: loan.id,
          amount: Number(installment.totalAmount),
          method: "CASH",
          paidAt: installment.dueDate,
          cashBoxId: mainCashBox.id,
          collectedById: collector.id,
        }).catch(() => undefined);
      }
    }

    // Bring every loan's arrears up to date as of today.
    const { refreshLoan } = await import("../src/server/services/loans");
    for (const loan of loans) {
      await db.$transaction((tx) => refreshLoan(tx, loan.id));
    }
  }

  console.log("Listo.");
  console.log(`  Empresa:   ${company.name}`);
  console.log(`  Usuario:   ${owner.email}`);
  console.log(`  Cobrador:  ${collector.email}`);
  console.log(`  Clave:     ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
