"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import { es } from "@/i18n/es";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

import type { NavItem, ShellUser } from "./nav-items";

function isActive(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function Sidebar({
  items,
  user,
  onNavigate,
}: {
  items: NavItem[];
  user: ShellUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-ink-inverse">
          JCJ
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {user.companyName}
          </p>
          <p className="truncate text-xs text-ink-subtle">
            {es.common.tagline}
          </p>
        </div>
      </div>

      <nav
        aria-label={es.nav.menu}
        className="flex-1 space-y-0.5 overflow-y-auto p-2"
      >
        {items.map((item) => {
          const active = isActive(pathname, item.route);
          return (
            <Link
              key={item.key}
              href={item.route}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-brand-soft font-medium text-brand-strong"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              <Icon name={item.icon} size={18} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg p-2 hover:bg-surface-muted"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-ink-muted">
            {initials(user.fullName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm text-ink">
              {user.fullName}
            </span>
            <span className="block truncate text-xs text-ink-subtle">
              {user.roleName}
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
