"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StandardModalContent } from "@/components/Velora/standard-modal";
import { formatCurrency } from "@/lib/format";
import { withdrawCashierVaultAction } from "@/modules/sessions/actions/session.actions";
import { listTreasuryOptionsAction } from "@/modules/treasury/actions/treasury.actions";
import type { CashierVaultSummary } from "@/modules/sessions/services/cashier-vault.service";
import type { TreasurySummary } from "@/modules/treasury/lib/treasury-view";

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
  const [destinationId, setDestinationId] = useState("");
  const [destinations, setDestinations] = useState<TreasurySummary[]>([]);
  const [pending, startTransition] = useTransition();

  const withdrawAmount = parseFloat(withdraw) || 0;
  const nextOpeningFloat = parseFloat(nextFloat) || 0;
  const remainder = useMemo(
    () => row.balance - withdrawAmount - nextOpeningFloat,
    [row.balance, withdrawAmount, nextOpeningFloat]
  );

  useEffect(() => {
    if (!open) return;
    void listTreasuryOptionsAction()
      .then((rows) => {
        const allowed = rows.filter(
          (t) => t.kind === "hq" || t.store_id === storeId
        );
        setDestinations(allowed);
        const storeTreasury = allowed.find((t) => t.kind === "store" && t.store_id === storeId);
        setDestinationId(storeTreasury?.id ?? allowed[0]?.id ?? "");
      })
      .catch(() => {
        setDestinations([]);
        setDestinationId("");
      });
  }, [open, storeId]);

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
          destinationTreasuryId: destinationId || null,
        });
        toast.success("تم توريد أمانة الكاشير للخزينة");
        setOpen(false);
        setWithdraw("");
        setNotes("");
        window.location.reload();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "تعذر التوريد للخزينة");
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
        توريد
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <StandardModalContent
          size="sm"
          title="توريد من أمانة الكاشير"
          description={`${row.cashierName} · الرصيد الحالي ${formatCurrency(row.balance)}`}
          footer={
            <Button
              type="button"
              className="rounded-xl"
              disabled={pending || remainder < -1e-9}
              onClick={handleSubmit}
            >
              {pending ? "جاري التوريد…" : "تأكيد التوريد"}
            </Button>
          }
        >
          <div className="space-y-2">
            <Label htmlFor={`vault-withdraw-${row.cashierId}`}>مبلغ التوريد</Label>
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
            <Label>إلى خزينة</Label>
            <Select value={destinationId} onValueChange={(v) => setDestinationId(v ?? "")}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="اختار الخزينة" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`vault-notes-${row.cashierId}`}>ملاحظات</Label>
            <Textarea
              id={`vault-notes-${row.cashierId}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl"
              rows={2}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            المتبقي بعد التوريد:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatCurrency(remainder)}
            </span>
          </p>
        </StandardModalContent>
      </Dialog>
    </>
  );
}
