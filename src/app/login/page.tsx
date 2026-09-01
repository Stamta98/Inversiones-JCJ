import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { es } from "@/i18n/es";
import { getAuthContext } from "@/server/auth/context";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: es.auth.signIn };

export default async function LoginPage() {
  const context = await getAuthContext();
  if (context) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand text-lg font-semibold text-ink-inverse">
            JCJ
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">
            {es.common.appName}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {es.auth.signInSubtitle}
          </p>
        </div>

        <SignInForm />

        <p className="mt-6 text-center text-xs text-ink-subtle">
          {es.common.tagline}
        </p>
      </div>
    </main>
  );
}
