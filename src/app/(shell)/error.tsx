"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorStateBlock } from "@/components/SweetFlow/state-blocks";

export default function ShellError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4">
      <ErrorStateBlock
        title="تعذر تحميل هذه الشاشة"
        description="حاول مرة أخرى. إذا استمرت المشكلة، تواصل مع مسؤول النظام."
      />
      <div>
        <Button onClick={() => unstable_retry()}>حاول مرة أخرى</Button>
      </div>
    </div>
  );
}
