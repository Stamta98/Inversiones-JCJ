/**
 * Permission catalogue.
 *
 * A permission key is "<resource>.<action>". Roles hold a flat list of these
 * keys, which lets a company build its own roles from the settings screen
 * without a deployment.
 */

export const PERMISSION_ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "approve",
  "export",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_RESOURCES = [
  "dashboard",
  "customers",
  "loans",
  "payments",
  "collections",
  "cash",
  "expenses",
  "reports",
  "templates",
  "callCenter",
  "messaging",
  // La central de riesgo: consultar es una cosa y reportar es otra. Un
  // cobrador puede necesitar mirar antes de prestar sin poder señalar a nadie.
  "credit",
  "moduleBuilder",
  "settings",
  "users",
  "audit",
] as const;

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

export type PermissionKey = `${PermissionResource}.${PermissionAction}`;

/** Wildcard granted to the owner role. */
export const ALL_PERMISSIONS = "*" as const;

export function permission(
  resource: PermissionResource,
  action: PermissionAction,
): PermissionKey {
  return `${resource}.${action}`;
}

export function permissionsFor(
  resource: PermissionResource,
  actions: readonly PermissionAction[] = PERMISSION_ACTIONS,
): PermissionKey[] {
  return actions.map((action) => permission(resource, action));
}

export function hasPermission(
  granted: readonly string[],
  required: PermissionKey | PermissionKey[],
): boolean {
  if (granted.includes(ALL_PERMISSIONS)) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.some((key) => {
    if (granted.includes(key)) return true;
    const [resource] = key.split(".");
    return granted.includes(`${resource}.*`);
  });
}

/** Role presets seeded for every new company. They remain editable. */
export interface RolePreset {
  key: string;
  /** i18n key resolved against src/i18n. */
  labelKey: string;
  permissions: string[];
  isSystem: boolean;
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    key: "owner",
    labelKey: "roles.owner",
    permissions: [ALL_PERMISSIONS],
    isSystem: true,
  },
  {
    key: "manager",
    labelKey: "roles.manager",
    permissions: [
      ...permissionsFor("dashboard", ["read"]),
      ...permissionsFor("customers"),
      ...permissionsFor("loans"),
      ...permissionsFor("payments"),
      ...permissionsFor("collections"),
      ...permissionsFor("cash"),
      ...permissionsFor("expenses"),
      ...permissionsFor("reports", ["read", "export"]),
      ...permissionsFor("templates"),
      ...permissionsFor("callCenter"),
      ...permissionsFor("messaging"),
      ...permissionsFor("users", ["read", "create", "update"]),
      ...permissionsFor("credit", ["read", "create", "update", "delete"]),
    ],
    isSystem: true,
  },
  {
    key: "collector",
    labelKey: "roles.collector",
    permissions: [
      ...permissionsFor("dashboard", ["read"]),
      ...permissionsFor("customers", ["read", "create", "update"]),
      ...permissionsFor("loans", ["read"]),
      ...permissionsFor("payments", ["read", "create"]),
      ...permissionsFor("collections", ["read", "update"]),
      ...permissionsFor("callCenter", ["read", "create"]),
      // Mirar antes de prestar sí; señalar a alguien no.
      ...permissionsFor("credit", ["read"]),
    ],
    isSystem: true,
  },
  {
    key: "agent",
    labelKey: "roles.agent",
    permissions: [
      ...permissionsFor("dashboard", ["read"]),
      ...permissionsFor("customers", ["read", "update"]),
      ...permissionsFor("loans", ["read"]),
      ...permissionsFor("callCenter"),
      ...permissionsFor("messaging", ["read", "create"]),
      ...permissionsFor("credit", ["read"]),
    ],
    isSystem: true,
  },
  {
    key: "viewer",
    labelKey: "roles.viewer",
    permissions: [
      ...permissionsFor("dashboard", ["read"]),
      ...permissionsFor("customers", ["read"]),
      ...permissionsFor("loans", ["read"]),
      ...permissionsFor("payments", ["read"]),
      ...permissionsFor("reports", ["read"]),
    ],
    isSystem: true,
  },
];
