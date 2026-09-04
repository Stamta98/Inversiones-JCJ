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
import {
  defaultEnabledModuleKeys,
  MODULE_REGISTRY,
} from "../src/core/modules/registry";
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
    birthDate: new Date("1988-03-14"),
    gender: "FEMALE" as const,
    nationality: "Colombiana",
    mobilePhone: "573001110101",
    address: "Calle 38 Sur 78-45",
    neighborhood: "Kennedy",
    landmark: "Frente a la tienda La Esquina",
    city: "Bogotá",
    latitude: 4.6286,
    longitude: -74.1568,
    paydayKind: "DAILY" as const,
    references: [
      {
        fullName: "Rosa Pérez",
        relationship: "Hermana",
        phone: "573001110201",
      },
      {
        fullName: "Julio Castro",
        relationship: "Vecino",
        phone: "573001110202",
      },
    ],
    employmentType: "INDEPENDENT" as const,
    occupation: "Comerciante",
    workAddress: "Puesto 14, Plaza de Mercado de Kennedy",
    workNeighborhood: "Kennedy",
    monthlyIncome: 2800000,
  },
  {
    firstName: "José",
    lastName: "Rodríguez",
    birthDate: new Date("1979-11-02"),
    gender: "MALE" as const,
    nationality: "Colombiana",
    mobilePhone: "573001110102",
    address: "Carrera 80 65-12",
    neighborhood: "Robledo",
    landmark: "Casa verde al lado de la cancha",
    city: "Medellín",
    latitude: 6.2799,
    longitude: -75.5905,
    paydayKind: "BIWEEKLY" as const,
    paydayWeekday: 5,
    references: [
      {
        fullName: "Ana Rodríguez",
        relationship: "Esposa",
        phone: "573001110203",
      },
    ],
    employmentType: "EMPLOYEE" as const,
    occupation: "Conductor",
    employerName: "Transportes del Valle",
    workAddress: "Autopista Norte km 4",
    workNeighborhood: "Bello",
    monthlyIncome: 2200000,
  },
  {
    firstName: "Carmen",
    lastName: "Santana",
    birthDate: new Date("1995-07-21"),
    gender: "FEMALE" as const,
    nationality: "Venezolana",
    mobilePhone: "573001110103",
    address: "Calle 44 12-80",
    neighborhood: "Aguablanca",
    landmark: "Al lado de la panadería Carolina",
    city: "Cali",
    paydayKind: "WEEKLY" as const,
    paydayWeekday: 6,
    references: [
      { fullName: "Luz Santana", relationship: "Madre", phone: "573001110204" },
    ],
    employmentType: "INDEPENDENT" as const,
    occupation: "Estilista",
    workAddress: "Salón Carmen, Calle 44",
    workNeighborhood: "Aguablanca",
    monthlyIncome: 1900000,
  },
  {
    firstName: "Luis",
    lastName: "Fernández",
    birthDate: new Date("1966-01-09"),
    gender: "MALE" as const,
    nationality: "Colombiana",
    mobilePhone: "573001110104",
    address: "Carrera 7 22-31",
    neighborhood: "Girón",
    landmark: "Detrás del taller de motos",
    city: "Bucaramanga",
    latitude: 7.0682,
    longitude: -73.1685,
    paydayKind: "WEEKLY" as const,
    paydayWeekday: 6,
    references: [
      {
        fullName: "Elena Fernández",
        relationship: "Madre",
        phone: "573001110205",
      },
      {
        fullName: "Rafael Guzmán",
        relationship: "Compadre",
        phone: "573001110206",
      },
    ],
    employmentType: "INDEPENDENT" as const,
    occupation: "Mecánico",
    workAddress: "Taller Luis, Carrera 9 22-10",
    workNeighborhood: "Girón",
    monthlyIncome: 2400000,
  },
  {
    firstName: "Ana",
    lastName: "Jiménez",
    birthDate: new Date("1992-05-30"),
    gender: "FEMALE" as const,
    nationality: "Colombiana",
    mobilePhone: "573001110105",
    address: "Calle 17 38-09",
    neighborhood: "Rebolo",
    landmark: "Frente a la escuela",
    city: "Barranquilla",
    paydayKind: "MONTHLY" as const,
    paydayDayOfMonth: 30,
    references: [
      {
        fullName: "Pedro Jiménez",
        relationship: "Hermano",
        phone: "573001110207",
      },
    ],
    employmentType: "EMPLOYEE" as const,
    occupation: "Cajera",
    employerName: "Supermercado La Economía",
    workAddress: "Calle 30 45-11",
    workNeighborhood: "El Prado",
    monthlyIncome: 1700000,
  },
];

/**
 * Loans spread across methods, frequencies and arrears so screens have data.
 *
 * Rates are quoted the way a lender quotes them, over the whole loan: "500 mil
 * al 20% en 5 semanas, cuotas de 120 mil". The French one keeps a rate per
 * installment because that is what the system means — interest on the balance
 * that is left.
 */
const DEMO_LOANS = [
  {
    // 500.000 al 20% = 600.000 en 5 cuotas semanales de 120.000.
    customerIndex: 0,
    principal: 500000,
    interestRate: 20,
    rateBasis: "TOTAL" as const,
    interestMethod: "FLAT" as const,
    frequency: "WEEKLY" as const,
    termCount: 5,
    firstDueDateOffsetDays: 3,
    paymentsToPost: 0,
  },
  {
    // El mismo dinero en 4 cuotas: 150.000 cada una.
    customerIndex: 1,
    principal: 500000,
    interestRate: 20,
    rateBasis: "TOTAL" as const,
    interestMethod: "FLAT" as const,
    frequency: "WEEKLY" as const,
    termCount: 4,
    firstDueDateOffsetDays: 5,
    paymentsToPost: 0,
  },
  {
    // Quincenal: 600.000 en 2 cuotas de 300.000.
    customerIndex: 2,
    principal: 500000,
    interestRate: 20,
    rateBasis: "TOTAL" as const,
    interestMethod: "FLAT" as const,
    frequency: "BIWEEKLY" as const,
    termCount: 2,
    firstDueDateOffsetDays: 8,
    paymentsToPost: 0,
  },
  {
    // Diario sin domingos, que es como se cobra en la calle. Este es el que
    // lleva atraso, para que las pantallas de mora y de cobranza tengan algo
    // que mostrar.
    customerIndex: 3,
    principal: 1000000,
    interestRate: 20,
    rateBasis: "TOTAL" as const,
    interestMethod: "FLAT" as const,
    frequency: "DAILY" as const,
    nonCollectionDays: [0],
    termCount: 30,
    firstDueDateOffsetDays: -20,
    paymentsToPost: 10,
  },
  {
    customerIndex: 4,
    principal: 3000000,
    interestRate: 3,
    rateBasis: "PER_PERIOD" as const,
    interestMethod: "FRENCH" as const,
    frequency: "MONTHLY" as const,
    termCount: 12,
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
      legalName: "Inversiones JCJ S.A.S.",
      phone: "601 555 0100",
      country: "CO",
      city: "Bogotá",
      state: "Cundinamarca",
      currencyCode: "COP",
      // El peso colombiano no usa centavos: las cuotas salen en pesos enteros.
      decimalPlaces: 0,
      locale: "es-CO",
      timezone: "America/Bogota",
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
      username: "admin",
      passwordHash,
      fullName: "Juan Carlos Jiménez",
      phone: "573001110100",
    },
  });

  const collector = await db.user.upsert({
    where: { email: "cobrador@inversionesjcj.com" },
    update: {},
    create: {
      email: "cobrador@inversionesjcj.com",
      username: "cobrador",
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
        balance: 20000000,
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
        rateBasis: spec.rateBasis,
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
          rateBasis: spec.rateBasis,
          frequency: spec.frequency,
          nonCollectionDays,
          termCount: spec.termCount,
          firstDueDate,
          // La plata se entrega cuando se hace el préstamo, no el día de la
          // primera cuota: con la fecha de la cuota, un préstamo demostrativo
          // aparecía empezando después de haberse acabado.
          disbursedAt: today,
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
  console.log(`  Usuario:   ${owner.username} (${owner.email})`);
  console.log(`  Cobrador:  ${collector.username} (${collector.email})`);
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
