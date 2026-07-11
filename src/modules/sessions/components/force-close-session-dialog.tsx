"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { forceCloseSessionAction } from "@/modules/sessions/actions/session.actions";
import { SessionLifecycleBadge } from "@/modules/sessions/components/session-lifecycle-badge";
import type { OpenSessionSummary } from "@/modules/sessions/services/open-session-summary.service";

interface ForceCloseSessionDialogProps {
  summary: OpenSessionSummary;
  disabled?: boolean;
}

export function ForceCloseSessionDialog({
  summary,
  disabled,
}: ForceCloseSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function handleForceClose() {
    startTransition(async () => {
      try {
        await forceCloseSessionAction({
          sessionId: summary.session.id,
          actualCash: parseFloat(actualCash) || 0,
          closeReason,
          notes: notes || undefined,
        });
        toast.success("تم إغلاق الجلسة إجباريًا");
        setOpen(false);
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "تعذر الإغلاق الإجباري للجلسة"
        );
      }
    });
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        className="rounded-xl"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        إغلاق إجباري
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>إغلاق جلسة إجباري (مدير)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <p className="font-medium">{summary.cashierName}</p>
              <p className="text-muted-foreground">
                فُتحت{" "}
                {new Date(summary.openedAt).toLocaleString("ar-EG", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · {summary.durationLabel}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SessionLifecycleBadge lifecycle={summary.lifecycle} />
                <span className="text-muted-foreground">
                  متوقع {formatCurrency(summary.expectedCash)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`reason-${summary.session.id}`}>سبب الإغلاق (مطلوب)</Label>
              <Textarea
                id={`reason-${summary.session.id}`}
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="rounded-xl"
                rows={2}
                placeholder="ليه هتقفل الجلسة إجباري؟"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`actual-${summary.session.id}`}>النقدية الفعلية في الدرج</Label>
              <Input
                id={`actual-${summary.session.id}`}
                type="number"
                min={0}
                step="0.01"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`notes-${summary.session.id}`}>ملاحظات (اختياري)</Label>
              <Textarea
                id={`notes-${summary.session.id}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-xl"
                rows={2}
              />
            </div>
            <Button
              className={cn("w-full rounded-xl")}
              disabled={pending || !closeReason.trim() || !actualCash}
              onClick={handleForceClose}
            >
              {pending ? "جاري الإغلاق…" : "تأكيد الإغلاق الإجباري"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
