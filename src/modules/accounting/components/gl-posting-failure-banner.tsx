"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getRecentGlPostingFailuresAction } from "@/modules/accounting/actions/gl-posting-failures.actions";
import {
  glPostingFailureLabelAr,
  type GlPostingFailure,
} from "@/modules/accounting/lib/gl-posting-failure-labels";

export function GlPostingFailureBanner() {
  const [failures, setFailures] = useState<GlPostingFailure[]>([]);

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

  if (failures.length === 0) return null;

  return (
    <Alert variant="warning" className="mb-4" dir="rtl">
      <AlertTriangle />
      <AlertTitle>
        فيه {failures.length} فشل ترحيل محاسبي خلال آخر 7 أيام
      </AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          العملية الأصلية اتمت (بيع/مصروف/…) لكن القيد الأوتوماتيك فشل. راجع الحسابات
          أو أنشئ قيد يدوي من{" "}
          <Link
            href="/accounting/journals"
            className="font-medium underline underline-offset-2"
          >
            القيود اليومية
          </Link>
          .
        </p>
        <ul className="space-y-1 text-xs">
          {failures.slice(0, 5).map((failure) => (
            <li key={failure.id} className="truncate">
              <span className="font-medium">
                {glPostingFailureLabelAr(failure.label)}
              </span>
              {" · "}
              <span className="tabular-nums">
                {failure.createdAt.slice(0, 16).replace("T", " ")}
              </span>
              {" · "}
              {failure.error}
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
