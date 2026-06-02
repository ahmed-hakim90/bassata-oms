"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction } from "@/modules/auth/actions/password.actions";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, null);

  return (
    <div className="w-full max-w-md space-y-8 rounded-3xl border border-border/60 bg-card/80 p-8 shadow-xl backdrop-blur-xl">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Reset your password</p>
      </div>

      {state?.success ? (
        <p className="text-center text-sm text-muted-foreground">{state.message}</p>
      ) : (
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}

      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
