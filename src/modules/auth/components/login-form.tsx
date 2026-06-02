"use client";

import { useActionState } from "react";
import { loginAction } from "@/modules/auth/actions/login.action";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SweetFormField } from "@/components/SweetFlow/form-field";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="w-full max-w-md space-y-3 rounded-3xl border border-border/60 bg-card/80 p-8 shadow-xl backdrop-blur-xl">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          سجّل الدخول بحساب المالك أو المدير أو الكاشير
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <SweetFormField id="email" label="البريد الإلكتروني">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue="owner@SweetFlow.local"
          />
        </SweetFormField>
        <SweetFormField id="password" label="كلمة المرور">
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </SweetFormField>
        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "جاري تسجيل الدخول…" : "تسجيل الدخول"}
        </Button>
        <p className="text-center text-sm">
          <a
            href="/forgot-password"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            نسيت كلمة المرور؟
          </a>
        </p>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        After seeding: owner@SweetFlow.local / demo1234
      </p>
    </div>
  );
}
