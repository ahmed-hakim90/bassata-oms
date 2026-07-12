"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StandardModalContent } from "@/components/SweetFlow/standard-modal";
import { formatCurrency } from "@/lib/format";
import { withdrawCashierVaultAction } from "@/modules/sessions/actions/session.actions";
import type { CashierVaultSummary } from "@/modules/sessions/services/cashier-vault.service";

interface CashierVaultWithdrawDialogProps {
  storeId: string;
  row: CashierVaultSummary;
}

export function CashierVaultWithdrawDialog({
  storeId,
  row,
}: CashierVaultWithdrawDialogProps) {
  const [open, setOpen] = useState(false);
  const [withdraw, setWithdraw] = useState("");
  const [nextFloat, setNextFloat] = useState(String(row.pendingOpeningFloat || ""));
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const withdrawAmount = parseFloat(withdraw) || 0;
  const nextOpeningFloat = parseFloat(nextFloat) || 0;
  const remainder = useMemo(
    () => row.balance - withdrawAmount - nextOpeningFloat,
    [row.balance, withdrawAmount, nextOpeningFloat]
  );

  function handleSubmit() {
    if (withdrawAmount < 0 || nextOpeningFloat < 0) {
      toast.error("المبالغ يجب تكون صفر أو أكبر");
      return;
    }
    if (withdrawAmount + nextOpeningFloat > row.balance + 1e-9) {
      toast.error("السحب + رصيد بداية الوردية الجاية أكبر من رصيد الخزينة");
      return;
    }
    startTransition(async () => {
      try {
        await withdrawCashierVaultAction({
          storeId,
          cashierId: row.cashierId,
          withdrawAmount,
          nextOpeningFloat,
          notes: notes.trim() || undefined,
        });
        toast.success("تم السحب من خزينة الكاشير");
        setOpen(false);
        setWithdraw("");
        setNotes("");
        window.location.reload();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر السحب من الخزينة");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-xl"
        onClick={() => {
          setWithdraw("");
          setNextFloat(String(row.pendingOpeningFloat || "0"));
          setNotes("");
          setOpen(true);
        }}
      >
        سحب
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <StandardModalContent
          size="sm"
          title="سحب من خزينة الكاشير"
          description={`${row.cashierName} · الرصيد الحالي ${formatCurrency(row.balance)}`}
          footer={
            <Button
              type="button"
              className="rounded-xl"
              disabled={pending || remainder < -1e-9}
              onClick={handleSubmit}
            >
              {pending ? "جاري السحب…" : "تأكيد السحب"}
            </Button>
          }
        >
          <div className="space-y-2">
            <Label htmlFor={`vault-withdraw-${row.cashierId}`}>مبلغ السحب</Label>
            <Input
              id={`vault-withdraw-${row.cashierId}`}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={withdraw}
              onChange={(e) => setWithdraw(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`vault-next-${row.cashierId}`}>
              رصيد بداية الوردية الجاية
            </Label>
            <Input
              id={`vault-next-${row.cashierId}`}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={nextFloat}
              onChange={(e) => setNextFloat(e.target.value)}
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              الكاشير مش هيقدر يغيّر المبلغ ده لما يفتح الوردية من نقطة البيع
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`vault-notes-${row.cashierId}`}>ملاحظات (اختياري)</Label>
            <Textarea
              id={`vault-notes-${row.cashierId}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl"
              rows={2}
            />
          </div>
          <dl className="space-y-1 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">بعد السحب يبقى في الخزينة</dt>
              <dd className="tabular-nums font-medium">
                {formatCurrency(Math.max(0, row.balance - withdrawAmount))}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">محجوز لبداية الوردية</dt>
              <dd className="tabular-nums">{formatCurrency(nextOpeningFloat)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">متبقي أمانة (مش مخصّص للوردية)</dt>
              <dd
                className={
                  remainder < -1e-9
                    ? "tabular-nums text-destructive"
                    : "tabular-nums"
                }
              >
                {formatCurrency(remainder)}
              </dd>
            </div>
          </dl>
        </StandardModalContent>
      </Dialog>
    </>
  );
}
