"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/modules/auth/actions/password.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationalCard } from "@/components/SweetFlow/operational-card";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);

  return (
    <OperationalCard title="كلمة المرور" description="حدّث كلمة مرور تسجيل الدخول">
      <form action={formAction} className="max-w-md space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور الجديدة</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.success && state.message && (
          <p className="text-sm text-muted-foreground">{state.message}</p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "جاري الحفظ…" : "تحديث كلمة المرور"}
        </Button>
      </form>
    </OperationalCard>
  );
}
