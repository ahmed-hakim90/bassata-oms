"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
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
        toast.success("Session force closed");
        setOpen(false);
        window.location.reload();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not force close session");
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
        Force close
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Manager force close</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-muted/50 p-3 text-sm">
            <p className="font-medium">{summary.cashierName}</p>
            <p className="text-muted-foreground">
              Opened {format(new Date(summary.openedAt), "MMM d, h:mm a")} ·{" "}
              {summary.durationLabel}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <SessionLifecycleBadge lifecycle={summary.lifecycle} />
              <span className="text-muted-foreground">
                Expected {formatCurrency(summary.expectedCash)}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`reason-${summary.session.id}`}>Reason (required)</Label>
            <Textarea
              id={`reason-${summary.session.id}`}
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              className="rounded-xl"
              rows={2}
              placeholder="Why is this session being force closed?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`actual-${summary.session.id}`}>Actual cash in drawer</Label>
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
            <Label htmlFor={`notes-${summary.session.id}`}>Notes (optional)</Label>
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
            {pending ? "Closing…" : "Confirm force close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
