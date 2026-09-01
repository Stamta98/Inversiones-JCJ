"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { es } from "@/i18n/es";
import { cn } from "@/lib/cn";

import type { NavItem, ShellUser } from "./nav-items";
import { Sidebar } from "./sidebar";

/** How many destinations fit in the mobile bar before the "more" button. */
const MOBILE_NAV_LIMIT = 4;

export function AppShell({
  items,
  user,
  children,
}: {
  items: NavItem[];
  user: ShellUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A navigation must never leave the drawer covering the new page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const mobileItems = items
    .filter((item) => item.showInMobileNav)
    .slice(0, MOBILE_NAV_LIMIT);
  const currentTitle =
    items.find(
      (item) =>
        pathname === item.route || pathname.startsWith(`${item.route}/`),
    )?.label ?? es.common.appName;

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop navigation */}
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
        <div className="sticky top-0 h-dvh">
          <Sidebar items={items} user={user} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={es.common.close}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl">
            <Sidebar
              items={items}
              user={user}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-surface px-3 py-2.5 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={es.nav.menu}
            className="flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted"
          >
            <Icon name="menu" />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
            {currentTitle}
          </p>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:pb-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        {/* Mobile bottom navigation */}
        <nav
          aria-label={es.nav.menu}
          className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
          style={{
            gridTemplateColumns: `repeat(${mobileItems.length + 1}, minmax(0, 1fr))`,
          }}
        >
          {mobileItems.map((item) => {
            const active =
              pathname === item.route || pathname.startsWith(`${item.route}/`);
            return (
              <Link
                key={item.key}
                href={item.route}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-2 text-[0.6875rem]",
                  active ? "text-brand-strong" : "text-ink-subtle",
                )}
              >
                <Icon name={item.icon} size={20} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-0.5 px-1 py-2 text-[0.6875rem] text-ink-subtle"
          >
            <Icon name="more-horizontal" size={20} />
            <span>{es.nav.more}</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
