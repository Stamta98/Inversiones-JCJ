/**
 * Emits the foundation seed as plain SQL.
 *
 * The app's normal seed runs through Prisma, which needs a direct Postgres
 * connection. Where that is not available (a sandbox that only allows HTTP, a
 * managed console), this produces the same base data as SQL to paste into the
 * Supabase SQL editor. It reads the same constants as the app, so it cannot
 * drift from the role and module definitions.
 *
 *   npx tsx scripts/gen-seed-sql.ts > seed.sql
 */

import bcrypt from "bcryptjs";

import { MODULE_REGISTRY } from "../src/core/modules/registry";
import { ROLE_PRESETS } from "../src/core/permissions";
import { es } from "../src/i18n/es";
import {
  DEFAULT_AUTOMATION_RULES,
  DEFAULT_TEMPLATES,
} from "../src/modules/templates/defaults";

const COMPANY_ID = "seed-company";
const PASSWORD = process.env.SEED_PASSWORD ?? "Cambiar123";

const quote = (value: string | null | undefined): string =>
  value === null || value === undefined
    ? "NULL"
    : `'${String(value).replace(/'/g, "''")}'`;

const textArray = (values: readonly string[]): string =>
  `ARRAY[${values.map(quote).join(",")}]::text[]`;

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const statements: string[] = [];

  statements.push(
    `-- Datos base de Inversiones JCJ: empresa, roles, modulos, usuarios,
-- caja y categorias de gasto. Sin clientes ni prestamos de ejemplo.
-- Se puede correr varias veces sin duplicar nada.

INSERT INTO "Company" (id,name,"legalName",phone,"currencyCode",locale,timezone,"updatedAt")
VALUES ('${COMPANY_ID}','Inversiones JCJ','Inversiones JCJ, SRL','809-555-0100','DOP','es','America/Santo_Domingo',now())
ON CONFLICT (id) DO NOTHING;`,
  );

  for (const preset of ROLE_PRESETS) {
    const label =
      (es.roles as Record<string, string>)[preset.key] ?? preset.key;
    statements.push(
      `INSERT INTO "Role" (id,"companyId",key,name,permissions,"isSystem","updatedAt")
VALUES (gen_random_uuid()::text,'${COMPANY_ID}',${quote(preset.key)},${quote(label)},${textArray(preset.permissions)},${preset.isSystem},now())
ON CONFLICT ("companyId",key) DO NOTHING;`,
    );
  }

  for (const module of MODULE_REGISTRY) {
    statements.push(
      `INSERT INTO "ModuleInstallation" (id,"companyId","moduleKey","sortOrder","updatedAt")
VALUES (gen_random_uuid()::text,'${COMPANY_ID}',${quote(module.key)},${module.sortOrder},now())
ON CONFLICT ("companyId","moduleKey") DO NOTHING;`,
    );
  }

  const users: Array<[string, string, string | null, string]> = [
    ["admin@inversionesjcj.com", "Juan Carlos Jiménez", "809-555-0100", "owner"],
    ["cobrador@inversionesjcj.com", "Pedro Martínez", null, "collector"],
  ];

  for (const [email, fullName, phone, roleKey] of users) {
    statements.push(
      `INSERT INTO "User" (id,email,"passwordHash","fullName",phone,"updatedAt")
VALUES (gen_random_uuid()::text,${quote(email)},${quote(passwordHash)},${quote(fullName)},${quote(phone)},now())
ON CONFLICT (email) DO NOTHING;`,
    );
    statements.push(
      `INSERT INTO "Membership" (id,"userId","companyId","roleId","updatedAt")
SELECT gen_random_uuid()::text,u.id,'${COMPANY_ID}',r.id,now()
FROM "User" u, "Role" r
WHERE u.email=${quote(email)} AND r."companyId"='${COMPANY_ID}' AND r.key=${quote(roleKey)}
ON CONFLICT ("userId","companyId") DO NOTHING;`,
    );
  }

  statements.push(
    `INSERT INTO "CashBox" (id,"companyId",name,kind,balance,"updatedAt")
SELECT gen_random_uuid()::text,'${COMPANY_ID}','Caja principal','CASH',0,now()
WHERE NOT EXISTS (SELECT 1 FROM "CashBox" WHERE "companyId"='${COMPANY_ID}');`,
  );

  for (const name of ["Transporte", "Papelería", "Comisiones", "Servicios"]) {
    statements.push(
      `INSERT INTO "ExpenseCategory" (id,"companyId",name)
VALUES (gen_random_uuid()::text,'${COMPANY_ID}',${quote(name)})
ON CONFLICT ("companyId",name) DO NOTHING;`,
    );
  }

  for (const template of DEFAULT_TEMPLATES) {
    statements.push(
      `INSERT INTO "Template" (id,"companyId",key,name,kind,body,"isSystem","updatedAt")
VALUES (gen_random_uuid()::text,'${COMPANY_ID}',${quote(template.key)},${quote(template.name)},${quote(template.kind)},${quote(template.body)},true,now())
ON CONFLICT ("companyId",key) DO NOTHING;`,
    );
  }

  // Test mode on purpose: nothing reaches a real customer until the operator
  // connects a provider from the messaging screen.
  statements.push(
    `INSERT INTO "MessagingAccount" (id,"companyId",channel,provider,"displayName","isDefault","updatedAt")
SELECT gen_random_uuid()::text,'${COMPANY_ID}','WHATSAPP','log','WhatsApp (modo prueba)',true,now()
WHERE NOT EXISTS (SELECT 1 FROM "MessagingAccount" WHERE "companyId"='${COMPANY_ID}');`,
  );

  for (const rule of DEFAULT_AUTOMATION_RULES) {
    statements.push(
      `INSERT INTO "AutomationRule" (id,"companyId",name,trigger,"offsetDays",channel,"templateId","sendAtTime","updatedAt")
SELECT gen_random_uuid()::text,'${COMPANY_ID}',${quote(rule.name)},${quote(rule.trigger)},${rule.offsetDays},'WHATSAPP',t.id,'09:00',now()
FROM "Template" t
WHERE t."companyId"='${COMPANY_ID}' AND t.key=${quote(rule.templateKey)}
  AND NOT EXISTS (
    SELECT 1 FROM "AutomationRule" r
    WHERE r."companyId"='${COMPANY_ID}' AND r.name=${quote(rule.name)}
  );`,
    );
  }

  console.log(statements.join("\n\n"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
