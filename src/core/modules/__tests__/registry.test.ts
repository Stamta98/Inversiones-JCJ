import { describe, expect, it } from "vitest";

import { ALL_PERMISSIONS, hasPermission } from "../../permissions";
import {
  MODULE_REGISTRY,
  dependentModuleKeys,
  getModule,
  resolveVisibleModules,
} from "../registry";

describe("MODULE_REGISTRY", () => {
  it("has unique keys, routes and sort orders", () => {
    const keys = MODULE_REGISTRY.map((m) => m.key);
    const routes = MODULE_REGISTRY.map((m) => m.route);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("only depends on modules that exist", () => {
    for (const definition of MODULE_REGISTRY) {
      for (const dependency of definition.dependsOn) {
        expect(getModule(dependency), dependency).toBeDefined();
      }
    }
  });
});

describe("resolveVisibleModules", () => {
  it("shows everything to an owner", () => {
    const visible = resolveVisibleModules(
      MODULE_REGISTRY.map((m) => m.key),
      [ALL_PERMISSIONS],
      hasPermission,
    );
    expect(visible).toHaveLength(MODULE_REGISTRY.length);
  });

  it("hides modules the role cannot read", () => {
    const visible = resolveVisibleModules(
      MODULE_REGISTRY.map((m) => m.key),
      ["dashboard.read", "customers.read"],
      hasPermission,
    );
    expect(visible.map((m) => m.key)).toEqual(["dashboard", "customers"]);
  });

  it("keeps non removable modules even if the company disabled them", () => {
    const visible = resolveVisibleModules([], [ALL_PERMISSIONS], hasPermission);
    expect(visible.map((m) => m.key)).toEqual([
      "dashboard",
      "customers",
      "loans",
      "payments",
      "settings",
    ]);
  });

  it("hides a module whose dependency is disabled", () => {
    const enabled = MODULE_REGISTRY.map((m) => m.key).filter(
      (key) => key !== "templates",
    );
    const visible = resolveVisibleModules(
      enabled,
      [ALL_PERMISSIONS],
      hasPermission,
    );
    expect(visible.map((m) => m.key)).not.toContain("messaging");
  });

  it("returns modules in sort order", () => {
    const visible = resolveVisibleModules(
      MODULE_REGISTRY.map((m) => m.key),
      [ALL_PERMISSIONS],
      hasPermission,
    );
    const orders = visible.map((m) => m.sortOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
});

describe("dependentModuleKeys", () => {
  it("finds the modules that break when one is removed", () => {
    expect(dependentModuleKeys("templates")).toContain("messaging");
    expect(dependentModuleKeys("loans")).toEqual(
      expect.arrayContaining(["payments", "collections"]),
    );
  });
});

describe("hasPermission", () => {
  it("accepts the wildcard and resource level wildcards", () => {
    expect(hasPermission([ALL_PERMISSIONS], "loans.delete")).toBe(true);
    expect(hasPermission(["loans.*"], "loans.delete")).toBe(true);
    expect(hasPermission(["loans.read"], "loans.delete")).toBe(false);
  });
});
