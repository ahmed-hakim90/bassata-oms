"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { pairDeviceWithCodeAction } from "@/modules/auth/actions/device.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DevicePairForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const from = returnTo?.startsWith("/") ? returnTo : "/pos";
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await pairDeviceWithCodeAction(code);
      if (result.success) {
        toast.success("Device paired");
        router.push(from.startsWith("/") ? from : "/pos");
      } else {
        toast.error(result.error ?? "Pairing failed");
      }
    });
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-3xl border border-border/60 bg-card/80 p-8 shadow-xl backdrop-blur-xl">
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">Pair POS device</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the one-time code from Settings → Devices. Codes expire in 15 minutes.
        </p>
      </div>
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
        <p className="font-medium">Why am I seeing this?</p>
        <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">
          This browser is not registered as a POS device for the active branch. Pairing is saved
          per browser and domain, so a different URL, cleared cookies, inactive device, or branch
          mismatch can ask for a new code.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800/90 dark:text-amber-200/90">
          <li>Use the same URL every day, for example do not switch between localhost, IP, and production domain.</li>
          <li>Hard refresh should not remove pairing unless browser cookies are cleared or blocked.</li>
          <li>If this register changed branch, pair it again from Settings → Devices for that branch.</li>
        </ul>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pair-code">Pairing code</Label>
        <Input
          id="pair-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="8-character code"
          className="font-mono uppercase tracking-widest"
          maxLength={12}
          autoComplete="off"
        />
      </div>
      <Button className="w-full" disabled={pending || code.trim().length < 6} onClick={submit}>
        {pending ? "Pairing…" : "Pair device"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        You must{" "}
        <Link
          href={`/login?from=${encodeURIComponent("/device/pair")}`}
          className="text-primary underline-offset-4 hover:underline"
        >
          sign in
        </Link>{" "}
        before pairing this device.
      </p>
    </div>
  );
}
