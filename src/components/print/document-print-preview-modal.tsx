"use client";

import { useCallback, useRef, useState } from "react";
import { Printer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DocumentPrintPreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absolute path to an existing `(print)` route, e.g. `/print/orders/…`. */
  href: string | null;
  title?: string;
};

/**
 * In-app print preview (overlay modal) — same UX as operator tools that show
 * فاتورة مؤقتة with طباعة / إغلاق instead of opening a new browser tab.
 * Reuses existing print routes via iframe.
 */
export function DocumentPrintPreviewModal({
  open,
  onOpenChange,
  href,
  title = "معاينة الطباعة",
}: DocumentPrintPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  const handlePrint = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) {
      toast.error("المعاينة لسه بتحمل… حاول تاني");
      return;
    }
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      toast.error("تعذرت الطباعة من المعاينة");
    }
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setLoading(true);
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[94dvh] w-[min(960px,calc(100vw-1.5rem))] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[960px]",
          "print:hidden"
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-3">
          <DialogTitle className="flex items-center justify-between gap-2 text-base">
            <span>{title}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-lg"
              onClick={() => onOpenChange(false)}
              aria-label="إغلاق"
            >
              <X className="size-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 bg-muted/40">
          {loading ? (
            <p className="absolute inset-0 z-10 grid place-items-center text-sm text-muted-foreground">
              جاري تجهيز المعاينة…
            </p>
          ) : null}
          {open && href ? (
            <iframe
              key={href}
              ref={iframeRef}
              title={title}
              src={href}
              className="h-[min(70dvh,720px)] w-full border-0 bg-white"
              onLoad={() => setLoading(false)}
            />
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-border/70 bg-card p-3">
          <Button
            type="button"
            className="h-11 min-w-28 flex-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 sm:flex-none"
            onClick={handlePrint}
            disabled={loading || !href}
          >
            <Printer className="size-4" />
            طباعة
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-28 flex-1 rounded-xl sm:flex-none"
            onClick={() => onOpenChange(false)}
          >
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
