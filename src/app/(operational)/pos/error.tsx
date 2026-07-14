"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorStateBlock } from "@/components/SweetFlow/state-blocks";

/**
 * Soft recovery for intermittent RSC refresh failures on POS.
 * Client cart state in Zustand survives; retry reloads server props only.
 */
export default function PosError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[pos]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6">
      <ErrorStateBlock
        title="تعذر تحديث شاشة الكاشير"
        description="السلة محفوظة على الجهاز. اضغط إعادة المحاولة للاستمرار بدون ما تفقد البيع."
      />
      {error.digest ? (
        <p className="text-xs text-muted-foreground" dir="ltr">
          ref: {error.digest}
        </p>
      ) : null}
      <Button onClick={() => unstable_retry()}>إعادة المحاولة</Button>
    </div>
  );
}
