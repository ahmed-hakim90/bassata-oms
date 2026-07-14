"use client";

import { useEffect, useState } from "react";
import { LabelDocument } from "@/modules/reports/labels/label-document";
import { loadLabelPrintJob } from "@/modules/reports/labels/print-payload";
import { AutoPrintShell } from "@/components/print/auto-print-shell";
import type { LabelPrintJob } from "@/modules/reports/labels/print-job";

export function LabelPrintView() {
  const [job, setJob] = useState<LabelPrintJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadLabelPrintJob();
    if (!loaded || loaded.items.length === 0) {
      setError("مفيش ملصقات جاهزة للطباعة. ارجع لاستوديو الملصقات واضغط «معاينة الطباعة» تاني.");
      return;
    }
    setJob(loaded);
  }, []);

  const isA4 = job?.settings.preset === "a4_labels";
  const pageSize = isA4
    ? "A4"
    : job
      ? `${job.settings.labelWidthMm}mm ${job.settings.labelHeightMm}mm`
      : "A4";

  return (
    <>
      <style>{`
        @page {
          size: ${pageSize};
          margin: ${isA4 ? "8mm" : "0"};
        }
        @media print {
          html, body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #e7e5e4; }
          .print-stage { min-height: 100vh; padding: 24px; }
        }
      `}</style>
      <AutoPrintShell
        loading={!job && !error}
        error={error}
        backHref="/labels"
        backLabel="رجوع لاستوديو الملصقات"
      >
        {job ? <div dir="rtl"><LabelDocument job={job} /></div> : null}
      </AutoPrintShell>
    </>
  );
}
