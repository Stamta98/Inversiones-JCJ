/**
 * Request scoped authentication context.
 *
 * Resolves the signed-in user together with everything the shell needs to
 * render: their company, role permissions, the modules the company enabled and
 * the company's label overrides.
 */

import { cache } from "react";
import { redirect } from "next/navigation";

import {
  MODULE_REGISTRY,
  resolveVisibleModules,
  type ModuleDefinition,
} from "@/core/modules/registry";
import { hasPermission, type PermissionKey } from "@/core/permissions";
import {
  createTranslator,
  type Translator,
  type TranslationOverrides,
} from "@/i18n";
import { formatCurrency } from "@/lib/format";

import { db } from "../db";
import { hashSessionToken, readSessionToken } from "./session";

export interface AuthContext {
  userId: string;
  fullName: string;
  email: string;
  isSuperAdmin: boolean;
  companyId: string;
  companyName: string;
  currencyCode: string;
  /** Decimals amounts are written with; zero where cents are not used. */
  decimalPlaces: number;
  locale: string;
  timezone: string;
  branchId: string | null;
  roleKey: string;
  roleName: string;
  permissions: string[];
  enabledModuleKeys: string[];
  visibleModules: ModuleDefinition[];
  translationOverrides: TranslationOverrides;
  t: Translator;
  /**
   * Amounts formatted with this company's currency, locale and decimals.
   *
   * Lives here so a screen cannot forget one of the three and quietly print
   * Colombian pesos with cents.
   */
  money: (amount: number) => string;
}

/**
 * Loads the context for the current request. Cached per request so several
 * server components can call it without repeating the queries.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const token = await readSessionToken();
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        include: {
          memberships: {
            where: { isActive: true },
            include: { company: true, role: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  if (!session.user.isActive) return null;

  const membership = session.user.memberships[0];
  if (!membership || !membership.company.isActive) return null;

  const [installations, translations] = await Promise.all([
    db.moduleInstallation.findMany({
      where: { companyId: membership.companyId, isEnabled: true },
      select: { moduleKey: true },
    }),
    db.translation.findMany({
      where: {
        companyId: membership.companyId,
        locale: membership.company.locale,
      },
      select: { key: true, value: true },
    }),
  ]);

  const enabledModuleKeys = installations.map(
    (installation) => installation.moduleKey,
  );
  const permissions = membership.role.permissions;
  const overrides: TranslationOverrides = Object.fromEntries(
    translations.map((translation) => [translation.key, translation.value]),
  );

  return {
    userId: session.user.id,
    fullName: session.user.fullName,
    email: session.user.email,
    isSuperAdmin: session.user.isSuperAdmin,
    companyId: membership.companyId,
    companyName: membership.company.name,
    currencyCode: membership.company.currencyCode,
    decimalPlaces: membership.company.decimalPlaces,
    locale: membership.company.locale,
    timezone: membership.company.timezone,
    branchId: membership.branchId,
    roleKey: membership.role.key,
    roleName: membership.role.name,
    permissions,
    enabledModuleKeys,
    visibleModules: resolveVisibleModules(
      enabledModuleKeys,
      permissions,
      hasPermission,
    ),
    translationOverrides: overrides,
    t: createTranslator({ overrides }),
    money: (amount: number) =>
      formatCurrency(
        amount,
        membership.company.currencyCode,
        membership.company.locale,
        membership.company.decimalPlaces,
      ),
  };
});

/** Context or a redirect to the login screen. Use in every protected page. */
export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect("/login");
  return context;
}

/** Context plus a permission check. Renders the "no access" page otherwise. */
export async function requirePermission(
  required: PermissionKey | PermissionKey[],
): Promise<AuthContext> {
  const context = await requireAuth();
  if (!hasPermission(context.permissions, required)) {
    redirect("/forbidden");
  }
  return context;
}

export function can(
  context: AuthContext,
  required: PermissionKey | PermissionKey[],
): boolean {
  return hasPermission(context.permissions, required);
}

export { MODULE_REGISTRY };
