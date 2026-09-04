import { AppShell } from "@/components/shell/app-shell";
import type { NavItem } from "@/components/shell/nav-items";
import { ServiceWorkerRegistration } from "@/components/shell/service-worker";
import { requireAuth } from "@/server/auth/context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireAuth();

  const items: NavItem[] = context.visibleModules.map((module) => ({
    key: module.key,
    label: context.t(module.labelKey),
    route: module.route,
    icon: module.icon,
    showInMobileNav: module.showInMobileNav,
    mobileLabel: context.t(module.mobileLabelKey ?? module.labelKey),
  }));

  return (
    <>
      <ServiceWorkerRegistration />
      <AppShell
        items={items}
        user={{
          fullName: context.fullName,
          email: context.email,
          roleName: context.roleName,
          companyName: context.companyName,
        }}
      >
        {children}
      </AppShell>
    </>
  );
}
