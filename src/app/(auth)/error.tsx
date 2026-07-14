"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorStateBlock } from "@/components/SweetFlow/state-blocks";

export default function AuthErrorBoundary({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[auth]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-4 p-6">
      <ErrorStateBlock
        title="تعذر تحميل الشاشة"
        description="حاول مرة أخرى أو ارجع لتسجيل الدخول."
      />
      {error.digest ? (
        <p className="text-xs text-muted-foreground" dir="ltr">
          ref: {error.digest}
        </p>
      ) : null}
      <Button onClick={() => unstable_retry()}>حاول مرة أخرى</Button>
    </div>
  );
}
