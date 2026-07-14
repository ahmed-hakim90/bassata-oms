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
import { batchWithdrawCashierVaultsAction } from "@/modules/sessions/actions/session.actions";
import type { CashierVaultSummary } from "@/modules/sessions/services/cashier-vault.service";
import { roundMoney } from "@/lib/money";

type EditableVaultRow = {
  cashierId: string;
  cashierName: string;
  balance: number;
  nextOpeningFloat: number;
  maxWithdraw: number;
};

function buildEditableRows(rows: CashierVaultSummary[]): EditableVaultRow[] {
  return rows
    .map((row) => {
      const nextOpeningFloat = roundMoney(
        Math.min(row.pendingOpeningFloat, row.balance)
      );
      const maxWithdraw = roundMoney(row.balance - nextOpeningFloat);
      return {
        cashierId: row.cashierId,
        cashierName: row.cashierName,
        balance: row.balance,
        nextOpeningFloat,
        maxWithdraw,
      };
    })
    .filter((row) => row.maxWithdraw > 1e-9);
}

function defaultAmounts(rows: EditableVaultRow[]): Record<string, string> {
  return Object.fromEntries(
    rows.map((row) => [row.cashierId, String(row.maxWithdraw)])
  );
}

interface CashierVaultBatchWithdrawDialogProps {
  storeId: string;
  storeName: string;
  rows: CashierVaultSummary[];
}

export function CashierVaultBatchWithdrawDialog({
  storeId,
  storeName,
  rows,
}: CashierVaultBatchWithdrawDialogProps) {
  const editableRows = useMemo(() => buildEditableRows(rows), [rows]);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    defaultAmounts(editableRows)
  );
  const [pending, startTransition] = useTransition();

  const summary = useMemo(() => {
    let total = 0;
    let activeCount = 0;
    let hasInvalid = false;

    for (const row of editableRows) {
      const raw = amounts[row.cashierId] ?? "";
      const value = parseFloat(raw);
      const amount = Number.isFinite(value) ? roundMoney(value) : NaN;

      if (!raw.trim() || amount === 0) continue;
      if (!Number.isFinite(amount) || amount < 0 || amount > row.maxWithdraw + 1e-9) {
        hasInvalid = true;
        continue;
      }
      total = roundMoney(total + amount);
      activeCount += 1;
    }

    const floatKept = roundMoney(
      editableRows.reduce((sum, row) => sum + row.nextOpeningFloat, 0)
    );

    return { total, activeCount, hasInvalid, floatKept };
  }, [amounts, editableRows]);

  if (editableRows.length === 0) return null;

  function openDialog() {
    setNotes("");
    setAmounts(defaultAmounts(editableRows));
    setOpen(true);
  }

  function setAmount(cashierId: string, value: string) {
    setAmounts((prev) => ({ ...prev, [cashierId]: value }));
  }

  function fillMax() {
    setAmounts(defaultAmounts(editableRows));
  }

  function clearAmounts() {
    setAmounts(
      Object.fromEntries(editableRows.map((row) => [row.cashierId, ""]))
    );
  }

  function handleSubmit() {
    if (summary.hasInvalid) {
      toast.error("راجع مبالغ السحب — في مبلغ أكبر من المتاح أو غير صالح");
      return;
    }
    if (summary.activeCount === 0 || summary.total <= 1e-9) {
      toast.error("حدد مبلغ سحب أكبر من صفر لخزينة واحدة على الأقل");
      return;
    }

    const items = editableRows
      .map((row) => {
        const amount = roundMoney(parseFloat(amounts[row.cashierId] || "0") || 0);
        return { cashierId: row.cashierId, withdrawAmount: amount };
      })
      .filter((item) => item.withdrawAmount > 1e-9);

    startTransition(async () => {
      try {
        const result = await batchWithdrawCashierVaultsAction({
          storeId,
          notes: notes.trim() || undefined,
          items,
        });

        if (result.failed === 0) {
          toast.success(
            `تم سحب ${formatCurrency(result.withdrawnTotal)} من ${result.succeeded} خزينة`
          );
        } else if (result.succeeded === 0) {
          toast.error("تعذر السحب من كل الخزائن");
        } else {
          toast.warning(
            `اتسحب ${formatCurrency(result.withdrawnTotal)} من ${result.succeeded} خزينة — فشل ${result.failed}`
          );
        }

        setOpen(false);
        setNotes("");
        window.location.reload();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "تعذر السحب من الخزائن"
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="rounded-xl"
        onClick={openDialog}
      >
        سحب من الخزائن
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <StandardModalContent
          size="md"
          title="سحب من خزائن الكاشير"
          description={`فرع ${storeName} — عدّل مبلغ السحب لكل كاشير (الحد الأقصى = الرصيد − بداية الوردية)`}
          footer={
            <Button
              type="button"
              className="rounded-xl"
              disabled={
                pending ||
                summary.hasInvalid ||
                summary.activeCount === 0 ||
                summary.total <= 1e-9
              }
              onClick={handleSubmit}
            >
              {pending
                ? "جاري السحب…"
                : `تأكيد سحب ${formatCurrency(summary.total)}`}
            </Button>
          }
        >
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={fillMax}
              disabled={pending}
            >
              تعبئة بالحد الأقصى
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-xl"
              onClick={clearAmounts}
              disabled={pending}
            >
              تفريغ المبالغ
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">الكاشير</th>
                  <th className="px-3 py-2 text-start font-medium">مبلغ السحب</th>
                  <th className="px-3 py-2 text-start font-medium">الحد الأقصى</th>
                  <th className="px-3 py-2 text-start font-medium">يبقى للوردية</th>
                </tr>
              </thead>
              <tbody>
                {editableRows.map((row) => {
                  const raw = amounts[row.cashierId] ?? "";
                  const value = parseFloat(raw);
                  const amount = Number.isFinite(value) ? roundMoney(value) : NaN;
                  const invalid =
                    raw.trim() !== "" &&
                    (!Number.isFinite(amount) ||
                      amount < 0 ||
                      amount > row.maxWithdraw + 1e-9);

                  return (
                    <tr key={row.cashierId} className="border-t border-border/60">
                      <td className="px-3 py-2 font-medium align-middle">
                        {row.cashierName}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <Input
                          id={`vault-batch-withdraw-${row.cashierId}`}
                          type="number"
                          min={0}
                          max={row.maxWithdraw}
                          step="0.01"
                          inputMode="decimal"
                          value={raw}
                          onChange={(e) =>
                            setAmount(row.cashierId, e.target.value)
                          }
                          className={
                            invalid
                              ? "h-9 rounded-xl border-destructive"
                              : "h-9 rounded-xl"
                          }
                          aria-invalid={invalid}
                          disabled={pending}
                        />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground align-middle">
                        {formatCurrency(row.maxWithdraw)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground align-middle">
                        {formatCurrency(row.nextOpeningFloat)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <dl className="space-y-1 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">إجمالي السحب</dt>
              <dd className="tabular-nums font-medium">
                {formatCurrency(summary.total)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">محجوز لبداية الورديات</dt>
              <dd className="tabular-nums">{formatCurrency(summary.floatKept)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">خزائن عليها سحب</dt>
              <dd className="tabular-nums">{summary.activeCount}</dd>
            </div>
          </dl>

          <div className="space-y-2">
            <Label htmlFor="vault-batch-notes">ملاحظات (اختياري)</Label>
            <Textarea
              id="vault-batch-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl"
              rows={2}
              placeholder="مثال: توريد جزئي للخزينة الرئيسية"
              disabled={pending}
            />
          </div>
        </StandardModalContent>
      </Dialog>
    </>
  );
}
