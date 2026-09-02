/**
 * Provisioning a new lending company.
 *
 * Everything a company needs before anyone can use it: its roles, the modules
 * it starts with, the collection templates and the automations that drive
 * them, the expense categories, and the owner account.
 *
 * It reads the same constants the seed reads — ROLE_PRESETS, MODULE_REGISTRY,
 * DEFAULT_TEMPLATES, DEFAULT_AUTOMATION_RULES — so a company created by
 * signing up and one created by the seed cannot drift apart.
 */

import { defaultEnabledModuleKeys, MODULE_REGISTRY } from "@/core/modules/registry";
import { defaultsForCountry } from "@/core/locales/countries";
import { defaultDecimalsFor } from "@/core/locales/currencies";
import { ROLE_PRESETS } from "@/core/permissions";
import { es } from "@/i18n/es";
import {
  DEFAULT_AUTOMATION_RULES,
  DEFAULT_TEMPLATES,
} from "@/modules/templates/defaults";

import { db } from "../db";
import { MIN_PASSWORD_LENGTH, hashPassword } from "../auth/password";

export class SignUpError extends Error {
  constructor(
    message: string,
    readonly code: "emailTaken" | "weakPassword" | "unknownCountry",
  ) {
    super(message);
    this.name = "SignUpError";
  }
}

const STARTING_EXPENSE_CATEGORIES = [
  "Transporte",
  "Papelería",
  "Comisiones",
  "Servicios",
];

export interface SignUpInput {
  companyName: string;
  /** ISO 3166-1 alpha-2. Decides the currency, locale and timezone. */
  countryCode: string;
  ownerFullName: string;
  ownerEmail: string;
  password: string;
}

export interface SignUpResult {
  companyId: string;
  userId: string;
}

/**
 * Creates a company and its first user in one transaction.
 *
 * All or nothing on purpose: a company with roles but no owner, or an owner
 * with no modules, is worse than a failed sign-up — nobody could log in to
 * repair it.
 */
export async function signUpCompany(input: SignUpInput): Promise<SignUpResult> {
  const email = input.ownerEmail.trim().toLowerCase();

  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new SignUpError("Password too short", "weakPassword");
  }

  const regional = defaultsForCountry(input.countryCode);
  if (!regional) {
    throw new SignUpError("Unknown country", "unknownCountry");
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new SignUpError("Email already in use", "emailTaken");
  }

  const passwordHash = await hashPassword(input.password);

  return db.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: input.companyName.trim(),
        country: input.countryCode.toUpperCase(),
        currencyCode: regional.currencyCode,
        decimalPlaces: defaultDecimalsFor(regional.currencyCode),
        locale: regional.locale,
        timezone: regional.timezone,
      },
    });

    await tx.role.createMany({
      data: ROLE_PRESETS.map((preset) => ({
        companyId: company.id,
        key: preset.key,
        name: (es.roles as Record<string, string>)[preset.key] ?? preset.key,
        permissions: preset.permissions,
        isSystem: preset.isSystem,
      })),
    });

    const ownerRole = await tx.role.findFirstOrThrow({
      where: { companyId: company.id, key: "owner" },
    });

    await tx.moduleInstallation.createMany({
      data: defaultEnabledModuleKeys().map((moduleKey) => ({
        companyId: company.id,
        moduleKey,
        sortOrder:
          MODULE_REGISTRY.find((item) => item.key === moduleKey)?.sortOrder ?? 0,
      })),
    });

    await tx.expenseCategory.createMany({
      data: STARTING_EXPENSE_CATEGORIES.map((name) => ({
        companyId: company.id,
        name,
      })),
    });

    await tx.template.createMany({
      data: DEFAULT_TEMPLATES.map((template) => ({
        companyId: company.id,
        key: template.key,
        name: template.name,
        kind: template.kind,
        body: template.body,
        isSystem: true,
      })),
    });

    // Test mode: the automations run and record what they would send, but
    // nothing reaches a customer until a real WhatsApp account is connected.
    await tx.messagingAccount.create({
      data: {
        companyId: company.id,
        channel: "WHATSAPP",
        provider: "log",
        displayName: "WhatsApp (modo prueba)",
        isDefault: true,
      },
    });

    const templates = await tx.template.findMany({
      where: { companyId: company.id },
      select: { id: true, key: true },
    });

    await tx.automationRule.createMany({
      data: DEFAULT_AUTOMATION_RULES.flatMap((rule) => {
        const template = templates.find((item) => item.key === rule.templateKey);
        if (!template) return [];
        return [
          {
            companyId: company.id,
            name: rule.name,
            trigger: rule.trigger,
            offsetDays: rule.offsetDays,
            channel: "WHATSAPP" as const,
            templateId: template.id,
            sendAtTime: "09:00",
          },
        ];
      }),
    });

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName: input.ownerFullName.trim(),
      },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        companyId: company.id,
        roleId: ownerRole.id,
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: company.id,
        userId: user.id,
        action: "company.created",
        entityType: "Company",
        entityId: company.id,
        metadata: { country: input.countryCode, email },
      },
    });

    return { companyId: company.id, userId: user.id };
  });
}
