"use client";

import { useActionState } from "react";
import { IceCream } from "lucide-react";
import { loginAction } from "@/modules/auth/actions/login.action";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SweetFormField } from "@/components/SweetFlow/form-field";
import { useTranslation } from "@/lib/i18n/use-translation";

export function LoginForm() {
  const { t } = useTranslation();
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-[var(--mds-radius-xl)] border border-border bg-card shadow-[var(--mds-elevation-3)]">
      <div className="h-1.5 w-full bg-[var(--mds-color-action-primary)]" aria-hidden />
      <div className="space-y-[var(--mds-space-6)] p-[var(--mds-space-8)]">
        <div className="flex flex-col items-center text-center">
          <div className="mb-[var(--mds-space-4)] flex size-12 items-center justify-center rounded-[var(--mds-radius-md)] bg-[var(--mds-color-action-primary)] text-[var(--mds-color-text-inverse)] shadow-[var(--mds-elevation-1)]">
            <IceCream className="size-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{APP_NAME}</h1>
          <p className="mt-[var(--mds-space-2)] text-sm text-muted-foreground">
            {t("Sign in with your owner, manager, or cashier account")}
          </p>
        </div>

        <form action={formAction} className="space-y-[var(--mds-space-4)]">
          <SweetFormField id="email" label={t("Email")}>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-10 rounded-[var(--mds-radius-md)]"
            />
          </SweetFormField>
          <SweetFormField id="password" label={t("Password")}>
            <PasswordInput
              id="password"
              name="password"
              required
              autoComplete="current-password"
              className="h-10 rounded-[var(--mds-radius-md)]"
            />
          </SweetFormField>
          {state?.error ? (
            <p
              className="rounded-[var(--mds-radius-md)] border border-[color-mix(in_srgb,var(--mds-color-feedback-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--mds-color-feedback-danger)_8%,transparent)] px-3 py-2 text-sm text-[var(--mds-color-feedback-danger)]"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}
          <Button type="submit" className="h-10 w-full" disabled={pending}>
            {pending ? t("Signing in…") : t("Sign in")}
          </Button>
          <p className="text-center text-sm">
            <a
              href="/forgot-password"
              className="font-medium text-[var(--mds-color-action-primary)] underline-offset-4 hover:underline"
            >
              {t("Forgot password?")}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
