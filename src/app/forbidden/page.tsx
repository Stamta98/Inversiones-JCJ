import { LinkButton } from "@/components/ui";
import { es } from "@/i18n/es";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-ink">
        {es.permissions.denied}
      </p>
      <LinkButton href="/dashboard" variant="secondary" className="mt-4">
        {es.common.back}
      </LinkButton>
    </main>
  );
}
