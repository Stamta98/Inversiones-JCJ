/**
 * Module registry.
 *
 * Every feature area of the product is declared here as a module. A company
 * turns modules on and off (ModuleInstallation), which drives navigation,
 * permissions and the dashboard. Adding a new feature means adding an entry
 * here plus its route: nothing else in the shell needs to change.
 */

import type { PermissionKey } from "../permissions";

export type ModuleCategory =
  | "core"
  | "operations"
  | "communication"
  | "customization";

export interface ModuleDefinition {
  /** Stable identifier persisted in ModuleInstallation.moduleKey. */
  key: string;
  /** i18n keys resolved against src/i18n. Never hardcode display text. */
  labelKey: string;
  descriptionKey: string;
  category: ModuleCategory;
  /** Lucide-style icon name rendered by src/components/ui/icon.tsx */
  icon: string;
  route: string;
  /** Permission required to even see the module in the navigation. */
  requiredPermission: PermissionKey;
  /** Core modules cannot be turned off. */
  isRemovable: boolean;
  /** Modules that must be enabled first. */
  dependsOn: string[];
  /** Shown in the bottom navigation of the mobile shell. */
  showInMobileNav: boolean;
  sortOrder: number;
}

export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    key: "dashboard",
    labelKey: "modules.dashboard.label",
    descriptionKey: "modules.dashboard.description",
    category: "core",
    icon: "layout-dashboard",
    route: "/dashboard",
    requiredPermission: "dashboard.read",
    isRemovable: false,
    dependsOn: [],
    showInMobileNav: true,
    sortOrder: 10,
  },
  {
    key: "customers",
    labelKey: "modules.customers.label",
    descriptionKey: "modules.customers.description",
    category: "core",
    icon: "users",
    route: "/customers",
    requiredPermission: "customers.read",
    isRemovable: false,
    dependsOn: [],
    showInMobileNav: true,
    sortOrder: 20,
  },
  {
    key: "loans",
    labelKey: "modules.loans.label",
    descriptionKey: "modules.loans.description",
    category: "core",
    icon: "hand-coins",
    route: "/loans",
    requiredPermission: "loans.read",
    isRemovable: false,
    dependsOn: ["customers"],
    showInMobileNav: true,
    sortOrder: 30,
  },
  {
    key: "payments",
    labelKey: "modules.payments.label",
    descriptionKey: "modules.payments.description",
    category: "core",
    icon: "receipt",
    route: "/payments",
    requiredPermission: "payments.read",
    isRemovable: false,
    dependsOn: ["loans"],
    showInMobileNav: true,
    sortOrder: 40,
  },
  {
    key: "collections",
    labelKey: "modules.collections.label",
    descriptionKey: "modules.collections.description",
    category: "operations",
    icon: "route",
    route: "/collections",
    requiredPermission: "collections.read",
    isRemovable: true,
    dependsOn: ["loans"],
    showInMobileNav: true,
    sortOrder: 50,
  },
  {
    key: "promises",
    labelKey: "modules.promises.label",
    descriptionKey: "modules.promises.description",
    category: "operations",
    icon: "clock",
    route: "/promises",
    // Chasing promises is collections work, done by the same people.
    requiredPermission: "collections.read",
    isRemovable: true,
    dependsOn: ["loans"],
    showInMobileNav: true,
    sortOrder: 55,
  },
  {
    key: "cash",
    labelKey: "modules.cash.label",
    descriptionKey: "modules.cash.description",
    category: "operations",
    icon: "wallet",
    route: "/cash",
    requiredPermission: "cash.read",
    isRemovable: true,
    dependsOn: [],
    showInMobileNav: false,
    sortOrder: 60,
  },
  {
    key: "expenses",
    labelKey: "modules.expenses.label",
    descriptionKey: "modules.expenses.description",
    category: "operations",
    icon: "trending-down",
    route: "/expenses",
    requiredPermission: "expenses.read",
    isRemovable: true,
    dependsOn: [],
    showInMobileNav: false,
    sortOrder: 70,
  },
  {
    key: "reports",
    labelKey: "modules.reports.label",
    descriptionKey: "modules.reports.description",
    category: "operations",
    icon: "bar-chart",
    route: "/reports",
    requiredPermission: "reports.read",
    isRemovable: true,
    dependsOn: [],
    showInMobileNav: false,
    sortOrder: 80,
  },
  {
    key: "templates",
    labelKey: "modules.templates.label",
    descriptionKey: "modules.templates.description",
    category: "communication",
    icon: "file-text",
    route: "/templates",
    requiredPermission: "templates.read",
    isRemovable: true,
    dependsOn: [],
    showInMobileNav: false,
    sortOrder: 90,
  },
  {
    key: "callCenter",
    labelKey: "modules.callCenter.label",
    descriptionKey: "modules.callCenter.description",
    category: "communication",
    icon: "headset",
    route: "/call-center",
    requiredPermission: "callCenter.read",
    isRemovable: true,
    dependsOn: ["customers"],
    showInMobileNav: false,
    sortOrder: 100,
  },
  {
    key: "messaging",
    labelKey: "modules.messaging.label",
    descriptionKey: "modules.messaging.description",
    category: "communication",
    icon: "message-circle",
    route: "/messaging",
    requiredPermission: "messaging.read",
    isRemovable: true,
    dependsOn: ["templates"],
    showInMobileNav: false,
    sortOrder: 110,
  },
  {
    key: "moduleBuilder",
    labelKey: "modules.moduleBuilder.label",
    descriptionKey: "modules.moduleBuilder.description",
    category: "customization",
    icon: "blocks",
    route: "/module-builder",
    requiredPermission: "moduleBuilder.read",
    isRemovable: true,
    dependsOn: [],
    showInMobileNav: false,
    sortOrder: 120,
  },
  {
    key: "settings",
    labelKey: "modules.settings.label",
    descriptionKey: "modules.settings.description",
    category: "core",
    icon: "settings",
    route: "/settings",
    requiredPermission: "settings.read",
    isRemovable: false,
    dependsOn: [],
    showInMobileNav: false,
    sortOrder: 200,
  },
];

const MODULES_BY_KEY = new Map(
  MODULE_REGISTRY.map((definition) => [definition.key, definition]),
);

export function getModule(key: string): ModuleDefinition | undefined {
  return MODULES_BY_KEY.get(key);
}

/** Modules enabled by default when a company is created. */
export function defaultEnabledModuleKeys(): string[] {
  return MODULE_REGISTRY.map((definition) => definition.key);
}

/**
 * Resolves which modules a member can actually see: enabled for the company,
 * dependencies satisfied, and permitted for their role.
 */
export function resolveVisibleModules(
  enabledKeys: readonly string[],
  grantedPermissions: readonly string[],
  hasPermissionFn: (
    granted: readonly string[],
    required: PermissionKey,
  ) => boolean,
): ModuleDefinition[] {
  const enabled = new Set([
    ...enabledKeys,
    ...MODULE_REGISTRY.filter((definition) => !definition.isRemovable).map(
      (definition) => definition.key,
    ),
  ]);

  return MODULE_REGISTRY.filter((definition) => {
    if (!enabled.has(definition.key)) return false;
    if (
      definition.dependsOn.some((dependency) => !enabled.has(dependency))
    ) {
      return false;
    }
    return hasPermissionFn(grantedPermissions, definition.requiredPermission);
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Keys that must also be disabled when `key` is turned off. */
export function dependentModuleKeys(key: string): string[] {
  return MODULE_REGISTRY.filter((definition) =>
    definition.dependsOn.includes(key),
  ).map((definition) => definition.key);
}
