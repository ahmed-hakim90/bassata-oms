"use client";

import Link from "next/link";
import { useActionState } from "react";
import { IceCream } from "lucide-react";
import { resetPasswordAction } from "@/modules/auth/actions/password.actions";
import { APP_NAME, APP_TAGLINE_AR } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, null);

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-[var(--mds-radius-xl)] border border-border bg-card shadow-[var(--mds-elevation-3)]">
      <div className="h-1.5 w-full bg-[var(--mds-color-action-primary)]" aria-hidden />
      <div className="space-y-[var(--mds-space-6)] p-[var(--mds-space-8)]">
        <div className="flex flex-col items-center text-center">
          <div className="mb-[var(--mds-space-4)] flex size-12 items-center justify-center rounded-[var(--mds-radius-md)] bg-[var(--mds-color-action-primary)] text-[var(--mds-color-text-inverse)]">
            <IceCream className="size-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="mt-[var(--mds-space-1)] text-sm font-medium text-foreground/70">
            {APP_TAGLINE_AR}
          </p>
          <p className="mt-[var(--mds-space-2)] text-sm text-muted-foreground">
            اختر كلمة مرور جديدة
          </p>
        </div>

        <form action={formAction} className="space-y-[var(--mds-space-4)]">
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور الجديدة</Label>
            <PasswordInput
              id="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-10 rounded-[var(--mds-radius-md)]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-10 rounded-[var(--mds-radius-md)]"
            />
          </div>
          {state?.error ? (
            <p className="text-sm text-[var(--mds-color-feedback-danger)]" role="alert">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" className="h-10 w-full" disabled={pending}>
            {pending ? "جاري الحفظ…" : "تحديث كلمة المرور"}
          </Button>
        </form>

        <p className="text-center text-sm">
          <Link
            href="/login"
            className="font-medium text-[var(--mds-color-action-primary)] underline-offset-4 hover:underline"
          >
            الرجوع لتسجيل الدخول
          </Link>
        </p>
      </div>
    </div>
  );
}
