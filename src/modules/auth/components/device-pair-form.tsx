"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { pairDeviceWithCodeAction } from "@/modules/auth/actions/device.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DevicePairForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/pos";
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await pairDeviceWithCodeAction(code);
      if (result.success) {
        toast.success("Device paired");
        router.push(from.startsWith("/") ? from : "/pos");
        router.refresh();
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
