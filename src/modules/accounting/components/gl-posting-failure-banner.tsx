"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  getRecentGlPostingFailuresAction,
  retryFailedGlPostingAction,
} from "@/modules/accounting/actions/gl-posting-failures.actions";
import {
  glPostingFailureLabelAr,
  type GlPostingFailure,
} from "@/modules/accounting/lib/gl-posting-failure-labels";

export function GlPostingFailureBanner() {
  const [failures, setFailures] = useState<GlPostingFailure[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reload() {
    void getRecentGlPostingFailuresAction()
      .then((result) => setFailures(result.failures))
      .catch(() => setFailures([]));
  }

  useEffect(() => {
    let cancelled = false;
    void getRecentGlPostingFailuresAction()
      .then((result) => {
        if (!cancelled) setFailures(result.failures);
      })
      .catch(() => {
        if (!cancelled) setFailures([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function retry(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await retryFailedGlPostingAction(id);
      if (!result.ok) {
        toast.error(result.error);
        setPendingId(null);
        return;
      }
      toast.success("تم ترحيل القيد");
      setPendingId(null);
      reload();
    });
  }

  if (failures.length === 0) return null;

  return (
    <Alert variant="warning" className="mb-4" dir="rtl">
      <AlertTriangle />
      <AlertTitle>
        فيه {failures.length} فشل ترحيل محاسبي خلال آخر 7 أيام
      </AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          العملية الأصلية اتمت (بيع/مصروف/…) لكن القيد الأوتوماتيك فشل. جرّب إعادة
          الترحيل من هنا، أو أنشئ قيد يدوي من{" "}
          <Link
            href="/accounting/journals"
            className="font-medium underline underline-offset-2"
          >
            القيود اليومية
          </Link>
          .
        </p>
        <ul className="space-y-2 text-xs">
          {failures.slice(0, 5).map((failure) => (
            <li
              key={failure.id}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium">
                  {glPostingFailureLabelAr(failure.label)}
                </span>
                {" · "}
                <span className="tabular-nums">
                  {failure.createdAt.slice(0, 16).replace("T", " ")}
                </span>
                {" · "}
                {failure.error}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 rounded-lg"
                disabled={pending}
                onClick={() => retry(failure.id)}
              >
                {pending && pendingId === failure.id
                  ? "جارٍ الترحيل..."
                  : "إعادة الترحيل"}
              </Button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs">
          التفاصيل كاملة في{" "}
          <Link href="/audit" className="underline underline-offset-2">
            سجل المراجعة
          </Link>
          .
        </p>
      </AlertDescription>
    </Alert>
  );
}
