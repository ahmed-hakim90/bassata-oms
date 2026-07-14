"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorStateBlock } from "@/components/SweetFlow/state-blocks";
import { APP_NAME } from "@/lib/constants";

/**
 * Root-layout failures replace the whole document — must include html/body.
 * Production still masks the real message; digest is logged for Vercel correlation.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
          <ErrorStateBlock
            title="تعذر تحميل التطبيق"
            description={`حصل خطأ غير متوقع في ${APP_NAME}. حاول مرة أخرى. لو استمرت المشكلة، بلّغ الدعم برقم المرجع.`}
          />
          {error.digest ? (
            <p className="text-xs text-muted-foreground" dir="ltr">
              ref: {error.digest}
            </p>
          ) : null}
          <Button onClick={() => reset()}>حاول مرة أخرى</Button>
        </div>
      </body>
    </html>
  );
}
