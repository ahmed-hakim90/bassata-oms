"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { preparePosPinLoginAction } from "@/modules/auth/actions/pos-pin-login.actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Fallback when register cookie is missing.
 * No device admin UI — bind silently or send operator to the slug POS hub.
 */
export function PosDeviceGate() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const started = useRef(false);

  function bind() {
    startTransition(async () => {
      const result = await preparePosPinLoginAction();
      if (result.ok) {
        window.location.assign(result.posPath);
        return;
      }
      const message = result.message;
      setError(message);
      toast.error(message);
    });
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    bind();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        {pending || !error ? (
          <>
            <Loader2 className="mx-auto size-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-medium text-foreground">جاري تجهيز نقطة البيع…</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button type="button" className="h-11 w-full rounded-xl" onClick={bind} disabled={pending}>
              إعادة المحاولة
            </Button>
            <Link
              href="/pos"
              className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full rounded-xl")}
            >
              اختيار رابط الفرع
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
