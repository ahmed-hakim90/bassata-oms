"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/modules/auth/actions/password.actions";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { OperationalCard } from "@/components/SweetFlow/operational-card";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);

  return (
    <OperationalCard title="كلمة المرور" description="حدّث كلمة مرور تسجيل الدخول">
      <form action={formAction} className="max-w-md space-y-[var(--mds-space-4)]">
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
        {state?.success && state.message ? (
          <p className="text-sm text-[var(--mds-color-feedback-success)]">{state.message}</p>
        ) : null}
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "جاري الحفظ…" : "تحديث كلمة المرور"}
        </Button>
      </form>
    </OperationalCard>
  );
}
